// Player pages: the dependency-free helpers shared by the SPA, api/prerender.js
// and api/sitemap.js. Nothing here touches Supabase or React — see
// lib/players.js for the queries and docs/players.md for the feature.

export const PLAYERS_PATH = '/players';

/** Canonical path of a player's page. */
export const playerPath = (slugOrPlayer) => {
  const slug = typeof slugOrPlayer === 'string' ? slugOrPlayer : slugOrPlayer?.slug;
  return slug ? `${PLAYERS_PATH}/${slug}` : PLAYERS_PATH;
};

/** Turn a name into the slug the DB accepts (`^[a-z0-9]+(-[a-z0-9]+)*$`). */
export const playerSlug = (name = '') =>
  foldDiacritics(String(name))
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "Luka Dončić" → "LD"; "Tiger Woods" → "TW". Avatar fallback. */
export const playerInitials = (name = '') =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Strip accents so "Doncic" finds "Dončić". */
export const foldDiacritics = (s = '') =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

const norm = (s) => foldDiacritics(s).toLowerCase().trim();

/**
 * Score one player against a typed query. 0 = no match. Higher is better:
 * a name that starts with the query beats one that merely contains it, a
 * full-name prefix beats a surname prefix, and an alias match sits in between.
 */
export function playerMatchScore(player, query) {
  const q = norm(query);
  if (!q) return 0;
  const name = norm(player?.name || '');
  if (!name) return 0;
  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  const words = name.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 80;
  const aliases = (player.aliases || []).map(norm);
  if (aliases.some((a) => a === q)) return 75;
  if (aliases.some((a) => a.startsWith(q))) return 70;
  // Every typed word must appear somewhere in the name (handles "james lebron").
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => name.includes(t))) return 60;
  if (name.includes(q)) return 50;
  if (aliases.some((a) => a.includes(q))) return 40;
  const team = norm(player.team || '');
  if (team && team.includes(q)) return 20;
  return 0;
}

/**
 * Rank a list of players against a query. With an empty query the list comes
 * back in its stored order (sort_order, then name), trimmed to `limit`.
 */
