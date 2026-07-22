import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import { resolveCardImage, cardArtLookupKey } from '../../../src/utils/cardImageResolver.js';

// Supabase override-lookup stub. Default: no override row.
function overrideBuilder(single = { data: null, error: null }) {
  const b = {};
  for (const m of ['select', 'eq', 'limit']) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(single));
  return b;
}

// Fetch response helpers modelling getJson's status handling.
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const pokemonHit = (small, large) => res(200, { data: [{ id: 'poke-1', images: { small, large } }] });
const miss404 = () => res(404, {});
const transient429 = () => res(429, {});

const ORIGINAL_ENV = { ...process.env };

// Unique card names per test keep the module-level resolver cache from leaking
// results between cases. Letter-only suffixes (no trailing digits) so parseCard
// doesn't mistake the uniquifier for a collector number.
const SUFFIXES = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj', 'kk', 'll'];
let n = 0;
const uniqueName = (base) => `${base} ${SUFFIXES[n++]}`;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  mockSupabase.from.mockReturnValue(overrideBuilder()); // no override by default
  delete process.env.CARD_ART_CDN_HOST;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('cardArtLookupKey', () => {
  it('lowercases, collapses whitespace and joins name|set|collection', () => {
    expect(cardArtLookupKey('  Charizard   EX ', 'Obsidian  Flames', 'Pokémon'))
      .toBe('charizard ex|obsidian flames|pokémon');
  });

  it('tolerates missing/non-string parts', () => {
    expect(cardArtLookupKey('Mew', undefined, null)).toBe('mew||');
    expect(cardArtLookupKey(123, 'Set', 'Col')).toBe('|set|col');
  });
});

describe('resolveCardImage', () => {
  it('returns null for a blank name without touching Supabase or the network', async () => {
    await expect(resolveCardImage({ name: '   ' })).resolves.toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('an admin override wins and short-circuits the upstream APIs', async () => {
    const url = 'https://cdn.supabase.co/storage/v1/object/public/media/art.png';
    mockSupabase.from.mockReturnValueOnce(overrideBuilder({ data: { image_url: url }, error: null }));

    const result = await resolveCardImage({ name: uniqueName('Custom Sports Card'), collection: 'NBA' });
    expect(result).toMatchObject({ small: url, large: url, source: 'override' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolves Pokémon art and strips the collector number/variant from the query', async () => {
    fetch.mockResolvedValueOnce(pokemonHit('https://images.pokemontcg.io/s.png', 'https://images.pokemontcg.io/l.png'));

    const result = await resolveCardImage({ name: `${uniqueName('Pikachu VMAX')} 044/185`, collection: 'Pokémon' });
    expect(result).toMatchObject({
      small: 'https://images.pokemontcg.io/s.png',
      large: 'https://images.pokemontcg.io/l.png',
      source: 'pokemon-tcg',
    });
    // Only the Pokémon API is queried for a Pokémon card, and the query carries
    // the parsed name + un-padded number (44, not 044).
    const url = decodeURIComponent(fetch.mock.calls[0][0]);
    expect(url).toContain('api.pokemontcg.io');
    expect(url).toContain('number:44');
  });

  it('routes Magic cards to Scryfall', async () => {
    fetch.mockResolvedValueOnce(res(200, { id: 'scry-1', image_uris: { small: 'https://cards.scryfall.io/s.jpg', normal: 'https://cards.scryfall.io/n.jpg' } }));
    const result = await resolveCardImage({ name: uniqueName('Black Lotus'), collection: 'Magic: The Gathering' });
    expect(result).toMatchObject({ source: 'scryfall', small: 'https://cards.scryfall.io/s.jpg', large: 'https://cards.scryfall.io/n.jpg' });
    expect(fetch.mock.calls[0][0]).toContain('api.scryfall.com/cards/named');
  });

  it('routes Yu-Gi-Oh! cards to YGOPRODeck', async () => {
    fetch.mockResolvedValueOnce(res(200, { data: [{ id: 46986414, card_images: [{ image_url_small: 'https://images.ygoprodeck.com/s.jpg', image_url: 'https://images.ygoprodeck.com/l.jpg' }] }] }));
    const result = await resolveCardImage({ name: uniqueName('Dark Magician'), collection: 'Yu-Gi-Oh!' });
    expect(result).toMatchObject({ source: 'yugioh-api', small: 'https://images.ygoprodeck.com/s.jpg' });
    expect(fetch.mock.calls[0][0]).toContain('ygoprodeck.com');
  });

  it('caches a genuine miss (every upstream reachable) so it is not re-fetched', async () => {
    // Unknown collection tries all three APIs; each returns an honest 404.
    fetch.mockResolvedValue(miss404());
    const name = uniqueName('No Such Card');

    expect(await resolveCardImage({ name })).toBeNull();
    const callsAfterFirst = fetch.mock.calls.length;
    expect(callsAfterFirst).toBe(3); // pokemon + scryfall + yugioh

    expect(await resolveCardImage({ name })).toBeNull();
    expect(fetch.mock.calls.length).toBe(callsAfterFirst); // served from the negative cache
  });

  it('does NOT cache a transient upstream failure — the next call retries', async () => {
    fetch.mockResolvedValue(transient429());
    const name = uniqueName('Charizard');

    expect(await resolveCardImage({ name, collection: 'Pokémon' })).toBeNull();
    const afterFirst = fetch.mock.calls.length;

    expect(await resolveCardImage({ name, collection: 'Pokémon' })).toBeNull();
    expect(fetch.mock.calls.length).toBeGreaterThan(afterFirst); // retried, not cached
  });

  it('rewrites resolved art onto the card-art CDN when CARD_ART_CDN_HOST is set', async () => {
    process.env.CARD_ART_CDN_HOST = 'img.cardpop.com.au';
    const upstream = 'https://images.pokemontcg.io/s.png';
    fetch.mockResolvedValueOnce(pokemonHit(upstream, upstream));

    const result = await resolveCardImage({ name: uniqueName('Mew ex'), collection: 'Pokémon' });
    expect(result.small).toBe(`https://img.cardpop.com.au/card-art?src=${encodeURIComponent(upstream)}`);
  });
});
