import { vi, describe, it, expect, beforeEach } from 'vitest';

// Chainable query-builder mock: every filter method records its call and
// returns the builder; awaiting the builder resolves with the fixture.
const state = vi.hoisted(() => ({ result: { data: [], error: null }, calls: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const builder = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled, onRejected) => Promise.resolve(state.result).then(onFulfilled, onRejected);
      }
      return (...args) => {
        state.calls.push([prop, ...args]);
        return builder;
      };
    },
  });
  return { default: { from: (table) => { state.calls.push(['from', table]); return builder; } } };
});

import { searchInternalCatalogue } from '../../src/utils/internalCatalogue.js';

const row = (overrides = {}) => ({
  catalogue_key: 'nba basketball|2003-04 topps|221',
  collection: 'NBA Basketball',
  set_name: '2003-04 Topps',
  insert_name: null,
  card_number: '221',
  parallel: null,
  card_name: 'LeBron James',
  year: '2003',
  confirmations: 3,
  observations: 12,
  ...overrides,
});

beforeEach(() => {
  state.result = { data: [], error: null };
  state.calls = [];
});

describe('searchInternalCatalogue', () => {
  it('returns [] for an empty query without touching the database', async () => {
    expect(await searchInternalCatalogue('', 10)).toEqual([]);
    expect(await searchInternalCatalogue('   ', 10)).toEqual([]);
    expect(state.calls).toEqual([]);
  });

  it('maps a catalogue row to the shared adapter shape', async () => {
    state.result = { data: [row()], error: null };
    const results = await searchInternalCatalogue('LeBron James', 10);
    expect(results).toEqual([{
      id: 'nba basketball|2003-04 topps|221',
      name: 'LeBron James',
      setName: '2003-04 Topps',
      year: 2003,
      cardNumber: '221',
      rarity: null,
      imageUrl: null,
      source: 'cardpop',
      insertName: null,
      parallel: null,
      collection: 'NBA Basketball',
    }]);
  });

  it('only queries human-confirmed rows', async () => {
    state.result = { data: [], error: null };
    await searchInternalCatalogue('LeBron James', 10);
    // The confirmation gate is what stops the pipeline confirming itself: an
    // unconfirmed entry is just an earlier model read.
    expect(state.calls).toContainEqual(['gte', 'confirmations', 1]);
  });

  it('escapes ILIKE wildcards in the query text', async () => {
    state.result = { data: [], error: null };
    await searchInternalCatalogue('100% Authentic_Card', 10);
    const ilike = state.calls.find(([method]) => method === 'ilike');
    expect(ilike[2]).toBe('%100\\% Authentic\\_Card%');
  });

  it('filters by collector number using the pipeline equivalence rules', async () => {
    state.result = { data: [row(), row({ catalogue_key: 'k2', card_number: '22' })], error: null };
    // "221/300" and "221" are the same number; "22" is a different card.
    const results = await searchInternalCatalogue('LeBron', 10, { number: '221' });
    expect(results.map(r => r.cardNumber)).toEqual(['221']);
  });

  it('matches collections loosely across accents and long names', async () => {
    state.result = { data: [row({ collection: 'Pokémon' })], error: null };
    expect(await searchInternalCatalogue('Pikachu', 10, { collection: 'pokemon' })).toHaveLength(1);

    state.result = { data: [row({ collection: 'NBA Basketball' })], error: null };
    expect(await searchInternalCatalogue('LeBron', 10, { collection: 'NBA Basketball' })).toHaveLength(1);
    expect(await searchInternalCatalogue('LeBron', 10, { collection: 'Pokemon' })).toHaveLength(0);
  });

  it('returns [] on a database error', async () => {
    state.result = { data: null, error: { message: 'boom' } };
    expect(await searchInternalCatalogue('LeBron', 10)).toEqual([]);
  });

  it('caps results at the requested take', async () => {
    state.result = { data: Array.from({ length: 8 }, (_, i) => row({ catalogue_key: `k${i}` })), error: null };
    expect(await searchInternalCatalogue('LeBron', 3)).toHaveLength(3);
  });
});
