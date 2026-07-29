import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockStream = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/integratedAiClient', () => ({
  integratedAiClient: { stream: mockStream, fetch: mockFetch },
  default: { stream: mockStream, fetch: mockFetch },
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

// useCardOCR only needs COLLECTIONS_LIST from Header — avoid pulling in the real component tree
vi.mock('@/components/Header.jsx', () => ({
  COLLECTIONS_LIST: ['NBA Basketball', 'One Piece', 'Pokemon'],
}));

import { useCardOCR } from '@/hooks/useCardOCR.js';

// ─── SSE stream helpers ──────────────────────────────────────────────────────

const contentEvent = (text) => ({ type: 'content', data: { content: text } });
const completedEvent = { type: 'completed', data: { content: '[COMPLETED]' } };
const errorEvent = (msg) => ({ type: 'error', data: { content: msg } });

/**
 * Builds a fetch-Response-like object whose body streams the given SSE events,
 * optionally split into byte chunks of `chunkSize` to exercise buffering across
 * chunk boundaries.
 */
function sseResponse(events, { chunkSize, raw } = {}) {
  const payload = raw ?? events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(payload);
  const size = chunkSize ?? bytes.length;
  const chunks = [];
  for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.slice(i, i + size));

  let idx = 0;
  return {
    body: {
      getReader: () => ({
        read: async () =>
          idx < chunks.length
            ? { done: false, value: chunks[idx++] }
            : { done: true, value: undefined },
        cancel: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
}

const FILE = new File(['fake-image-bytes'], 'card.jpg', { type: 'image/jpeg' });

/** Runs a full scan where the AI streams `cardJson` and returns the mapped result. */
async function runScan(cardJson, streamOpts = {}) {
  const json = JSON.stringify(cardJson);
  // Split the JSON across several content events like a real token stream
  const mid = Math.floor(json.length / 2);
  mockStream.mockResolvedValue(
    sseResponse([contentEvent(json.slice(0, mid)), contentEvent(json.slice(mid)), completedEvent], streamOpts),
  );

  const { result } = renderHook(() => useCardOCR());
  await act(async () => { await result.current.scanCard(FILE); });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: catalogue lookup finds nothing, so OCR fields pass through unchanged.
  mockFetch.mockResolvedValue({ results: [] });
});

// ─── Happy path & stream handling ────────────────────────────────────────────

describe('useCardOCR — scanning', () => {
  it('parses a streamed scan result and maps all fields', async () => {
    const result = await runScan({
      name: 'Charizard',
      description: 'Holo fire Pokémon',
      cardSetName: 'Base Set',
      cardNumber: '4/102',
      releaseYear: 1999,
      collectionType: 'Pokemon',
      condition: 'Near Mint',
      gradingService: 'PSA',
      gradeScore: 9,
      certificationNumber: '12345678',
      rarity: 'Holographic',
      cardType: 'Fire',
      brand: 'Wizards of the Coast',
    });

    expect(result.current.scanResult).toEqual({
      name: 'Charizard',
      description: 'Holo fire Pokémon',
      cardSetName: 'Base Set',
      // The insert/subset within the product — blank on a base card.
      insertName: '',
      cardNumber: '4/102',
      releaseYear: '1999',
      collectionType: 'Pokemon',
      condition: 'Near Mint',
      gradingService: 'PSA',
      gradeScore: '9',
      certificationNumber: '12345678',
      rarity: 'Holographic',
      cardType: 'Fire',
      // Rookie designation as printed — blank when the card carries no marking.
      rookie: '',
      // Treatments read off the card, and the printed print-run serial.
      attributes: [],
      serialNumber: '',
      brand: 'Wizards of the Coast',
      series: 'Base Set',
      confidence: null,
      candidateSets: [],
    });
    expect(mockToast.success).toHaveBeenCalled();
    expect(result.current.isScanning).toBe(false);
  });

  it('handles SSE events split across arbitrary chunk boundaries', async () => {
    // 7-byte chunks force every event to span multiple reads
    const result = await runScan({ name: 'Pikachu', condition: 'Mint' }, { chunkSize: 7 });
    expect(result.current.scanResult.name).toBe('Pikachu');
    expect(result.current.scanResult.condition).toBe('Mint');
  });

  it('extracts JSON when the AI wraps it in prose', async () => {
    const json = JSON.stringify({ name: 'Blastoise', condition: 'Excellent' });
    mockStream.mockResolvedValue(sseResponse([
      contentEvent('Here is the card data:\n```json\n'),
      contentEvent(json),
      contentEvent('\n```\nLet me know if you need anything else!'),
      completedEvent,
    ]));

    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(FILE); });

    expect(result.current.scanResult.name).toBe('Blastoise');
  });

  it('stops reading at the completed event', async () => {
    const json = JSON.stringify({ name: 'Mew' });
    mockStream.mockResolvedValue(sseResponse([
      contentEvent(json),
      completedEvent,
      contentEvent('{"name":"GARBAGE AFTER COMPLETION"}'),
    ]));

    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(FILE); });

    expect(result.current.scanResult.name).toBe('Mew');
  });

  it('does nothing when called without a file', async () => {
    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(null); });

    expect(mockStream).not.toHaveBeenCalled();
    expect(result.current.scanResult).toBeNull();
  });

  it('sets isScanning while the scan is in flight', async () => {
    let resolveStream;
    mockStream.mockReturnValue(new Promise((resolve) => { resolveStream = resolve; }));

    const { result } = renderHook(() => useCardOCR());
    let scanPromise;
    act(() => { scanPromise = result.current.scanCard(FILE); });

    await waitFor(() => expect(result.current.isScanning).toBe(true));

    resolveStream(sseResponse([contentEvent('{"name":"Eevee"}'), completedEvent]));
    await act(async () => { await scanPromise; });

    expect(result.current.isScanning).toBe(false);
    expect(result.current.scanResult.name).toBe('Eevee');
  });

  it('clearScan resets the result', async () => {
    const result = await runScan({ name: 'Snorlax' });
    expect(result.current.scanResult).not.toBeNull();

    act(() => { result.current.clearScan(); });
    expect(result.current.scanResult).toBeNull();
  });
});

