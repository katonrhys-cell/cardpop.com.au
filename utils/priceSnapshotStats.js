// Turning a page of live marketplace listings into the raw / graded price
// figures on a card's price page (src/utils/cardPriceSnapshots.js stores them).
//
// A keyword search returns more than the card: reprints and proxies at a few
// dollars, job lots, slabs whose title never says "PSA", and the occasional
// wishful asking price ten times the market. Averaged in, they produced the
// figures a reviewer notices — a Stephen Curry rookie "raw" above its graded
// price, a 1986 Fleer Michael Jordan at $130 raw beside $13,000 graded. The
// steps here, in order:
//
//   1. drop listings whose title says they are not the card (reprint, proxy,
//      custom, lot, bundle…);
//   2. split raw from graded on the title;
//   3. inside each side, drop prices more than OUTLIER_FACTOR× away from that
//      side's median (needs MIN_FENCE_SAMPLE listings);
//   4. check raw against graded: an ungraded copy priced above every graded
//      one, or at a tiny fraction of the graded median, is not a comparable
//      ungraded copy of the same card;
//   5. trim 10% off each tail once there are 8+ prices, and average.
//
// Nothing is invented: a side with no listings left has no figure. Pure and
// dependency-free so it can be tested without eBay or a database.

// Anything slabbed or described as graded is priced separately from raw copies
// — mixing the two makes both averages meaningless. "TAG" counts only with a
// grade after it ("TAG 10"), so Pokémon "Tag Team" cards stay raw.
export const GRADED_RE = /\b(psa|bgs|bccg|bvg|beckett|cgc|csg|sgc|tag\s+(?:10|[1-9](?:\.5)?)|ksa|hga|gsg|pgs|mnt|rcg|cga|ags|dsg|graad|arena club|aigrading|ace\s?grad\w*|graded|slab(?:bed)?|gem\s?(?:mt|mint)|pop\s?\d+)\b/i;

// Titles that say the item is not one genuine copy of the card.
export const NOT_THE_CARD_RE = /\b(reprints?|rp|proxy|proxies|custom|replica|facsimile|fake|novelty|fan[\s-]?made|not\s+(?:real|authentic|original|genuine)|unofficial|orica|lots?|bundle|bulk|you\s+pick|pick\s+your|choose\s+your|digital\s+(?:code|card|download|copy)|2[234]\s?k(?:t|arat)?\s+gold|gold\s+(?:foil\s+)?(?:metal|plated)|metal\s+card|sticker|poster|magnet|playmat|keychain|empty\s+(?:box|tin|wrapper))\b/i;

export const OUTLIER_FACTOR = 5;
export const MIN_FENCE_SAMPLE = 3;
// Raw is checked against graded only when graded has enough listings to be a
// reference point.
export const MIN_GRADED_FOR_CEILING = 3;
export const MIN_GRADED_FOR_FLOOR = 5;
export const RAW_FLOOR_SHARE_OF_GRADED = 0.02;

const round2 = (n) => Math.round(n * 100) / 100;

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * True when the title describes something other than one genuine copy.
 * A term the card's own name or search query uses is not held against a
 * listing — a tracked sticker card is allowed to say "sticker".
 */
export function isNotTheCard(title, cardText = '') {
  const own = String(cardText || '').toLowerCase();
  const re = new RegExp(NOT_THE_CARD_RE.source, 'gi');
  for (const match of String(title || '').matchAll(re)) {
    const term = match[0].toLowerCase().replace(/\s+/g, ' ');
    if (!own.includes(term)) return true;
  }
  return false;
}

/** True when the title describes a graded / slabbed copy. */
export function isGradedTitle(title) {
  return GRADED_RE.test(String(title || ''));
}

/** Listings within OUTLIER_FACTOR× of the group's median price. */
export function withinMedianFence(listings) {
  if (listings.length < MIN_FENCE_SAMPLE) return listings;
  const mid = median(listings.map((l) => l.priceAud));
  return listings.filter((l) => l.priceAud >= mid / OUTLIER_FACTOR && l.priceAud <= mid * OUTLIER_FACTOR);
}

/**
 * Trimmed price stats: with 8+ prices the top and bottom 10% are dropped
 * before averaging. { avg, min, max, count } — nulls and 0 for no prices.
 */
export function priceStats(pricesAud) {
  if (pricesAud.length === 0) return { avg: null, min: null, max: null, count: 0 };
  let sorted = [...pricesAud].sort((a, b) => a - b);
  if (sorted.length >= 8) {
    const cut = Math.floor(sorted.length * 0.1);
    sorted = sorted.slice(cut, sorted.length - cut);
  }
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    avg: round2(avg),
    min: round2(sorted[0]),
    max: round2(sorted[sorted.length - 1]),
    count: sorted.length,
  };
}

/**
 * `listings` ([{ title, priceAud, … }]) → the comparable raw and graded
 * listings and their stats: { raw, graded, rawStats, gradedStats, dropped }.
 * `dropped` counts what each step removed, for the log. `cardText` is the
 * card's own name / search query (see isNotTheCard).
 */
export function summariseListings(listings, { cardText = '' } = {}) {
  const dropped = { notTheCard: 0, outlier: 0, aboveGraded: 0, belowGraded: 0 };

  const genuine = [];
  for (const listing of listings) {
    if (isNotTheCard(listing.title, cardText)) dropped.notTheCard += 1;
    else genuine.push({ ...listing, graded: listing.graded ?? isGradedTitle(listing.title) });
  }

  const gradedAll = genuine.filter((l) => l.graded);
  const graded = withinMedianFence(gradedAll);
  dropped.outlier += gradedAll.length - graded.length;

  const rawAll = genuine.filter((l) => !l.graded);
  let raw = withinMedianFence(rawAll);
  dropped.outlier += rawAll.length - raw.length;

  if (graded.length >= MIN_GRADED_FOR_CEILING) {
    const ceiling = Math.max(...graded.map((l) => l.priceAud));
    const kept = raw.filter((l) => l.priceAud <= ceiling);
    dropped.aboveGraded = raw.length - kept.length;
    raw = kept;
  }
  if (graded.length >= MIN_GRADED_FOR_FLOOR) {
    const floor = median(graded.map((l) => l.priceAud)) * RAW_FLOOR_SHARE_OF_GRADED;
    const kept = raw.filter((l) => l.priceAud >= floor);
    dropped.belowGraded = raw.length - kept.length;
    raw = kept;
  }

  return {
    raw,
    graded,
    rawStats: priceStats(raw.map((l) => l.priceAud)),
    gradedStats: priceStats(graded.map((l) => l.priceAud)),
    dropped,
  };
}
