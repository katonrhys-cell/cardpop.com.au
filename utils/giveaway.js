// Giveaway helpers shared by the public page, the admin page and the backend.
// Dependency-free so src/ can import it the same way the SPA does.

export const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

export const GIVEAWAY_STATUSES = ['draft', 'open', 'closed', 'drawn', 'cancelled'];

/**
 * Normalise an Instagram handle the way the DB trigger does: trim, strip a
 * leading @, lower-case. Returns '' when nothing usable is left.
 */
export function normaliseInstagramHandle(value) {
  return String(value ?? '').trim().replace(/^@+/, '').toLowerCase();
}

export const INSTAGRAM_HANDLE_RE = /^[a-z0-9._]{1,30}$/;

export function isValidInstagramHandle(value) {
  return INSTAGRAM_HANDLE_RE.test(normaliseInstagramHandle(value));
}

export function isAustralianPostcode(value) {
  return /^[0-9]{4}$/.test(String(value ?? '').trim());
}

/**
 * What the page should say right now. `status` is the admin's switch; the
 * window decides between "not yet" and "closed" while it reads `open`.
 *
 *   draft | cancelled  → 'hidden'
 *   open, before opens_at → 'upcoming'
 *   open, inside window   → 'open'
 *   open, after closes_at → 'closed'   (entries refused by the trigger too)
 *   closed                → 'closed'
 *   drawn                 → 'drawn'
 */
export function giveawayPhase(giveaway, now = new Date()) {
  if (!giveaway) return 'hidden';
  const { status } = giveaway;
  if (status === 'drawn') return 'drawn';
  if (status === 'closed') return 'closed';
  if (status !== 'open') return 'hidden';
  const t = now.getTime();
  const opens = new Date(giveaway.opens_at).getTime();
  const closes = new Date(giveaway.closes_at).getTime();
  if (Number.isFinite(opens) && t < opens) return 'upcoming';
  if (Number.isFinite(closes) && t >= closes) return 'closed';
  return 'open';
}

export function canDraw(giveaway, now = new Date()) {
  const phase = giveawayPhase(giveaway, now);
  return phase === 'closed';
}

/** The prize an entry named, or the only prize in single-prize mode. */
export function prizeForEntry(giveaway, entry) {
  const prizes = Array.isArray(giveaway?.prizes) ? giveaway.prizes : [];
  if (giveaway?.entry_mode === 'single_prize') return prizes[0] || null;
  return prizes.find((p) => p?.key === entry?.prize_key) || null;
}

/** Slug a prize label into a stable key: "Sacha Boisvert" → "sacha-boisvert". */
export function prizeKeyFromLabel(label) {
  return String(label ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Drop prizes without a label, derive missing keys, de-duplicate keys and
 * keep only the fields we store. Used by the admin form and the API.
 */
export function cleanPrizes(prizes) {
  const seen = new Set();
  const out = [];
  for (const p of Array.isArray(prizes) ? prizes : []) {
    const label = String(p?.label ?? '').trim();
    if (!label) continue;
    let key = prizeKeyFromLabel(p?.key || label);
    if (!key) continue;
    let n = 2;
    const base = key;
    while (seen.has(key)) key = `${base}-${n++}`;
    seen.add(key);
    const detail = String(p?.detail ?? '').trim();
    const image_url = String(p?.image_url ?? '').trim();
    out.push({
      key,
      label: label.slice(0, 80),
      ...(detail && { detail: detail.slice(0, 160) }),
      ...(/^https?:\/\//i.test(image_url) && { image_url: image_url.slice(0, 500) }),
    });
    if (out.length >= 12) break;
  }
  return out;
}

/** Entries counted per prize, for the admin page and the "most wanted" strip. */
export function tallyPrizePicks(giveaway, entries) {
  const prizes = Array.isArray(giveaway?.prizes) ? giveaway.prizes : [];
  const counts = Object.fromEntries(prizes.map((p) => [p.key, 0]));
  for (const e of entries || []) {
    if (e?.prize_key in counts) counts[e.prize_key] += 1;
  }
  return prizes.map((p) => ({ ...p, count: counts[p.key] }));
}