// ─── Failure modes ───────────────────────────────────────────────────────────

describe('useCardOCR — failure modes', () => {
  it('surfaces SSE error events as a toast and leaves no result', async () => {
    mockStream.mockResolvedValue(sseResponse([errorEvent('Model overloaded')]));

    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(FILE); });

    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Model overloaded'));
    expect(result.current.scanResult).toBeNull();
    expect(result.current.isScanning).toBe(false);
  });

  it('rejects malformed SSE data', async () => {
    mockStream.mockResolvedValue(sseResponse([], { raw: 'data: {not-valid-json\n\n' }));

    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(FILE); });

    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('malformed'));
    expect(result.current.scanResult).toBeNull();
  });

  it('errors when the stream contains no JSON', async () => {
    mockStream.mockResolvedValue(sseResponse([
      contentEvent('I could not identify this card, sorry.'),
      completedEvent,
    ]));

    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(FILE); });

    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Could not extract'));
    expect(result.current.scanResult).toBeNull();
  });

  it('handles a rejected stream request (e.g. 401/429 from the API)', async () => {
    mockStream.mockRejectedValue(new Error('Request failed (429): Too many AI requests'));

    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(FILE); });

    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('429'));
    expect(result.current.scanResult).toBeNull();
    expect(result.current.isScanning).toBe(false);
  });

  it('handles a stream that ends without a completed event', async () => {
    // Reader reports done before any completed event arrives — content so far is used
    mockStream.mockResolvedValue(sseResponse([contentEvent('{"name":"Gengar"}')]));

    const { result } = renderHook(() => useCardOCR());
    await act(async () => { await result.current.scanCard(FILE); });

    expect(result.current.scanResult.name).toBe('Gengar');
  });
});

// ─── Catalogue grounding ─────────────────────────────────────────────────────

