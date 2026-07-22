import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockCallEbayApi = vi.hoisted(() => vi.fn());
const mockGetUsdToAudRate = vi.hoisted(() => vi.fn());
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../../src/utils/ebayClient.js', () => ({ callEbayApi: mockCallEbayApi }));
vi.mock('../../../src/utils/exchangeRates.js', () => ({ getUsdToAudRate: mockGetUsdToAudRate }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import { buildSnapshotForCard, refreshTrackedCards } from '../../../src/utils/cardPriceSnapshots.js';

// eBay item_summary/search shape (only the fields the aggregator reads).
const item = (value, title = 'Charizard', extra = {}) => ({ price: { value: String(value) }, title, ...extra });

// Capture the row passed to upsert() and echo it back as the stored snapshot.
function captureUpsert() {
  const captured = {};
  const b = {
    upsert: vi.fn((row) => { captured.row = row; return b; }),
    select: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve({ data: captured.row, error: null })),
  };
  return { builder: b, captured };
}

beforeEach(() => vi.clearAllMocks());

describe('buildSnapshotForCard', () => {
  it('separates raw from graded listings and averages each independently', async () => {
    // AU marketplace returns raw + graded; US returns empty.
    mockCallEbayApi
      .mockResolvedValueOnce({ itemSummaries: [
        item(100, 'Charizard Base Set'),
        item(120, 'Charizard Base Set near mint'),
        item(500, 'Charizard PSA 10'), // graded
      ] })
      .mockResolvedValueOnce({ itemSummaries: [] });

    const { builder, captured } = captureUpsert();
    mockSupabase.from.mockReturnValue(builder);

    const snap = await buildSnapshotForCard({ id: 'c1', slug: 'charizard', search_query: 'charizard' }, 1.5);

    expect(snap.raw_count).toBe(2);
    expect(snap.raw_avg).toBe(110); // (100 + 120) / 2
    expect(snap.graded_count).toBe(1);
    expect(snap.graded_avg).toBe(500);
    expect(captured.row.card_id).toBe('c1');
  });

  it('converts US listing prices to AUD using the supplied rate', async () => {
    // AU empty; US returns one $100 USD raw listing → $150 AUD at rate 1.5.
    mockCallEbayApi
      .mockResolvedValueOnce({ itemSummaries: [] })
      .mockResolvedValueOnce({ itemSummaries: [item(100, 'Charizard US raw')] });

    const { builder } = captureUpsert();
    mockSupabase.from.mockReturnValue(builder);

    const snap = await buildSnapshotForCard({ id: 'c2', slug: 'char', search_query: 'char' }, 1.5);
    expect(snap.raw_avg).toBe(150);
    expect(snap.exchange_rate).toBe(1.5);
  });

  it('ignores listings with a non-positive or unparseable price', async () => {
    mockCallEbayApi
      .mockResolvedValueOnce({ itemSummaries: [item(0), item(-5), { price: { value: 'N/A' }, title: 'x' }, item(80)] })
      .mockResolvedValueOnce({ itemSummaries: [] });

    const { builder } = captureUpsert();
    mockSupabase.from.mockReturnValue(builder);

    const snap = await buildSnapshotForCard({ id: 'c3', slug: 's', search_query: 'q' }, 1);
    expect(snap.raw_count).toBe(1);
    expect(snap.raw_avg).toBe(80);
  });

  it('trims the top and bottom 10% once there are at least 8 raw prices', async () => {
    // 10 prices 1..10: 10% trim drops the 1 and the 10, leaving 2..9 (avg 5.5).
    const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => item(v, 'raw card'));
    mockCallEbayApi
      .mockResolvedValueOnce({ itemSummaries: prices })
      .mockResolvedValueOnce({ itemSummaries: [] });

    const { builder } = captureUpsert();
    mockSupabase.from.mockReturnValue(builder);

    const snap = await buildSnapshotForCard({ id: 'c4', slug: 's', search_query: 'q' }, 1);
    expect(snap.raw_count).toBe(8);   // 10 - 2 trimmed
    expect(snap.raw_avg).toBe(5.5);
    expect(snap.raw_min).toBe(2);
    expect(snap.raw_max).toBe(9);
  });

  it('throws when BOTH marketplaces are unreachable', async () => {
    mockCallEbayApi.mockRejectedValue(new Error('eBay down'));
    await expect(
      buildSnapshotForCard({ id: 'c5', slug: 'boom', search_query: 'q' }, 1),
    ).rejects.toThrow(/eBay unavailable for "boom"/);
  });

  it('falls back to a live rate lookup when none is supplied', async () => {
    mockCallEbayApi
      .mockResolvedValueOnce({ itemSummaries: [item(10, 'raw')] })
      .mockResolvedValueOnce({ itemSummaries: [] });
    mockGetUsdToAudRate.mockResolvedValueOnce(2);

    const { builder } = captureUpsert();
    mockSupabase.from.mockReturnValue(builder);

    const snap = await buildSnapshotForCard({ id: 'c6', slug: 's', search_query: 'q' });
    expect(mockGetUsdToAudRate).toHaveBeenCalled();
    expect(snap.exchange_rate).toBe(2);
  });
});

describe('refreshTrackedCards', () => {
  function selectBuilder(rows) {
    const b = { select: vi.fn(() => b), eq: vi.fn(() => b), then: (onF, onR) => Promise.resolve({ data: rows, error: null }).then(onF, onR) };
    return b;
  }

  it('skips cards that already have a snapshot today and reports the summary', async () => {
    // tracked_cards -> two active cards; today's snapshots -> one already done.
    mockSupabase.from
      .mockReturnValueOnce(selectBuilder([{ id: 'a', slug: 'a', search_query: 'a' }, { id: 'b', slug: 'b', search_query: 'b' }]))
      .mockReturnValueOnce(selectBuilder([{ card_id: 'a' }]));
    mockGetUsdToAudRate.mockResolvedValue(1.5);

    // Card 'b' still needs a snapshot: AU one raw listing, US empty, then upsert.
    mockCallEbayApi
      .mockResolvedValueOnce({ itemSummaries: [item(10, 'raw')] })
      .mockResolvedValueOnce({ itemSummaries: [] });
    const { builder } = captureUpsert();
    mockSupabase.from.mockReturnValue(builder);

    const summary = await refreshTrackedCards({ concurrency: 1 });
    expect(summary.total).toBe(2);
    expect(summary.alreadyFresh).toBe(1);
    expect(summary.refreshed).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('returns early (nothing to do) when every active card is already fresh', async () => {
    mockSupabase.from
      .mockReturnValueOnce(selectBuilder([{ id: 'a', slug: 'a', search_query: 'a' }]))
      .mockReturnValueOnce(selectBuilder([{ card_id: 'a' }]));

    const summary = await refreshTrackedCards();
    expect(summary).toMatchObject({ total: 1, alreadyFresh: 1, refreshed: 0, failed: 0 });
    expect(mockCallEbayApi).not.toHaveBeenCalled();
  });
});
