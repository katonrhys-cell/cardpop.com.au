import { getCardSightClient } from './cardSightClient.js';
import { callEbayApi } from './ebayClient.js';
import supabase from './supabaseClient.js';
import logger from './logger.js';

// ─── Confidence heuristics ────────────────────────────────────────────────────

function ebayConfidence(sampleCount) {
  if (sampleCount >= 20) return 90;
  if (sampleCount >= 10) return 75;
  if (sampleCount >= 5)  return 60;
  if (sampleCount >= 1)  return 40;
  return 0;
}

function cardsightConfidence(salesCount) {
  if (salesCount >= 50) return 95;
  if (salesCount >= 20) return 88;
  if (salesCount >= 10) return 78;
  if (salesCount >= 3)  return 65;
  if (salesCount >= 1)  return 50;
  return 30;
}

function psaConfidence(totalPop) {
  // Higher population = more confident the grade represents the card
  if (totalPop >= 1000) return 90;
  if (totalPop >= 200)  return 80;
  if (totalPop >= 50)   return 65;
  if (totalPop >= 10)   return 50;
  return 35;
}

// ─── CardSight source ─────────────────────────────────────────────────────────

async function fetchAndPersistCardSight(cardId, cardName, setName) {
  const client = getCardSightClient();

  const [pricingResult, populationResult] = await Promise.allSettled([
    client.pricing.get(cardId),
    client.population.card(cardId).catch(() => null), // may not exist for all cards
  ]);

  const pricing = pricingResult.status === 'fulfilled' ? pricingResult.value : null;
  const pop     = populationResult.status === 'fulfilled' ? populationResult.value : null;

  // ── Valuation row ──────────────────────────────────────────────────────────
  if (pricing) {
    const marketValue = pricing.avgPrice ?? pricing.lastSalePrice ?? null;
    const confidence  = cardsightConfidence(pricing.salesCount ?? 0);

    const { error: upsertErr } = await supabase
      .from('card_market_valuations')
      .upsert(
        {
          card_id:         cardId,
          card_name:       cardName ?? null,
          set_name:        setName  ?? null,
          source:          'cardsight',
          market_value:    marketValue,
          currency:        pricing.currency ?? 'AUD',
          last_updated:    new Date().toISOString(),
          confidence_score: confidence,
          raw_data:         pricing,
        },
        { onConflict: 'card_id,source' }
      );

    if (upsertErr) logger.error(`[MARKET_SVC] CardSight valuation upsert failed: ${upsertErr.message}`);
    else logger.info(`[MARKET_SVC] CardSight valuation saved: ${cardId} avgPrice=${marketValue}`);
  }

  // ── PSA population row ─────────────────────────────────────────────────────
  if (pop) {
    const totalPop   = pop.totalPopulation ?? pop.total ?? 0;
    const confidence = psaConfidence(totalPop);

    const { error: psaErr } = await supabase
      .from('card_market_valuations')
      .upsert(
        {
          card_id:          cardId,
          card_name:        cardName ?? null,
          set_name:         setName  ?? null,
          source:           'psa',
          market_value:     null, // PSA pop doesn't produce a price
          currency:         'AUD',
          last_updated:     new Date().toISOString(),
          confidence_score: confidence,
          raw_data:         pop,
        },
        { onConflict: 'card_id,source' }
      );

    if (psaErr) logger.error(`[MARKET_SVC] PSA pop upsert failed: ${psaErr.message}`);
    else logger.info(`[MARKET_SVC] PSA population saved: ${cardId} totalPop=${totalPop}`);
  }

  return { pricing, pop };
}

// ─── eBay source ──────────────────────────────────────────────────────────────

