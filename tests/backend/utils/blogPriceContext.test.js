import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import { buildPriceContext, quotableFigures } from '../../../src/utils/blogPriceContext.js';

// Chainable stub: every builder method returns itself, and awaiting the
// builder resolves to the supplied result.
function builder(result) {
  const b = {};
  for (const method of ['select', 'in', 'eq', 'order']) b[method] = vi.fn(() => b);
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}

const CARD = {
  id: 'card-1',
  slug: 'charizard-base-set-4',
  name: 'Charizard',
  set_name: 'Base Set',
  card_number: '4/102',
  category: 'pokemon',
};

const snapshot = (date, rawAvg, gradedAvg) => ({
  card_id: 'card-1',
  snapshot_date: date,
  raw_avg: rawAvg,
  raw_min: rawAvg === null ? null : rawAvg - 50,
  raw_max: rawAvg === null ? null : rawAvg + 50,
  raw_count: 12,
  graded_avg: gradedAvg,
  graded_min: gradedAvg === null ? null : gradedAvg - 100,
  graded_max: gradedAvg === null ? null : gradedAvg + 100,
  graded_count: 6,
});

// Wire both queries: tracked_cards first, then card_price_snapshots.
function wire(cards, snapshots) {
  mockSupabase.from.mockImplementation((table) => {
    if (table === 'tracked_cards') return builder({ data: cards, error: null });
    if (table === 'card_price_snapshots') return builder({ data: snapshots, error: null });
    throw new Error(`Unexpected table ${table}`);
  });
}

beforeEach(() => vi.clearAllMocks());

describe('buildPriceContext', () => {
  it('returns an empty context when no cards are requested', async () => {
    const context = await buildPriceContext([]);
    expect(context).toEqual({ cards: [], sharedWindow: null, minDays: 0 });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('summarises the latest snapshot and the window it covers', async () => {
    wire(
      [CARD],
      [
        snapshot('2026-07-04', 300, 1200),
        snapshot('2026-07-14', 310, 1220),
        snapshot('2026-07-25', 330, 1240),
      ],
    );

    const context = await buildPriceContext([CARD.slug]);
    const [card] = context.cards;

    expect(card.name).toBe('Charizard');
    expect(card.pricePageUrl).toBe('https://cardpop.com.au/prices/pokemon/charizard-base-set-4');
    expect(card.latest.date).toBe('2026-07-25');
    expect(card.latest.rawAvgAud).toBe(330);
    expect(card.latest.gradedAvgAud).toBe(1240);
    // 1240 / 330 ≈ 3.8
    expect(card.latest.gradedPremiumMultiple).toBe(3.8);
    expect(card.window).toEqual({
      from: '2026-07-04',
      to: '2026-07-25',
      days: 22,
      observations: 3,
    });
  });

  it('reports change only across the window actually held', async () => {
    wire([CARD], [snapshot('2026-07-04', 300, 1200), snapshot('2026-07-25', 330, 1200)]);

    const context = await buildPriceContext([CARD.slug]);
    // 300 → 330 is +10%
    expect(context.cards[0].overWindow.rawChangePct).toBe(10);
    expect(context.cards[0].overWindow.gradedChangePct).toBe(0);
  });

  it('refuses to state a direction from a single observation', async () => {
    wire([CARD], [snapshot('2026-07-25', 330, 1240)]);

    const context = await buildPriceContext([CARD.slug]);
    expect(context.cards[0].overWindow.rawChangePct).toBeNull();
    expect(context.cards[0].window.days).toBe(1);
  });

  it('ignores null averages when computing change', async () => {
    wire(
      [CARD],
      [snapshot('2026-07-04', null, null), snapshot('2026-07-10', 300, 1200), snapshot('2026-07-25', 360, 1200)],
    );

    const context = await buildPriceContext([CARD.slug]);
    // First usable point is 300, not the null.
    expect(context.cards[0].overWindow.rawChangePct).toBe(20);
  });

  it('narrows the shared window to the intersection across cards', async () => {
    const second = { ...CARD, id: 'card-2', slug: 'pikachu', name: 'Pikachu' };
    wire(
      [CARD, second],
      [
        snapshot('2026-07-04', 300, 1200),
        snapshot('2026-07-25', 330, 1240),
        { ...snapshot('2026-07-10', 40, 90), card_id: 'card-2' },
        { ...snapshot('2026-07-20', 45, 95), card_id: 'card-2' },
      ],
    );

    const context = await buildPriceContext([CARD.slug, 'pikachu']);

    // Latest start (07-10) to earliest end (07-20).
    expect(context.sharedWindow).toEqual({ from: '2026-07-10', to: '2026-07-20', days: 11 });
    // The shorter series gates the data check.
    expect(context.minDays).toBe(11);
  });

  it('drops cards that have no snapshots at all', async () => {
    const second = { ...CARD, id: 'card-2', slug: 'pikachu' };
    wire([CARD, second], [snapshot('2026-07-25', 330, 1240)]);

    const context = await buildPriceContext([CARD.slug, 'pikachu']);
    expect(context.cards).toHaveLength(1);
    expect(context.cards[0].slug).toBe(CARD.slug);
  });

  it('surfaces a query failure rather than returning empty data', async () => {
    mockSupabase.from.mockReturnValue(builder({ data: null, error: { message: 'boom' } }));
    await expect(buildPriceContext([CARD.slug])).rejects.toThrow(/Failed to load tracked cards: boom/);
  });
});

describe('quotableFigures', () => {
  it('collects every AUD figure the article is allowed to cite', async () => {
    wire([CARD], [snapshot('2026-07-25', 330, 1240)]);
    const context = await buildPriceContext([CARD.slug]);

    const figures = quotableFigures(context);
    expect(figures).toContain(330);
    expect(figures).toContain(1240);
    expect(figures).toContain(280); // raw_min
    expect(figures).toContain(1340); // graded_max
    expect(figures.every((f) => typeof f === 'number')).toBe(true);
  });

  it('returns nothing for an empty context', () => {
    expect(quotableFigures({ cards: [] })).toEqual([]);
  });
});
