import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetchWebpage = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/safeFetch.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchWebpageContent: mockFetchWebpage, extractTextFromHtml: (html) => html };
});

const mockExtract = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/eventScanner.js', () => ({ extractEventFromPage: mockExtract }));

// Minimal chainable postgrest double: `dbHandler.current(state)` scripts the
// { data, error } each call resolves to; every write is recorded in `writes`.
const dbHandler = vi.hoisted(() => ({ current: () => ({ data: null, error: null }), writes: [] }));

function makeQuery(table) {
  const state = { table, op: 'select', payload: null, filters: [] };
  const resolve = () => {
    if (state.op !== 'select') dbHandler.writes.push(state);
    return Promise.resolve(dbHandler.current(state));
  };
  const query = {
    select() { return query; },
    update(payload) { state.op = 'update'; state.payload = payload; return query; },
    eq(col, val) { state.filters.push(['eq', col, val]); return query; },
    or(expr) { state.filters.push(['or', expr]); return query; },
    lte(col, val) { state.filters.push(['lte', col, val]); return query; },
    order() { return query; },
    limit() { return query; },
    single: resolve,
    maybeSingle: resolve,
    then(onOk, onErr) { return resolve().then(onOk, onErr); },
  };
  return query;
}

vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: { from: (table) => makeQuery(table) },
}));

const {
  diffEventAgainstPage,
  comparable,
  withFreeFlag,
  scanEventSource,
} = await import('../../src/utils/eventSourceWatcher.js');

const FUTURE = '2099-03-01';
const PAGE = 'x'.repeat(300);

const baseEvent = {
  id: 'evt-1',
  title: 'Sydney Card Show',
  start_date: FUTURE,
  end_date: null,
  start_time: '10:00:00',
  end_time: null,
  venue_name: 'Town Hall',
  suburb: 'Sydney',
  ticket_url: null,
  entry_fee_aud: 0,
  is_free: true,
  description: 'Hand-written description.',
  seo_keywords: null,
};

describe('diffEventAgainstPage', () => {
  it('fills blank fields and never proposes them as changes', () => {
    const { fill, changes } = diffEventAgainstPage(baseEvent, {
      ...baseEvent,
      end_time: '16:00',
      ticket_url: 'https://tickets.example.com',
      seo_keywords: ['card show'],
    });

    expect(fill).toEqual({
      end_time: '16:00',
      ticket_url: 'https://tickets.example.com',
      seo_keywords: ['card show'],
    });
    expect(changes).toEqual({});
  });

  it('proposes a changed factual field instead of overwriting it', () => {
    const { fill, changes } = diffEventAgainstPage(baseEvent, {
      ...baseEvent,
      start_date: '2099-03-08',
      venue_name: 'Convention Centre',
    });

    expect(fill).toEqual({});
    expect(Object.keys(changes).sort()).toEqual(['start_date', 'venue_name']);
    expect(changes.start_date).toMatchObject({ current: FUTURE, found: '2099-03-08' });
  });

  it('ignores formatting-only differences and reworded prose', () => {
    const { fill, changes } = diffEventAgainstPage(baseEvent, {
      ...baseEvent,
      start_time: '10:00',
      venue_name: '  town   hall ',
      description: 'A completely reworded description.',
    });

    expect(fill).toEqual({});
    expect(changes).toEqual({});
  });

  it('treats a stored $0 entry fee as "free", so a price on the page is a proposal', () => {
    const { fill, changes } = diffEventAgainstPage(baseEvent, { ...baseEvent, entry_fee_aud: 15 });

    expect(fill).toEqual({});
    expect(changes.entry_fee_aud).toMatchObject({ current: 0, found: 15 });
  });

  it('does not re-propose a dismissed value, but does propose a new one', () => {
    const dismissed = { start_date: '2099-03-08' };

    expect(diffEventAgainstPage(baseEvent, { ...baseEvent, start_date: '2099-03-08' }, { dismissed }).changes)
      .toEqual({});
    expect(diffEventAgainstPage(baseEvent, { ...baseEvent, start_date: '2099-03-15' }, { dismissed }).changes)
      .toHaveProperty('start_date');
  });

  it('keeps the first-seen time for a change that is still on the page', () => {
    const previous = { venue_name: { found: 'Convention Centre', found_at: '2099-01-01T00:00:00.000Z' } };
    const { changes } = diffEventAgainstPage(baseEvent, { ...baseEvent, venue_name: 'Convention Centre' }, { previous });

    expect(changes.venue_name.found_at).toBe('2099-01-01T00:00:00.000Z');
  });

  it('says nothing when the page stops mentioning a field', () => {
    const { changes } = diffEventAgainstPage(baseEvent, { ...baseEvent, venue_name: null });
    expect(changes).toEqual({});
  });
});