async function fetchAndPersistEbay(cardId, cardName, setName) {
  const query = [cardName, setName].filter(Boolean).join(' ');
  if (!query.trim()) return null;

  let items = [];
  try {
    const params = new URLSearchParams({
      q: query,
      filter: 'buyingOptions:{AUCTION|FIXED_PRICE},itemLocationCountry:AU',
      limit: 50,
      sort: 'newlyListed',
    });
    const data = await callEbayApi(`/buy/browse/v1/item_summary/search?${params}`);
    items = data.itemSummaries || [];
  } catch (err) {
    logger.warn(`[MARKET_SVC] eBay fetch failed for "${query}": ${err.message}`);
    return null;
  }

  const prices = items.map(i => parseFloat(i.price?.value || 0)).filter(p => p > 0);
  if (prices.length === 0) return null;

  const avgPrice = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
  const confidence = ebayConfidence(prices.length);

  // ── Valuation row ──────────────────────────────────────────────────────────
  const { error: valErr } = await supabase
    .from('card_market_valuations')
    .upsert(
      {
        card_id:          cardId,
        card_name:        cardName ?? null,
        set_name:         setName  ?? null,
        source:           'ebay_au',
        market_value:     avgPrice,
        currency:         'AUD',
        last_updated:     new Date().toISOString(),
        confidence_score: confidence,
        raw_data:         { avgPrice, minPrice: Math.min(...prices), maxPrice: Math.max(...prices), count: prices.length },
      },
      { onConflict: 'card_id,source' }
    );

  if (valErr) logger.error(`[MARKET_SVC] eBay valuation upsert failed: ${valErr.message}`);
  else logger.info(`[MARKET_SVC] eBay valuation saved: ${cardId} avgPrice=${avgPrice} n=${prices.length}`);

  // ── Individual sold listing rows ───────────────────────────────────────────
  const soldRows = items
    .filter(i => i.itemId && parseFloat(i.price?.value || 0) > 0)
    .map(i => ({
      card_id:        cardId,
      source:         'ebay_au',
      external_id:    i.itemId,
      title:          i.title ?? null,
      sold_price_aud: parseFloat(i.price?.value || 0),
      sold_at:        i.itemEndDate ?? null,
      condition_label: i.condition ?? null,
      grade:          null,
      platform:       'eBay AU',
      listing_url:    i.itemWebUrl ?? null,
      thumbnail_url:  i.image?.imageUrl ?? null,
      fetched_at:     new Date().toISOString(),
    }));

  if (soldRows.length > 0) {
    const { error: soldErr } = await supabase
      .from('market_sold_listings')
      .upsert(soldRows, { onConflict: 'source,external_id', ignoreDuplicates: true });

    if (soldErr) logger.error(`[MARKET_SVC] eBay sold listings upsert failed: ${soldErr.message}`);
    else logger.info(`[MARKET_SVC] eBay sold listings saved: ${soldRows.length} rows for ${cardId}`);
  }

  return { avgPrice, count: prices.length };
}

// ─── Public: refresh all three sources for a card ────────────────────────────

/**
 * Fetches CardSight pricing, PSA population, and eBay AU listings for a card,
 * then persists the aggregated market value rows and individual sold records.
 *
 * @param {{ cardId: string, cardName?: string, setName?: string }} opts
 * @returns {Promise<{ cardsight, ebay }>}
 */
export async function refreshCardMarketData({ cardId, cardName, setName }) {
  logger.info(`[MARKET_SVC] Refreshing market data: cardId=${cardId} name="${cardName}"`);

  const [csResult, ebayResult] = await Promise.allSettled([
    fetchAndPersistCardSight(cardId, cardName, setName),
    fetchAndPersistEbay(cardId, cardName, setName),
  ]);

  return {
    cardsight: csResult.status === 'fulfilled' ? csResult.value : null,
    ebay:      ebayResult.status === 'fulfilled' ? ebayResult.value : null,
  };
}

/**
 * Returns persisted valuations for a card (all sources), plus recent sold listings.
 */
export async function getStoredMarketData(cardId) {
  const [valRows, soldRows] = await Promise.all([
    supabase
      .from('card_market_valuations')
      .select('*')
      .eq('card_id', cardId)
      .order('source'),
    supabase
      .from('market_sold_listings')
      .select('*')
      .eq('card_id', cardId)
      .order('sold_at', { ascending: false })
      .limit(50),
  ]);

  const valuations = (valRows.data ?? []).reduce((acc, row) => {
    acc[row.source] = row;
    return acc;
  }, {});

  return { valuations, soldListings: soldRows.data ?? [] };
}