export function matchPlayers(players = [], query = '', limit = 8) {
  const list = Array.isArray(players) ? players : [];
  if (!norm(query)) return list.slice(0, limit);
  return list
    .map((p) => ({ p, score: playerMatchScore(p, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.p.sort_order ?? 100) - (b.p.sort_order ?? 100) || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(({ p }) => p);
}

/** Plain-text bio → paragraphs (blank-line separated). */
export const splitParagraphs = (text = '') =>
  String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);

/** Group players by sport, keeping the stored order inside each group. */
export function groupPlayersBySport(players = []) {
  const groups = new Map();
  for (const p of players) {
    const key = p.sport || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()].map(([sport, items]) => ({ sport, players: items }));
}

/** Normalise the admin form's key-cards rows: drop blanks, trim strings. */
export const cleanKeyCards = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((r) => ({ name: String(r?.name || '').trim(), note: String(r?.note || '').trim() }))
    .filter((r) => r.name);

/** "MJ, Air Jordan" → ["MJ", "Air Jordan"]. */
export const parseAliases = (text = '') =>
  String(text || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);

/** One-line "sport · team · position" for cards and search results. */
export const playerSubtitle = (p) =>
  [p?.sport, p?.team, p?.position].filter(Boolean).join(' · ');

// ─── SEO ─────────────────────────────────────────────────────────────────────
// One source for the <title> / meta description of the player pages, used by
// the SPA (SEOHead) and api/prerender.js alike so bots and browsers agree.

export const SEO_TITLE_MAX = 60;   // Google shows ~60 characters of a title.
export const SEO_DESCRIPTION_MAX = 155;

export const PLAYERS_INDEX_SEO = {
  title: 'Player Cards – The Most Collected Athletes | CardPop',
  description: 'Player pages for the most collected athletes: a short profile, key rookie cards, live Australian-dollar prices and every card of theirs listed on CardPop.',
};

/** Cut at a word boundary and add an ellipsis; never longer than `max`. */
export const truncateAt = (text = '', max = SEO_DESCRIPTION_MAX) => {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:–-]+$/, '')}…`;
};

/**
 * <title> and meta description for a player page. The title degrades to
 * shorter forms for long names so it stays inside Google's cutoff; the
 * description leads with the name and sport, then the headline.
 */
export function playerSeo(player) {
  const name = String(player?.name || 'Player').trim();
  const brand = ' | CardPop';
  const forms = [
    `${name} Cards – Rookie Cards & Prices${brand}`,
    `${name} Cards & Prices${brand}`,
    `${name} Cards${brand}`,
  ];
  const title = forms.find((t) => t.length <= SEO_TITLE_MAX) || forms[forms.length - 1];

  const where = [player?.sport, player?.team].filter(Boolean).join(', ');
  const lead = where ? `${name} (${where})` : name;
  const tail = `Key cards, AUD prices and every ${name} card on CardPop.`;
  const headline = String(player?.headline || '').trim();
  let description = headline ? `${lead}: ${headline} ${tail}` : `${lead}: ${tail}`;
  if (description.length > SEO_DESCRIPTION_MAX) {
    description = truncateAt(headline ? `${lead}: ${headline}` : description, SEO_DESCRIPTION_MAX);
  }
  return { title, description };
}

const enAuDate = (isoDate) => {
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? String(isoDate)
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * The FAQ block on a player page: visible copy and FAQPage JSON-LD share it.
 * Every figure comes from the tracker snapshot handed in — nothing is typed.
 *
 * @param {object}   opts.player         players row
 * @param {object[]} opts.trackedCards   [{ name, latest: { snapshot_date, raw_avg, graded_avg } }]
 * @param {number}   opts.listingCount   live listings tagged with the player
 * @param {Function} opts.formatPrice    number → "A$120.50"
 */
export function playerFaqs({ player, trackedCards = [], listingCount = 0, formatPrice = (v) => `$${v}` }) {
  const name = String(player?.name || 'this player').trim();
  const faqs = [];

  const keyCards = Array.isArray(player?.key_cards) ? player.key_cards.filter((c) => c?.name) : [];
  if (keyCards.length) {
    const first = keyCards[0];
    faqs.push({
      q: `What is ${name}'s rookie card?`,
      a: `The card collectors treat as the key ${name} rookie card is the ${first.name}.${first.note ? ` ${first.note}` : ''}${keyCards.length > 1 ? ` Other cards worth knowing: ${keyCards.slice(1).map((c) => c.name).join('; ')}.` : ''}`,
    });
  }

  const priced = trackedCards.find((c) => c?.latest && (c.latest.raw_avg != null || c.latest.graded_avg != null));
  if (priced) {
    const { latest } = priced;
    const parts = [];
    if (latest.raw_avg != null) parts.push(`around ${formatPrice(latest.raw_avg)} ungraded`);
    if (latest.graded_avg != null) parts.push(`about ${formatPrice(latest.graded_avg)} graded`);
    faqs.push({
      q: `How much are ${name} cards worth in Australia?`,
      a: `It depends on the card, year and grade. As at ${enAuDate(latest.snapshot_date)}, ${priced.name} lists for ${parts.join(' and ')} in Australian dollars. CardPop refreshes these prices daily from live listings.`,
    });
  } else {
    faqs.push({
      q: `How much are ${name} cards worth in Australia?`,
      a: `It depends on the card, year and grade. CardPop tracks live Australian-dollar prices for the most traded ${name} cards and shows them on this page as the data builds.`,
    });
  }

  faqs.push({
    q: `Where can I buy ${name} cards in Australia?`,
    a: `On the CardPop marketplace, from Australian sellers with buyer protection.${listingCount > 0 ? ` ${listingCount} ${name} listing${listingCount === 1 ? ' is' : 's are'} live right now.` : ` New ${name} cards appear here as sellers list them.`}`,
  });

  return faqs;
}

/**
 * Players whose sport matches a collection, given any of its names: the
 * marketplace collection name ("NBA"), the SEO page name ("NBA Cards"), the
 * URL slug ("nba", "formula-1") or an alias. Comparison is on a slug with a
 * trailing "cards" dropped, so "Formula 1 Cards" and "Formula 1" agree.
 */
const sportKey = (s) => playerSlug(String(s || '').replace(/\s+cards?\s*$/i, ''));
export function playersForSport(players = [], names = []) {
  const wanted = new Set((Array.isArray(names) ? names : [names]).filter(Boolean).map(sportKey).filter(Boolean));
  if (!wanted.size) return [];
  return (Array.isArray(players) ? players : []).filter((p) => wanted.has(sportKey(p?.sport)));
}

/** "2003" + "2003-04 Topps Chrome" → "2003-04 Topps Chrome" (no doubled year). */
export const listingMeta = (year, setName) => {
  const y = year ? String(year).trim() : '';
  const s = setName ? String(setName).trim() : '';
  if (s && y && s.includes(y)) return s;
  return [y, s].filter(Boolean).join(' ');
};