describe('useCardOCR — catalogue bridge', () => {
  it('overlays authoritative set/year on a corroborated match', async () => {
    mockFetch.mockResolvedValue({
      results: [{
        id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999,
        cardNumber: '4', rarity: 'Rare Holo', imageUrl: 'http://img/x.png', source: 'pokemon-tcg',
      }],
    });

    const result = await runScan({
      name: 'Charizard', cardNumber: '4/102', collectionType: 'Pokemon',
    });

    expect(result.current.scanResult.cardSetName).toBe('Base Set');
    expect(result.current.scanResult.releaseYear).toBe('1999');
    expect(result.current.scanResult.catalogueMatch).toMatchObject({
      id: 'base1-4', source: 'pokemon-tcg', imageUrl: 'http://img/x.png',
    });
  });

  it('keeps the collector number that was read off the card', async () => {
    // The number is printed on the card and OCR read it directly. The catalogue
    // stores a canonical "4"; replacing the printed "4/102" with it loses the
    // form collectors actually search by.
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', cardNumber: '4/102', collectionType: 'Pokemon' });

    expect(result.current.scanResult.cardNumber).toBe('4/102');
  });

  it('fills in the collector number only when OCR could not read one', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', cardSetName: 'Base Set', collectionType: 'Pokemon' });

    expect(result.current.scanResult.cardNumber).toBe('4');
  });

  it('does not overwrite a correct read when only the name matches', async () => {
    // The regression this whole change exists for: a common name returns an
    // arbitrary printing, and a name-only match used to be enough to replace
    // the set, number and year that had been read correctly off the card.
    mockFetch.mockResolvedValue({
      results: [{ id: 'sm9-40', name: 'Pikachu', setName: 'Team Up', year: 2019, cardNumber: '40', source: 'pokemon-tcg' }],
    });

    const result = await runScan({
      name: 'Pikachu', cardSetName: 'Base Set', cardNumber: '58/102',
      releaseYear: 1999, collectionType: 'Pokemon',
    });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
    expect(result.current.scanResult.cardSetName).toBe('Base Set');
    expect(result.current.scanResult.cardNumber).toBe('58/102');
    expect(result.current.scanResult.releaseYear).toBe('1999');
  });

  it('rejects a candidate whose collector number positively disagrees', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'x', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '11', source: 'pokemon-tcg' }],
    });

    const result = await runScan({
      name: 'Charizard', cardNumber: '4/102', cardSetName: 'Base Set', collectionType: 'Pokemon',
    });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
  });

  it('treats the same number from a different set total as a different card', async () => {
    // "4/102" and "4/165" are both card 4, but of different sets.
    mockFetch.mockResolvedValue({
      results: [{ id: 'x', name: 'Charizard', setName: 'Other Set', year: 2002, cardNumber: '4/165', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', cardNumber: '4/102', collectionType: 'Pokemon' });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
  });

  it('accepts a name match corroborated by the set when no number was read', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', cardSetName: 'Base Set', collectionType: 'Pokemon' });

    expect(result.current.scanResult.catalogueMatch).toBeDefined();
    expect(result.current.scanResult.catalogueMatch.verified).toEqual(
      expect.arrayContaining(['name', 'set'])
    );
  });

  it('accepts a name match corroborated by the year when no number was read', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', releaseYear: 1999, collectionType: 'Pokemon' });

    expect(result.current.scanResult.catalogueMatch.verified).toEqual(
      expect.arrayContaining(['name', 'year'])
    );
  });

  it('never matches on non-name evidence alone', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'x', name: 'Blastoise', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({
      name: 'Charizard', cardNumber: '4/102', cardSetName: 'Base Set', collectionType: 'Pokemon',
    });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
  });

  it('does not claim verification for a source that carries nothing to verify', async () => {
    // The Yu-Gi-Oh adapter returns setName/cardNumber/year as null, so a name
    // match can never be corroborated — and must not show a "verified" badge.
    mockFetch.mockResolvedValue({
      results: [{ id: '46986414', name: 'Dark Magician', setName: null, year: null, cardNumber: null, source: 'yugioh-api' }],
    });

    const result = await runScan({ name: 'Dark Magician', collectionType: 'Yu-Gi-Oh' });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
    expect(result.current.scanResult.catalogueCandidates).toHaveLength(1);
  });

  it('prefers the number-corroborated candidate over an equally-named one', async () => {
    mockFetch.mockResolvedValue({
      results: [
        { id: 'wrong', name: 'Charizard', setName: 'Team Up', year: 2019, cardNumber: '9', source: 'pokemon-tcg' },
        { id: 'right', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' },
      ],
    });

    const result = await runScan({ name: 'Charizard', cardNumber: '4/102', collectionType: 'Pokemon' });

    expect(result.current.scanResult.catalogueMatch.id).toBe('right');
  });

  it('records which fields were verified', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({
      name: 'Charizard', cardNumber: '4/102', cardSetName: 'Base Set',
      releaseYear: 1999, collectionType: 'Pokemon',
    });

    expect(result.current.scanResult.catalogueMatch.verified).toEqual(['name', 'number', 'set', 'year']);
  });

  it('corroborates against a set the model shortlisted when it named none', async () => {
    // The model was told to shortlist rather than guess a set with false
    // confidence. That shortlist used to be parsed and discarded, leaving the
    // hardest case — no set, no number — with nothing to corroborate against.
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({
      name: 'Charizard', collectionType: 'Pokemon',
      candidateSets: ['Base Set', 'Base Set 2', 'Legendary Collection'],
    });

    expect(result.current.scanResult.catalogueMatch).toBeDefined();
    expect(result.current.scanResult.catalogueMatch.verified).toEqual(['name', 'likely set']);
  });

  it('labels a shortlisted set differently from a confirmed one', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({
      name: 'Charizard', cardSetName: 'Base Set', collectionType: 'Pokemon',
      candidateSets: ['Base Set'],
    });

    expect(result.current.scanResult.catalogueMatch.verified).toContain('set');
    expect(result.current.scanResult.catalogueMatch.verified).not.toContain('likely set');
  });

  it('prefers a confirmed set over a merely shortlisted one', async () => {
    mockFetch.mockResolvedValue({
      results: [
        { id: 'shortlisted', name: 'Charizard', setName: 'Jungle', year: 2000, cardNumber: '4', source: 'pokemon-tcg' },
        { id: 'confirmed', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' },
      ],
    });

    const result = await runScan({
      name: 'Charizard', cardSetName: 'Base Set', collectionType: 'Pokemon',
      candidateSets: ['Jungle'],
    });

    expect(result.current.scanResult.catalogueMatch.id).toBe('confirmed');
  });

  it('does not treat a nested set name as the same set', async () => {
    // "Base Set" and "Base Set 2" are different sets. Substring containment
    // called them equal, letting the wrong one corroborate a match.
    mockFetch.mockResolvedValue({
      results: [{ id: 'x', name: 'Charizard', setName: 'Base Set 2', year: 2000, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', cardSetName: 'Base Set', collectionType: 'Pokemon' });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
  });

  it('still matches a set name that differs only by a filler word', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'base1-4', name: 'Charizard', setName: 'Base Set', year: 1999, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', cardSetName: 'Base', collectionType: 'Pokemon' });

    expect(result.current.scanResult.catalogueMatch).toBeDefined();
    expect(result.current.scanResult.catalogueMatch.verified).toContain('set');
  });

  it('does not treat an unrelated set as shortlisted', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'x', name: 'Charizard', setName: 'Team Up', year: 2019, cardNumber: '4', source: 'pokemon-tcg' }],
    });

    const result = await runScan({
      name: 'Charizard', collectionType: 'Pokemon',
      candidateSets: ['Base Set', 'Jungle'],
    });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
  });

  it('sends the mapped collection as the catalogue collection param', async () => {
    await runScan({ name: 'Charizard', collectionType: 'Pokemon' });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('/catalog/search?');
    expect(url).toContain('collection=pokemon');
  });

  it('sends the collector number so the catalogue can filter on it upstream', async () => {
    await runScan({ name: 'Charizard', cardNumber: '004/102', collectionType: 'Pokemon' });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('number=4');
  });

  it('asks for more rows when there is no number to narrow on', async () => {
    await runScan({ name: 'Charizard', collectionType: 'Pokemon' });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('take=12');
    expect(url).not.toContain('number=');
  });

  it('does not override fields on a weak match but still exposes candidates', async () => {
    mockFetch.mockResolvedValue({
      results: [{ id: 'x', name: 'Pikachu', setName: 'Jungle', year: 1999, cardNumber: '60', source: 'pokemon-tcg' }],
    });

    const result = await runScan({ name: 'Charizard', cardSetName: 'My Guess', collectionType: 'Pokemon' });

    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
    expect(result.current.scanResult.cardSetName).toBe('My Guess');
    expect(result.current.scanResult.catalogueCandidates).toHaveLength(1);
  });

  it('falls back to the raw OCR result when the catalogue lookup fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await runScan({ name: 'Charizard', cardSetName: 'Base Set', collectionType: 'Pokemon' });

    expect(result.current.scanResult.name).toBe('Charizard');
    expect(result.current.scanResult.cardSetName).toBe('Base Set');
    expect(result.current.scanResult.catalogueMatch).toBeUndefined();
  });
});

