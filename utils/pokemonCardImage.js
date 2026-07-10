// Official Pokémon card art from the Pokémon TCG API (pokemontcg.io).
//
// The analytics card pages only had a text placeholder for card art. This
// looks up the real card image by name/set/number. The API is free (keyless by
// default; an optional free key raises rate limits) and — importantly — serves
// its images from its own CDN (images.pokemontcg.io), so populated card art
// costs nothing against our metered Supabase egress quota. See docs/image-cdn.md
// for why Supabase-hosted images are the expensive path we avoid here.
//
// Only Pokémon cards are covered; callers should gate on collection === Pokémon
// and fall back to the existing placeholder when this returns null.

const API = 'https://api.pokemontcg.io/v2/cards';

// Optional free API key (https://dev.pokemontcg.io) raises the rate limit from
// ~1,000/day (keyless) to 20,000/day. Not required — blank works fine.
const API_KEY = import.meta.env?.VITE_POKEMONTCG_API_KEY || '';

// Module-level cache: one lookup per card for the life of the SPA session.
const memCache = new Map();

// Best-effort persistence across reloads. Wrapped because sessionStorage can be
// unavailable (privacy mode) or throw on quota.
const SS_PREFIX = 'pkmnimg:';
const readSession = (key) => {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};
const writeSession = (key, value) => {
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore — cache is an optimisation, not a requirement
  }
};

// "Charizard VSTAR 018/172"                  → { name: 'Charizard VSTAR', number: '18' }
// "Mew ex 151/165"                           → { name: 'Mew ex', number: '151' }
// "Charizard ex (Special Illustration Rare)" → { name: 'Charizard ex', number: null }
// "Charizard Holo (Base Set)"                → { name: 'Charizard', number: null }
// "Pikachu"                                  → { name: 'Pikachu', number: null }
const parseCard = (raw) => {
  let name = (raw || '').trim();
  let number = null;

  // Curated display names embed rarity/variant/print labels that aren't part of
  // the card's actual name in the TCG API. Drop them before querying, or the
  // (exact-phrase) name filter matches nothing and the lookup returns null:
  //   parenthetical labels — "(Special Illustration Rare)", "(Rainbow Rare)",
  //     "(Alt Art)", "(Base Set)"
  //   bare print qualifiers — a trailing/standalone "Holo"
  name = name.replace(/\s*\([^)]*\)/g, ' ');
  name = name.replace(/\bholo(?:foil)?\b/gi, ' ');

  const slash = name.match(/\b(\d+)\s*\/\s*\d+\b/); // 018/172 collector number
  if (slash) {
    number = String(parseInt(slash[1], 10)); // API numbers aren't zero-padded
    name = name.replace(slash[0], '');
  } else {
    const trailing = name.match(/\s(\d{1,4})$/); // bare trailing number
    if (trailing) {
      number = String(parseInt(trailing[1], 10));
      name = name.slice(0, trailing.index);
    }
  }

  return { name: name.replace(/\s+/g, ' ').trim(), number };
};

const esc = (s) => s.replace(/"/g, '\\"');

// Most-specific query first, loosening on each fallback so we still surface a
// plausible image when the set name or number doesn't match exactly.
const buildQueries = (name, set, number) => {
  const q = [];
  if (name && number && set) q.push(`name:"${esc(name)}" set.name:"${esc(set)}" number:${number}`);
  if (name && number)        q.push(`name:"${esc(name)}" number:${number}`);
  if (name && set)           q.push(`name:"${esc(name)}" set.name:"${esc(set)}"`);
  if (name)                  q.push(`name:"${esc(name)}"`);
  return q;
};

/**
 * Look up official card art. Resolves to
 *   { small, large, id } | null
 * Never rejects — network/parse failures resolve to null so the UI just keeps
 * its placeholder.
 */
export const fetchPokemonCardImage = async (rawName, set) => {
  const cacheKey = `${rawName || ''}|${set || ''}`;

  if (memCache.has(cacheKey)) return memCache.get(cacheKey);
  const persisted = readSession(cacheKey);
  if (persisted !== undefined) {
    memCache.set(cacheKey, persisted);
    return persisted;
  }

  const { name, number } = parseCard(rawName);
  const finish = (result) => {
    memCache.set(cacheKey, result);
    writeSession(cacheKey, result);
    return result;
  };

  if (!name) return finish(null);

  const headers = API_KEY ? { 'X-Api-Key': API_KEY } : {};

  for (const q of buildQueries(name, set, number)) {
    try {
      const url = `${API}?q=${encodeURIComponent(q)}&pageSize=1&select=id,images`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const json = await res.json();
      const card = json?.data?.[0];
      if (card?.images?.small) {
        return finish({
          small: card.images.small,
          large: card.images.large || card.images.small,
          id: card.id,
        });
      }
    } catch {
      // try the next, looser query
    }
  }

  return finish(null);
};

export default fetchPokemonCardImage;
