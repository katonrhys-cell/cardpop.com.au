import supabase from './supabaseClient.js';

// Price data handed to the article generator. Everything here is derived from
// card_price_snapshots — the model is told to quote only these figures, and the
// draft validator checks at least one of them survives into the copy.
//
// The snapshot series is short (daily observations, started July 2026), so a
// window is always reported alongside the numbers rather than implied. An
// article may say "across the three weeks to 25 July" but must not say
// "up 40% this year" — there is no data behind that claim.

const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

const daysBetween = (fromIso, toIso) =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000) + 1;

/**
 * Percentage change between the first and last non-null value in the series.
 * Returns null when there aren't two usable points — a single observation
 * can't describe a direction, and pretending otherwise is how "trend" claims
 * get invented.
 */
function changePct(series) {
  const values = series.filter((v) => typeof v === 'number' && v > 0);
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  return Math.round(((last - first) / first) * 1000) / 10;
}

/** Math.min/Math.max over the non-null values, or null when there are none. */
function extreme(pick, series) {
  const values = series.filter((v) => typeof v === 'number');
  return values.length === 0 ? null : round2(pick(...values));
}

function summariseCard(card, snapshots) {
  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  const rawSeries = snapshots.map((s) => (s.raw_avg === null ? null : Number(s.raw_avg)));
  const gradedSeries = snapshots.map((s) => (s.graded_avg === null ? null : Number(s.graded_avg)));

  const rawAvg = latest.raw_avg === null ? null : Number(latest.raw_avg);
  const gradedAvg = latest.graded_avg === null ? null : Number(latest.graded_avg);

  return {
    name: card.name,
    slug: card.slug,
    setName: card.set_name,
    cardNumber: card.card_number,
    category: card.category,
    pricePageUrl: `https://cardpop.com.au/prices/${card.category}/${card.slug}`,
    window: {
      from: snapshots[0].snapshot_date,
      to: latest.snapshot_date,
      days: daysBetween(snapshots[0].snapshot_date, latest.snapshot_date),
      observations: snapshots.length,
    },
    latest: {
      date: latest.snapshot_date,
      rawAvgAud: round2(rawAvg),
      rawMinAud: round2(latest.raw_min === null ? null : Number(latest.raw_min)),
      rawMaxAud: round2(latest.raw_max === null ? null : Number(latest.raw_max)),
      rawListings: latest.raw_count,
      gradedAvgAud: round2(gradedAvg),
      gradedMinAud: round2(latest.graded_min === null ? null : Number(latest.graded_min)),
      gradedMaxAud: round2(latest.graded_max === null ? null : Number(latest.graded_max)),
      gradedListings: latest.graded_count,
      // How much more a slabbed copy fetches than a raw one, right now.
      gradedPremiumMultiple:
        rawAvg && gradedAvg ? Math.round((gradedAvg / rawAvg) * 10) / 10 : null,
    },
    overWindow: {
      rawChangePct: changePct(rawSeries),
      gradedChangePct: changePct(gradedSeries),
      // A card can have snapshots with no raw observations at all (graded-only
      // listings). Spreading an empty array into Math.min/max yields ±Infinity,
      // which serialises to null in the prompt but survives as a "quotable
      // figure" — so guard on emptiness rather than on falsiness.
      rawLowAud: extreme(Math.min, rawSeries),
      rawHighAud: extreme(Math.max, rawSeries),
    },
  };
}

/**
 * Load the price evidence for a topic. Returns one entry per tracked card slug
 * that actually has snapshots, plus the narrowest window shared by all of them
 * (the honest window for any cross-card statement).
 */
export async function buildPriceContext(trackedCardSlugs = []) {
  if (trackedCardSlugs.length === 0) {
    return { cards: [], sharedWindow: null, minDays: 0 };
  }

  const { data: cards, error: cardsError } = await supabase
    .from('tracked_cards')
    .select('id, slug, name, set_name, card_number, category')
    .in('slug', trackedCardSlugs)
    .eq('active', true);
  if (cardsError) throw new Error(`Failed to load tracked cards: ${cardsError.message}`);
  if (!cards || cards.length === 0) return { cards: [], sharedWindow: null, minDays: 0 };

  const { data: snapshots, error: snapshotError } = await supabase
    .from('card_price_snapshots')
    .select(
      'card_id, snapshot_date, raw_avg, raw_min, raw_max, raw_count, graded_avg, graded_min, graded_max, graded_count',
    )
    .in(
      'card_id',
      cards.map((c) => c.id),
    )
    .order('snapshot_date', { ascending: true });
  if (snapshotError) throw new Error(`Failed to load price snapshots: ${snapshotError.message}`);

  const byCard = new Map(cards.map((c) => [c.id, []]));
  for (const snapshot of snapshots || []) {
    byCard.get(snapshot.card_id)?.push(snapshot);
  }

  const summaries = cards
    .map((card) => summariseCard(card, byCard.get(card.id) || []))
    .filter(Boolean);

  if (summaries.length === 0) return { cards: [], sharedWindow: null, minDays: 0 };

  // The shared window is the intersection: the latest start and earliest end
  // across cards. A claim spanning several cards is only true inside it.
  const from = summaries.map((s) => s.window.from).sort().pop();
  const to = summaries.map((s) => s.window.to).sort().shift();
  const minDays = Math.min(...summaries.map((s) => s.window.days));

  return {
    cards: summaries,
    sharedWindow: { from, to, days: daysBetween(from, to) },
    minDays,
  };
}

/**
 * Every AUD figure the model is allowed to quote, as strings. The validator
 * uses this to confirm the draft is actually grounded in the snapshot data
 * rather than plausible-sounding invention.
 */
export function quotableFigures(priceContext) {
  const figures = [];
  for (const card of priceContext.cards) {
    for (const value of [
      card.latest.rawAvgAud,
      card.latest.rawMinAud,
      card.latest.rawMaxAud,
      card.latest.gradedAvgAud,
      card.latest.gradedMinAud,
      card.latest.gradedMaxAud,
      card.overWindow.rawLowAud,
      card.overWindow.rawHighAud,
    ]) {
      if (typeof value === 'number') figures.push(value);
    }
  }
  return figures;
}
