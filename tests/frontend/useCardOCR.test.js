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
      cardNumber: '4/102',
      releaseYear: '1999',
      collectionType: 'Pokemon',
      condition: 'Near Mint',
      gradingService: 'PSA',
      gradeScore: '9',
      certificationNumber: '12345678',
      rarity: 'Holographic',
      cardType: 'Fire',
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
  it('overlays authoritative set/number/year on a confident match', async () => {
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
    expect(result.current.scanResult.cardNumber).toBe('4');
    expect(result.current.scanResult.releaseYear).toBe('1999');
    expect(result.current.scanResult.catalogueMatch).toMatchObject({
      id: 'base1-4', source: 'pokemon-tcg', imageUrl: 'http://img/x.png',
    });
  });

  it('sends the mapped collection as the catalogue collection param', async () => {
    await runScan({ name: 'Charizard', collectionType: 'Pokemon' });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('/catalog/search?');
    expect(url).toContain('collection=pokemon');
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
