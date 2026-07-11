import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPokemonCardImage } from '@/utils/pokemonCardImage.js';

// Each test uses a unique card name so the module-level (and sessionStorage)
// cache never bleeds a previous result into the next assertion.
beforeEach(() => {
  try { sessionStorage.clear(); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

// Capture the `name:"..."` phrase from the first request the lookup issues.
const nameFilterOf = (calls) => {
  const url = decodeURIComponent(String(calls[0][0]));
  return url.match(/name:"([^"]*)"/)?.[1] ?? null;
};

const mockFetchReturning = (image) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ data: image ? [{ id: 'x', images: image }] : [] }),
  });

describe('fetchPokemonCardImage — name normalisation', () => {
  it('strips a parenthetical rarity label before querying', async () => {
    const fetchSpy = mockFetchReturning({ small: 's.png', large: 'l.png' });
    const res = await fetchPokemonCardImage('Charizard ex (Special Illustration Rare)', 'Obsidian Flames');

    expect(nameFilterOf(fetchSpy.mock.calls)).toBe('Charizard ex');
    expect(res).toEqual({ small: 's.png', large: 'l.png', id: 'x' });
  });

  it('strips parenthetical + bare "Holo" print qualifier', async () => {
    const fetchSpy = mockFetchReturning({ small: 's.png', large: 'l.png' });
    await fetchPokemonCardImage('Charizard Holo (Base Set)', 'Base Set');

    expect(nameFilterOf(fetchSpy.mock.calls)).toBe('Charizard');
  });

  it('still extracts the collector number from a slashed name', async () => {
    const fetchSpy = mockFetchReturning({ small: 's.png', large: 'l.png' });
    await fetchPokemonCardImage('Charizard VSTAR 018/172', 'Brilliant Stars');

    const url = decodeURIComponent(String(fetchSpy.mock.calls[0][0]));
    expect(url).toContain('name:"Charizard VSTAR"');
    expect(url).toContain('number:18');
  });

  it('resolves to null (keeps the placeholder) when nothing matches', async () => {
    mockFetchReturning(null);
    const res = await fetchPokemonCardImage('Nonexistent Card (Ultra Rare)', 'Nowhere');
    expect(res).toBeNull();
  });

  it('does not cache a null after a transient failure, so a retry can succeed', async () => {
    // First lookup: every query hits a network error → null, but this must NOT
    // be cached (a rate-limit/network blip should not permanently blank the art).
    const failSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const first = await fetchPokemonCardImage('Snorlax VMAX 141/185', 'Vivid Voltage');
    expect(first).toBeNull();
    failSpy.mockRestore();

    // Second lookup for the SAME card now succeeds — it must hit the API again
    // rather than return a poisoned cached null.
    const okSpy = mockFetchReturning({ small: 's.png', large: 'l.png' });
    const second = await fetchPokemonCardImage('Snorlax VMAX 141/185', 'Vivid Voltage');
    expect(okSpy).toHaveBeenCalled();
    expect(second).toEqual({ small: 's.png', large: 'l.png', id: 'x' });
  });
});