describe('helpers', () => {
  it('comparable normalises times, numbers and whitespace', () => {
    expect(comparable('start_time', '09:30:00')).toBe('09:30');
    expect(comparable('entry_fee_aud', '10.00')).toBe(10);
    expect(comparable('venue_name', ' Big   Hall ')).toBe('big hall');
    expect(comparable('venue_name', '')).toBeNull();
  });

  it('withFreeFlag moves is_free with the entry fee', () => {
    expect(withFreeFlag({ entry_fee_aud: 12 })).toEqual({ entry_fee_aud: 12, is_free: false });
    expect(withFreeFlag({ entry_fee_aud: 0 })).toEqual({ entry_fee_aud: 0, is_free: true });
    expect(withFreeFlag({ venue_name: 'X' })).toEqual({ venue_name: 'X' });
  });
});

describe('scanEventSource', () => {
  const watch = {
    event_id: 'evt-1',
    url: 'https://organiser.example.com/show',
    is_active: true,
    content_hash: null,
    pending_changes: {},
    dismissed_changes: {},
    filled_fields: [],
  };

  let event;
  let claim;

  beforeEach(() => {
    vi.clearAllMocks();
    dbHandler.writes = [];
    event = { ...baseEvent };
    claim = { ...watch };
    mockFetchWebpage.mockResolvedValue(PAGE);
    dbHandler.current = (state) => {
      if (state.table === 'event_source_watches' && state.op === 'update' && 'scan_started_at' in state.payload && state.payload.scan_started_at) {
        return { data: claim, error: null };
      }
      if (state.table === 'events' && state.op === 'select') return { data: event, error: null };
      return { data: null, error: null };
    };
  });

  const watchUpdates = () => dbHandler.writes
    .filter((w) => w.table === 'event_source_watches' && w.payload.scan_started_at === null)
    .map((w) => w.payload);
  const eventUpdates = () => dbHandler.writes.filter((w) => w.table === 'events').map((w) => w.payload);

  it('saves blank-field details to the event and queues changed ones', async () => {
    mockExtract.mockResolvedValue({
      eventData: { ...baseEvent, ticket_url: 'https://tickets.example.com', start_date: '2099-03-08' },
    });

    const result = await scanEventSource('evt-1');

    expect(result.status).toBe('updated');
    expect(result.filled).toEqual(['ticket_url']);
    expect(result.changes).toEqual(['start_date']);
    expect(eventUpdates()).toEqual([{ ticket_url: 'https://tickets.example.com' }]);

    const [finish] = watchUpdates();
    expect(finish.last_status).toBe('updated');
    expect(finish.pending_changes).toHaveProperty('start_date');
    expect(finish.content_hash).toMatch(/^[0-9a-f]{64}$/);
    // Next scan a week out.
    const days = (Date.parse(finish.next_scan_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('skips the model call when the page has not changed', async () => {
    mockExtract.mockResolvedValue({ eventData: baseEvent });
    await scanEventSource('evt-1');
    const hash = watchUpdates()[0].content_hash;

    dbHandler.writes = [];
    claim = { ...watch, content_hash: hash };
    mockExtract.mockClear();

    const result = await scanEventSource('evt-1');

    expect(result.status).toBe('unchanged_page');
    expect(mockExtract).not.toHaveBeenCalled();
    expect(eventUpdates()).toEqual([]);
  });

  it('a forced scan re-reads an unchanged page', async () => {
    mockExtract.mockResolvedValue({ eventData: baseEvent });
    await scanEventSource('evt-1');
    claim = { ...watch, content_hash: watchUpdates()[0].content_hash };
    mockExtract.mockClear();

    const result = await scanEventSource('evt-1', { force: true });

    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('no_change');
  });

  it('stops re-scanning once the event is over', async () => {
    event = { ...baseEvent, start_date: '2000-01-01' };

    const result = await scanEventSource('evt-1');

    expect(result.status).toBe('no_change');
    expect(mockFetchWebpage).not.toHaveBeenCalled();
    expect(watchUpdates()[0].is_active).toBe(false);
  });

  it('records a failed fetch and retries the next day without touching the event', async () => {
    mockFetchWebpage.mockRejectedValue(new Error('timeout'));

    const result = await scanEventSource('evt-1');

    expect(result.status).toBe('failed');
    expect(eventUpdates()).toEqual([]);
    const days = (Date.parse(watchUpdates()[0].next_scan_at) - Date.now()) / 86_400_000;
    expect(days).toBeLessThan(1.1);
  });

  it('leaves the event alone when the page no longer reads as an event', async () => {
    mockExtract.mockResolvedValue({ rejected: 'Page is a shop homepage.' });

    const result = await scanEventSource('evt-1');

    expect(result.status).toBe('rejected');
    expect(eventUpdates()).toEqual([]);
  });

  it('reports busy when another scan holds the lock', async () => {
    dbHandler.current = (state) => {
      if (state.table === 'event_source_watches' && state.op === 'select') return { data: { event_id: 'evt-1' }, error: null };
      return { data: null, error: null };
    };

    const result = await scanEventSource('evt-1');

    expect(result.status).toBe('busy');
    expect(mockFetchWebpage).not.toHaveBeenCalled();
  });
});
