import { callEbayApi } from './ebayClient.js';
import { getUsdToAudRate } from './exchangeRates.js';
import supabase from './supabaseClient.js';
import logger from './logger.js';
import { isGradedTitle, summariseListings } from '../../utils/priceSnapshotStats.js';

const round2 = (n) => Math.round(n * 100) / 100;

async function searchMarketplace(query, marketplaceId, limit = 20) {
  const filters = ['buyingOptions:{AUCTION|FIXED_PRICE}'];
  if (marketplaceId === 'EBAY_AU') filters.push('itemLocationCountry:AU');

  const params = new URLSearchParams({
    q: query,
    filter: filters.join(','),
    limit: String(limit),
    sort: 'newlyListed',
  });

  const data = await callEbayApi(`/buy/browse/v1/item_summary/search?${params}`, {
    headers: { 'X-EBAY-C-MARKETPLACE-ID': marketplaceId },
  });
  return data.itemSummaries || [];
}

/**
 * Fetch live eBay AU + US listings for a tracked card and upsert today's
 * aggregated AUD snapshot. Returns the stored snapshot row.
 */
export async function buildSnapshotForCard(card, usdToAud) {
  const [auResult, usResult] = await Promise.allSettled([
    searchMarketplace(card.search_query, 'EBAY_AU'),
    searchMarketplace(card.search_query, 'EBAY_US'),
  ]);

  if (auResult.status === 'rejected' && usResult.status === 'rejected') {
    throw new Error(`eBay unavailable for "${card.slug}": ${auResult.reason?.message}`);
  }

  const rate = usdToAud ?? (await getUsdToAudRate());

  const listings = [];
  const collect = (result, marketplace) => {
    if (result.status !== 'fulfilled') return;
    for (const item of result.value) {
      const price = parseFloat(item.price?.value);
      if (isNaN(price) || price <= 0) continue;
      const priceAud = marketplace === 'US' ? round2(price * rate) : round2(price);
      listings.push({
        title: item.title || '',
        priceAud,
        marketplace,
        graded: isGradedTitle(item.title),
        listingUrl: item.itemWebUrl || '',
        thumbnailUrl: item.image?.imageUrl || '',
      });
    }
  };
  collect(auResult, 'AU');
  collect(usResult, 'US');

  // Reprints, lots, outliers and raw listings that can't be the same card as
  // the graded ones are dropped before anything is averaged or shown as a
  // sample (utils/priceSnapshotStats.js).
  const { raw, graded, rawStats, gradedStats, dropped } = summariseListings(listings, {
    cardText: `${card.name || ''} ${card.search_query || ''}`,
  });
  const droppedTotal = Object.values(dropped).reduce((a, b) => a + b, 0);
  if (droppedTotal > 0) {
    logger.info(`[PRICE_SNAPSHOTS] ${card.slug}: dropped ${droppedTotal} of ${listings.length} listings ${JSON.stringify(dropped)}`);
  }

  // Keep a handful of representative live listings for the page. AU listings
  // first — they're what an Australian buyer can actually act on.
  const byAuFirst = (a, b) => (a.marketplace === b.marketplace ? 0 : a.marketplace === 'AU' ? -1 : 1);
  const sample = [
    ...raw.sort(byAuFirst).slice(0, 3),
    ...graded.sort(byAuFirst).slice(0, 3),
  ].map(({ title, priceAud, marketplace, graded: isGraded, listingUrl, thumbnailUrl }) => ({
    title, priceAud, marketplace, graded: isGraded, listingUrl, thumbnailUrl,
  }));

  const snapshot = {
    card_id: card.id,
    snapshot_date: new Date().toISOString().slice(0, 10),
    raw_avg: rawStats.avg,
    raw_min: rawStats.min,
    raw_max: rawStats.max,
    raw_count: rawStats.count,
    graded_avg: gradedStats.avg,
    graded_min: gradedStats.min,
    graded_max: gradedStats.max,
    graded_count: gradedStats.count,
    exchange_rate: rate,
    sample_listings: sample,
  };

  const { data, error } = await supabase
    .from('card_price_snapshots')
    .upsert(snapshot, { onConflict: 'card_id,snapshot_date' })
    .select()
    .single();

  if (error) throw new Error(`Snapshot upsert failed for "${card.slug}": ${error.message}`);
  return data;
}

/**
 * Refresh every active tracked card that has no snapshot yet today.
 * Runs with bounded concurrency and a wall-clock budget so it fits inside the
 * serverless maxDuration; anything left over is picked up by the next cron run
 * or the on-demand fallback.
 *
 * Concurrency 8 (two eBay calls per card, so up to 16 in flight): 5 workers
 * measured ~5 cards/s in production (82 cards in ~16 s); 8 lifts a run to
 * roughly 250 cards inside the 32 s budget, so the catalogue can keep growing.
 */
export async function refreshTrackedCards({ timeBudgetMs = 32000, concurrency = 8 } = {}) {
  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const { data: cards, error: cardsError } = await supabase
    .from('tracked_cards')
    .select('id, slug, name, search_query')
    .eq('active', true);
  if (cardsError) throw new Error(`Failed to load tracked cards: ${cardsError.message}`);

  const { data: doneRows, error: doneError } = await supabase
    .from('card_price_snapshots')
    .select('card_id')
    .eq('snapshot_date', today);
  if (doneError) throw new Error(`Failed to load today's snapshots: ${doneError.message}`);

  const done = new Set((doneRows || []).map((r) => r.card_id));
  const pending = (cards || []).filter((c) => !done.has(c.id));

  const summary = { total: cards?.length || 0, alreadyFresh: done.size, refreshed: 0, failed: 0, remaining: 0 };
  if (pending.length === 0) return summary;

  const usdToAud = await getUsdToAudRate();
  const queue = [...pending];

  const worker = async () => {
    while (queue.length > 0) {
      if (Date.now() - startedAt > timeBudgetMs) return;
      const card = queue.shift();
      if (!card) return;
      try {
        await buildSnapshotForCard(card, usdToAud);
        summary.refreshed += 1;
      } catch (err) {
        summary.failed += 1;
        logger.warn(`[PRICE_SNAPSHOTS] ${err.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  summary.remaining = queue.length;
  return summary;
}
