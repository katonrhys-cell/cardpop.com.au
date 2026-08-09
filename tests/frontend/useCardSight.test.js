import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient', () => ({
  apiServerClient: { fetch: mockFetch },
  default: { fetch: mockFetch },
}));

import { useCardSight, mapCardSightToFormFields } from '@/hooks/useCardSight.js';

const FILE = new File(['fake-image-bytes'], 'card.jpg', { type: 'image/jpeg' });

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── identify() ──────────────────────────────────────────────────────────────

describe('useCardSight — identify', () => {
  it('posts the image as multipart form data and stores the result', async () => {
    const payload = { identified: true, card: { name: 'Charizard' } };
    mockFetch.mockResolvedValue(jsonResponse(payload));

    const { result } = renderHook(() => useCardSight());
    let returned;
    await act(async () => { returned = await result.current.identify(FILE); });

    expect(returned).toEqual(payload);
    expect(result.current.result).toEqual(payload);
    expect(result.current.isIdentifying).toBe(false);

    const [path, options] = mockFetch.mock.calls[0];
    expect(path).toBe('/cardsight/identify');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('image')).toBe(FILE);
  });

  it('is non-fatal on an API error response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Service down' }, false, 503));

    const { result } = renderHook(() => useCardSight());
    let returned;
    await act(async () => { returned = await result.current.identify(FILE); });

    expect(returned).toMatchObject({ apiError: true, identified: false });
    expect(returned.message).toBeTruthy();
    expect(result.current.result).toBeNull();
    expect(result.current.isIdentifying).toBe(false);
  });

  it('is non-fatal on a network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useCardSight());
    let returned;
    await act(async () => { returned = await result.current.identify(FILE); });

    expect(returned).toMatchObject({ apiError: true, identified: false, message: 'Network down' });
    expect(result.current.result).toBeNull();
  });

  it('does nothing without a file', async () => {
    const { result } = renderHook(() => useCardSight());
    await act(async () => { await result.current.identify(null); });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clearResult resets state', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ identified: true }));

    const { result } = renderHook(() => useCardSight());
    await act(async () => { await result.current.identify(FILE); });
    expect(result.current.result).not.toBeNull();

    act(() => { result.current.clearResult(); });
    expect(result.current.result).toBeNull();
  });
});

describe('useCardSight — fetchPricing / searchCatalog', () => {
  it('fetchPricing returns parsed pricing for a card id', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ avgPrice: 42 }));

    const { result } = renderHook(() => useCardSight());
    let pricing;
    await act(async () => { pricing = await result.current.fetchPricing('card-123'); });

    expect(pricing).toEqual({ avgPrice: 42 });
    expect(mockFetch.mock.calls[0][0]).toContain('/cardsight/pricing/card-123');
  });

  it('fetchPricing returns null without an id and on failure', async () => {
    const { result } = renderHook(() => useCardSight());

    let noId;
    await act(async () => { noId = await result.current.fetchPricing(null); });
    expect(noId).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockResolvedValue(jsonResponse({}, false, 500));
    let failed;
    await act(async () => { failed = await result.current.fetchPricing('card-123'); });
    expect(failed).toBeNull();
  });

  it('searchCatalog trims the query and skips blank searches', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

    const { result } = renderHook(() => useCardSight());
    await act(async () => { await result.current.searchCatalog('  pikachu  '); });
    expect(mockFetch.mock.calls[0][0]).toContain('q=pikachu');

    mockFetch.mockClear();
    await act(async () => { await result.current.searchCatalog('   '); });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── mapCardSightToFormFields ────────────────────────────────────────────────

describe('mapCardSightToFormFields', () => {
  it('returns empty object when not identified', () => {
    expect(mapCardSightToFormFields(null)).toEqual({});
    expect(mapCardSightToFormFields({ identified: false, card: { name: 'X' } })).toEqual({});
  });

  it('maps core card fields', () => {
    const fields = mapCardSightToFormFields({
      identified: true,
      card: { name: 'Charizard', setName: 'Base Set', cardNumber: '4', year: 1999, rarity: 'Holo' },
    });
    expect(fields).toEqual({
      cardName: 'Charizard',
      setName: 'Base Set',
      cardNumber: '4',
      year: '1999',
      // Rarity is a note, NOT `variant`: variant is the chip-selection ARRAY,
      // and writing a catalog string there broke every .includes/.filter caller.
      notesFromCardSight: 'Rarity: Holo',
    });
    expect(fields.variant).toBeUndefined();
  });

  it.each([
    ['PSA Grading', 'psa'],
    ['BGS', 'bgs'],
    ['Beckett', 'bgs'],
    ['CGC Cards', 'cgc'],
    ['SGC', 'sgc'],
  ])('maps grading company %s → %s', (company, expected) => {
    const fields = mapCardSightToFormFields({
      identified: true,
      grading: { company, grade: 10 },
    });
    expect(fields.gradingCompany).toBe(expected);
    expect(fields.grade).toBe('10');
  });

  it('omits gradingCompany for unknown services but keeps the grade', () => {
    const fields = mapCardSightToFormFields({
      identified: true,
      grading: { company: 'ACE Grading', grade: 9 },
    });
    expect(fields.gradingCompany).toBeUndefined();
    expect(fields.grade).toBe('9');
  });

  it.each([
    ['pokemon tcg', 'Pokemon'],
    ['NBA Basketball', 'NBA Basketball'],
    ['NFL', 'NFL Football'],
    ['mlb baseball', 'MLB'],
    ['soccer', 'Soccer'],
    ['UFC', 'UFC'],
  ])('maps segment %s → collection %s', (segment, expected) => {
    const fields = mapCardSightToFormFields({
      identified: true,
      card: { segment },
    });
    expect(fields.collection).toBe(expected);
  });

  it('uses sport when segment is missing', () => {
    const fields = mapCardSightToFormFields({
      identified: true,
      card: { sport: 'basketball' },
    });
    expect(fields.collection).toBe('NBA Basketball');
  });

  it('leaves collection unset for unknown segments', () => {
    const fields = mapCardSightToFormFields({
      identified: true,
      card: { segment: 'cricket' },
    });
    expect(fields.collection).toBeUndefined();
  });
});
