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
    .map((r) => {
      const row = { name: String(r?.name || '').trim(), note: String(r?.note || '').trim() };
      const image = keyCardImage(r);
      if (image) row.image_url = image;
      return row;
    })
    .filter((r) => r.name);

/**
 * A key card's optional photo: an `http(s)` URL or a site-relative path such
 * as `/images/players/...` (the public/ folder). Anything else is dropped so
 * a row can't inject `javascript:` or protocol-relative URLs into the page.
 */
export const keyCardImage = (card) => {
  const url = String(card?.image_url || '').trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return null;
};

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

/** A `YYYY-MM-DD` date of birth that is a real calendar day in the DB's range. */
export const isValidBirthDate = (iso = '') => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1850 || y > 2100) return false;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
};

/**
 * The "Born" fact: the full date ("30 December 1984") when it is known, else
 * the year, else null. Formatted in UTC so the day never shifts with the
 * reader's time zone.
 */
export const formatBorn = (player) => {
  const iso = player?.born_on;
  if (iso && isValidBirthDate(iso)) {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
  }
  return player?.born_year ?? null;
};
