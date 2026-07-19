// Server-side card-art resolver.
//
// Resolves official card art for a card (name / set / collection) from the free
// public card APIs the catalog already uses — Pokémon TCG (pokemontcg.io),
// Scryfall (Magic), and YGOPRODeck (Yu-Gi-Oh). The images those APIs return are
// served from their OWN CDNs, so populated art costs nothing against our metered
// Supabase egress quota (see docs/image-cdn.md for why that matters).
//
// Why resolve server-side instead of in the browser (as utils/pokemonCardImage.js
// does for the analytics card page): the movers/watchlist tables render many
// cards at once, and a per-visitor client lookup hammers the keyless pokemontcg.io
// API — which is rate limited per IP — producing throttling and missing art on a
// busy page. Resolving here means the upstream lookup happens once, is shared and
// cached across ALL visitors, and the browser only ever loads a ready image URL.
//
// Resolution never throws: a miss or an upstream failure resolves to null and the
// UI keeps its placeholder.

import logger from './logger.js';
import supabase from './supabaseClient.js';

const FETCH_TIMEOUT_MS = 8000;

// Card art effectively never changes, so cache aggressively. A positive result
// is a small object; the key space is bounded by the set of cards we surface.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;     // 6h — retry genuine misses sooner
const MAX_ENTRIES = 2000;
const cache = new Map(); // key -> { value, expiresAt }

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key, value, ttl) {
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
    // Map preserves insertion order — deleting the first key evicts the oldest.
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

// Optional free Pokémon TCG API key raises the keyless rate limit; not required.
const POKEMON_API_KEY =
  process.env.POKEMONTCG_API_KEY || process.env.VITE_POKEMONTCG_API_KEY || '';

// Optional: serve resolved card art through our own image CDN/R2 instead of
// hotlinking the upstream API CDNs, so we're insulated from their uptime (see
// cloudflare/image-proxy-worker.js → /card-art). Off by default — when
// CARD_ART_CDN_HOST is unset the resolver returns the raw upstream URLs exactly
// as before. Gated on its OWN var (not the always-on IMAGE_CDN_HOST) so it can
// be switched on only AFTER the Worker carrying the /card-art route is live,
// avoiding a deploy-order race. Only these hosts are rewritten — they must match
// the Worker's CARD_ART_HOSTS allowlist.
const CARD_ART_CDN_HOSTS = new Set([
  'images.pokemontcg.io',
  'cards.scryfall.io',
  'images.ygoprodeck.com',
]);

// Rewrite an upstream card-art URL onto the configured CDN host. Read the env at
// call time (not module load) so the switch takes effect without a cold start
// and stays trivially testable. Returns the URL unchanged when the CDN is off,
// the input is falsy, or the host isn't one we proxy.
function toCardArtCdn(imageUrl) {
  const host = (process.env.CARD_ART_CDN_HOST || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!host || !imageUrl) return imageUrl;
  try {
    if (!CARD_ART_CDN_HOSTS.has(new URL(imageUrl).host)) return imageUrl;
    return `https://${host}/card-art?src=${encodeURIComponent(imageUrl)}`;
  } catch {
    return imageUrl;
  }
}

// Apply the CDN rewrite to a resolved result's image URLs. The module cache
// stores canonical upstream URLs; wrapping happens on the way out so toggling
// the CDN never serves a stale-host cache entry.
function withCardArtCdn(result) {
  if (!result) return result;
  return { ...result, small: toCardArtCdn(result.small), large: toCardArtCdn(result.large) };
}

// ── Admin card-art overrides ────────────────────────────────────────────────
//
// Admins can upload art for cards the free APIs don't cover (sports cards) or to
// override any card's art (table card_art_overrides). We check it FIRST, so an
// override always wins and non-Pokémon/Magic/Yu-Gi-Oh cards can still get art.

// Normalized match key for a card. MUST stay identical to what the admin write
// path stores (src/routes/admin.js imports this exact function), or overrides
// won't match. Deliberately simple: lowercased, whitespace-collapsed
// name|set|collection — the admin enters the same strings the card displays.
export function cardArtLookupKey(name, set, collection) {
  const norm = (s) => (typeof s === 'string' ? s : '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${norm(name)}|${norm(set)}|${norm(collection)}`;
}

// Override art lives in the public Supabase `media` bucket. When an image CDN is
// configured, rewrite the stored Supabase URL onto it (path unchanged) so the
// override is served through the Worker/R2 like every other stored image,
// instead of hitting Supabase egress on each view.
function toStorageCdn(url) {
  const host = (process.env.IMAGE_CDN_HOST || process.env.VITE_IMAGE_CDN_HOST || '')
    .trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!host || !url) return url;
  try {
    const u = new URL(url);
    if (!/\/storage\/v1\/object\/public\//.test(u.pathname)) return url;
    return `https://${host}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

// Overrides change (admins add/remove them), so cache them only briefly — long
// enough to spare the DB a query per card on a page load, short enough that a new
// override shows up promptly. Fail-safe: any DB error resolves to null (no
// override) so resolution falls through to the free APIs.
const OVERRIDE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function lookupOverride(name, set, collection) {
  const lookupKey = cardArtLookupKey(name, set, collection);
  const cacheKey = `ov:${lookupKey}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  let result = null;
  try {
    const { data, error } = await supabase
      .from('card_art_overrides')
      .select('image_url')
      .eq('lookup_key', lookupKey)
      .limit(1)
      .maybeSingle();
    if (!error && data?.image_url) {
      const url = toStorageCdn(data.image_url);
      result = { small: url, large: url, id: `override:${lookupKey}`, source: 'override' };
    }
  } catch (err) {
    logger.debug(`[CARD_IMAGE] override lookup failed for "${lookupKey}": ${err.message}`);
    result = null; // fail-safe → fall through to the free APIs
  }

  cacheSet(cacheKey, result, OVERRIDE_TTL_MS);
  return result;
}

// "Charizard VSTAR 018/172"                  → { name: 'Charizard VSTAR', number: '18' }
// "Charizard ex (Special Illustration Rare)" → { name: 'Charizard ex', number: null }
// "Charizard Holo (Base Set)"                → { name: 'Charizard', number: null }
// Curated display names embed rarity/variant/print labels and collector numbers
// that aren't part of the card's actual name in the upstream APIs — strip them or
// the (exact-phrase) name filters match nothing.
function parseCard(raw) {
  let name = (raw || '').trim();
  let number = null;

  name = name.replace(/\s*\([^)]*\)/g, ' ');        // parenthetical labels
  name = name.replace(/\bholo(?:foil)?\b/gi, ' ');  // bare print qualifier

  const slash = name.match(/\b(\d+)\s*\/\s*\d+\b/);  // 018/172 collector number
  if (slash) {
    number = String(parseInt(slash[1], 10));         // API numbers aren't zero-padded
    name = name.replace(slash[0], '');
  } else {
    const trailing = name.match(/\s(\d{1,4})$/);      // bare trailing number
    if (trailing) {
      number = String(parseInt(trailing[1], 10));
      name = name.slice(0, trailing.index);
    }
  }

  return { name: name.replace(/\s+/g, ' ').trim(), number };
}

// Which upstream API(s) to try for a given collection, most-likely first. An
// unknown/empty collection falls through to all three.
function apisFor(collection) {
  const col = (collection || '').toLowerCase();
  if (/pok[eé]mon/.test(col)) return ['pokemon'];
  if (/magic|mtg/.test(col)) return ['scryfall'];
  if (/yu-?gi-?oh/.test(col)) return ['yugioh'];
  return ['pokemon', 'scryfall', 'yugioh'];
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  // 429 / 5xx are "couldn't reach the data", distinct from an honest 404 miss.
  if (res.status === 429 || res.status >= 500) {
    const err = new Error(`upstream ${res.status}`);
    err.transient = true;
    throw err;
  }
  if (!res.ok) return null; // 4xx (e.g. no such card) — an honest miss
  return res.json();
}

const esc = (s) => s.replace(/"/g, '\\"');

// Each resolver returns { small, large, id, source } | null, and throws with
// err.transient = true when the upstream was unreachable (so the caller can
// avoid caching a negative that would blank the card until the TTL expires).

async function resolvePokemon(name, set, number) {
  const queries = [];
  if (name && number && set) queries.push(`name:"${esc(name)}" set.name:"${esc(set)}" number:${number}`);
  if (name && number)        queries.push(`name:"${esc(name)}" number:${number}`);
  if (name && set)           queries.push(`name:"${esc(name)}" set.name:"${esc(set)}"`);
  if (name)                  queries.push(`name:"${esc(name)}"`);

  const headers = POKEMON_API_KEY ? { 'X-Api-Key': POKEMON_API_KEY } : {};
  for (const q of queries) {
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1&select=id,images`;
    const json = await getJson(url, headers); // may throw transient
    const card = json?.data?.[0];
    if (card?.images?.small) {
      return { small: card.images.small, large: card.images.large || card.images.small, id: card.id, source: 'pokemon-tcg' };
    }
  }
  return null;
}

async function resolveScryfall(name) {
  // Fuzzy named lookup is more precise than search for a single best match.
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const card = await getJson(url); // 404 for no match → null
  const imgs = card?.image_uris || card?.card_faces?.[0]?.image_uris;
  if (imgs?.small) {
    return { small: imgs.small, large: imgs.normal || imgs.large || imgs.small, id: card.id, source: 'scryfall' };
  }
  return null;
}

async function resolveYugioh(name) {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name)}&num=1&offset=0`;
  const json = await getJson(url); // 400 for no match → null
  const imgs = json?.data?.[0]?.card_images?.[0];
  if (imgs?.image_url_small) {
    return { small: imgs.image_url_small, large: imgs.image_url || imgs.image_url_small, id: String(json.data[0].id), source: 'yugioh-api' };
  }
  return null;
}

/**
 * Resolve official card art. Resolves to { small, large, id, source } | null.
 * Never rejects.
 *
 * @param {{name?: string, set?: string, collection?: string}} card
 */
export async function resolveCardImage({ name, set, collection } = {}) {
  const rawName = (name || '').trim();
  if (!rawName) return null;

  // An admin-uploaded override always wins — and covers cards (sports etc.) the
  // free APIs can't. Checked before the API cache so a newly-added override
  // supersedes an already-cached API result within its short TTL.
  const override = await lookupOverride(rawName, set, collection);
  if (override) return override;

  const key = `${rawName}|${set || ''}|${collection || ''}`.toLowerCase();
  const cached = cacheGet(key);
  if (cached !== undefined) return withCardArtCdn(cached);

  const parsed = parseCard(rawName);
  if (!parsed.name) {
    cacheSet(key, null, NEGATIVE_TTL_MS);
    return null;
  }

  let transient = false;
  for (const api of apisFor(collection)) {
    try {
      let result = null;
      if (api === 'pokemon') result = await resolvePokemon(parsed.name, set, parsed.number);
      else if (api === 'scryfall') result = await resolveScryfall(parsed.name);
      else if (api === 'yugioh') result = await resolveYugioh(parsed.name);
      if (result) {
        cacheSet(key, result, CACHE_TTL_MS); // cache canonical upstream URLs
        return withCardArtCdn(result);
      }
    } catch (err) {
      // Transient (429/5xx/timeout/network) — remember so we don't cache a null.
      if (err?.transient || err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        transient = true;
      }
      logger.debug(`[CARD_IMAGE] ${api} lookup failed for "${parsed.name}": ${err.message}`);
    }
  }

  // Only cache a negative when every upstream was actually reachable and simply
  // had no match. Caching a null after a transient failure would blank this
  // card's art until the TTL expired, so leave it uncached to retry next time.
  if (!transient) cacheSet(key, null, NEGATIVE_TTL_MS);
  return null;
}

export default resolveCardImage;