// ─── Field mapping (via full scans) ──────────────────────────────────────────

describe('useCardOCR — condition mapping', () => {
  it.each([
    ['Near Mint', 'Near Mint'],
    ['NM', 'Near Mint'],
    ['Mint', 'Mint'],
    ['mint condition', 'Mint'],
    ['Lightly Played', 'Excellent'],
    ['Excellent', 'Excellent'],
    ['Moderately Played', 'Good'],
    ['Good', 'Good'],
    ['Heavily Played', 'Fair'],
    ['Poor', 'Fair'],
    ['Fair', 'Fair'],
    ['something unrecognised', 'Good'],
    [undefined, 'Good'],
  ])('maps %s → %s', async (raw, expected) => {
    const result = await runScan({ name: 'X', condition: raw });
    expect(result.current.scanResult.condition).toBe(expected);
  });
});

describe('useCardOCR — grading service mapping', () => {
  it.each([
    ['PSA', 'PSA'],
    ['psa 10', 'PSA'],
    ['BGS', 'BGS'],
    ['Beckett Grading', 'BGS'],
    ['CGC', 'CGC'],
    ['SGC', 'SGC'],
    ['sgc grading', 'SGC'],
    ['ACE', 'ACE'],
    ['HGA', 'None'], // not a supported grading service
    [undefined, 'None'],
  ])('maps %s → %s', async (raw, expected) => {
    const result = await runScan({ name: 'X', gradingService: raw });
    expect(result.current.scanResult.gradingService).toBe(expected);
  });
});

