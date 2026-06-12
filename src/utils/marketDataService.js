import { getCardSightClient, summarisePricing } from './cardSightClient.js';
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
    client.pricing.get(cardId).then(r => summarisePricing(r.data)),
    client.population.card(cardId).then(r => r.data).catch(() => null), // may not exist for all cards
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
          currency:        pricing.currency ?? 'USD',
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
    const totalPop   = pop.total_population ?? 0;
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

  // Compute / update the price range now that valuations are fresh
  const range = await computePriceRange(cardId, cardName, setName).catch(err => {
    logger.warn(`[MARKET_SVC] computePriceRange failed: ${err.message}`);
    return null;
  });

  return {
    cardsight: csResult.status === 'fulfilled' ? csResult.value : null,
    ebay:      ebayResult.status === 'fulfilled' ? ebayResult.value : null,
    range,
  };
}

export async function getPriceRange(cardId) {
  const { data } = await supabase
    .from('card_price_ranges')
    .select('*')
    .eq('card_id', cardId)
    .maybeSingle();
  return data ?? null;
}

// ─── Price range computation ──────────────────────────────────────────────────

/**
 * Aggregates CardSight, eBay AU, and CardPop completed-sales data into a
 * Low / Avg / High price range, then persists it to card_price_ranges.
 * floor_aud = low_aud * 0.50 — the absolute minimum listing price.
 */
export async function computePriceRange(cardId, cardName, setName) {
  // Pull valuations from DB — use allSettled so a single query failure doesn't abort the whole range
  const [csResult, ebayResult, cardpopResult, soldResult] = await Promise.allSettled([
    supabase.from('card_market_valuations').select('market_value,raw_data').eq('card_id', cardId).eq('source', 'cardsight').maybeSingle().then(r => r.data),
    supabase.from('card_market_valuations').select('market_value,raw_data').eq('card_id', cardId).eq('source', 'ebay_au').maybeSingle().then(r => r.data),
    supabase.from('completed_sales').select('sale_price').eq('card_id', cardId).gte('sale_date', new Date(Date.now() - 90 * 86400 * 1000).toISOString()).then(r => r.data ?? []),
    supabase.from('market_sold_listings').select('sold_price_aud').eq('card_id', cardId).not('sold_price_aud', 'is', null).order('sold_at', { ascending: false }).limit(100).then(r => r.data ?? []),
  ]);
  const csRow       = csResult.status       === 'fulfilled' ? csResult.value       : null;
  const ebayRow     = ebayResult.status     === 'fulfilled' ? ebayResult.value     : null;
  const cardpopRows = cardpopResult.status  === 'fulfilled' ? (cardpopResult.value  ?? []) : [];
  const soldRows    = soldResult.status     === 'fulfilled' ? (soldResult.value     ?? []) : [];

  const allPrices  = [];
  const sourcesUsed = [];

  if (csRow?.raw_data?.avgPrice) {
    const d = csRow.raw_data;
    if (d.minPrice)     allPrices.push(parseFloat(d.minPrice));
    if (d.avgPrice)     allPrices.push(parseFloat(d.avgPrice));
    if (d.maxPrice)     allPrices.push(parseFloat(d.maxPrice));
    if (d.lastSalePrice) allPrices.push(parseFloat(d.lastSalePrice));
    sourcesUsed.push('cardsight');
  } else if (csRow?.market_value) {
    const v = parseFloat(csRow.market_value);
    allPrices.push(v * 0.75, v, v * 1.25);
    sourcesUsed.push('cardsight');
  }

  if (ebayRow?.raw_data?.avgPrice) {
    const d = ebayRow.raw_data;
    if (d.minPrice) allPrices.push(parseFloat(d.minPrice));
    if (d.avgPrice) allPrices.push(parseFloat(d.avgPrice));
    if (d.maxPrice) allPrices.push(parseFloat(d.maxPrice));
    sourcesUsed.push('ebay_au');
  } else if (ebayRow?.market_value) {
    const v = parseFloat(ebayRow.market_value);
    allPrices.push(v * 0.70, v, v * 1.30);
    sourcesUsed.push('ebay_au');
  }

  if (cardpopRows.length > 0) {
    cardpopRows.forEach(r => allPrices.push(parseFloat(r.sale_price)));
    sourcesUsed.push('cardpop');
  }

  // Also fold in recent eBay sold listing prices
  if (soldRows.length > 0) {
    soldRows.forEach(r => allPrices.push(parseFloat(r.sold_price_aud)));
    if (!sourcesUsed.includes('ebay_au')) sourcesUsed.push('ebay_au');
  }

  const valid = allPrices.filter(p => p > 0).sort((a, b) => a - b);
  if (valid.length === 0) return null;

  const pct = (p) => {
    const i = Math.max(0, Math.min(valid.length - 1, Math.floor(p * (valid.length - 1))));
    return valid[i];
  };

  const lowAud   = Math.round(pct(0.2) * 100) / 100;
  const avgAud   = Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
  const highAud  = Math.round(pct(0.8) * 100) / 100;
  const floorAud = Math.round(lowAud * 0.5 * 100) / 100;

  const { error } = await supabase.from('card_price_ranges').upsert(
    {
      card_id:      cardId,
      card_name:    cardName ?? null,
      set_name:     setName  ?? null,
      low_aud:      lowAud,
      avg_aud:      avgAud,
      high_aud:     highAud,
      floor_aud:    floorAud,
      source_count: valid.length,
      sources_used: sourcesUsed,
      computed_at:  new Date().toISOString(),
    },
    { onConflict: 'card_id' }
  );

  if (error) logger.error(`[MARKET_SVC] Price range upsert failed: ${error.message}`);
  else logger.info(`[MARKET_SVC] Price range saved: ${cardId} floor=$${floorAud} low=$${lowAud} avg=$${avgAud} high=$${highAud}`);

  return { lowAud, avgAud, highAud, floorAud, sourcesUsed };
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