describe('useCardOCR — rarity mapping', () => {
  it.each([
    ['Secret Rare', 'Secret Rare'],
    ['Ultra Rare', 'Secret Rare'],
    ['Holographic', 'Holographic'],
    ['Holo Rare', 'Holographic'],
    ['Rare', 'Rare'],
    ['Uncommon', 'Uncommon'],
    ['Common', 'Common'],
    ['Mythic', null],
    [undefined, null],
  ])('maps %s → %s', async (raw, expected) => {
    const result = await runScan({ name: 'X', rarity: raw });
    expect(result.current.scanResult.rarity).toBe(expected);
  });
});

describe('useCardOCR — collection type mapping', () => {
  it('matches a known collection case-insensitively', async () => {
    const result = await runScan({ name: 'X', collectionType: 'pokemon' });
    expect(result.current.scanResult.collectionType).toBe('Pokemon');
  });

  it('matches when the AI returns a longer phrase containing the collection', async () => {
    const result = await runScan({ name: 'X', collectionType: 'Pokemon TCG' });
    expect(result.current.scanResult.collectionType).toBe('Pokemon');
  });

  it('returns empty string for unknown collections', async () => {
    const result = await runScan({ name: 'X', collectionType: 'Tazos' });
    expect(result.current.scanResult.collectionType).toBe('');
  });

  it('returns empty string when missing', async () => {
    const result = await runScan({ name: 'X' });
    expect(result.current.scanResult.collectionType).toBe('');
  });
});

describe('useCardOCR — field normalization', () => {
  it('stringifies numeric releaseYear and gradeScore', async () => {
    const result = await runScan({ name: 'X', releaseYear: 2021, gradeScore: 9.5 });
    expect(result.current.scanResult.releaseYear).toBe('2021');
    expect(result.current.scanResult.gradeScore).toBe('9.5');
  });

  it('preserves gradeScore of 0 instead of dropping it', async () => {
    const result = await runScan({ name: 'X', gradeScore: 0 });
    expect(result.current.scanResult.gradeScore).toBe('0');
  });

  it('defaults missing fields to empty strings', async () => {
    const result = await runScan({ name: 'X' });
    expect(result.current.scanResult).toMatchObject({
      description: '',
      cardSetName: '',
      cardNumber: '',
      releaseYear: '',
      certificationNumber: '',
      cardType: '',
      brand: '',
      series: '',
    });
  });

  it('falls back to cardSetName for series', async () => {
    const result = await runScan({ name: 'X', cardSetName: 'Evolving Skies' });
    expect(result.current.scanResult.series).toBe('Evolving Skies');
  });
});
