import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/constants/prompts.js', () => ({
  EventScraperPrompt: 'mock-event-scraper-prompt',
}));

// The scanner fetches candidate pages through the shared SSRF-safe helper;
// stub it so the tests never touch the network.
const mockFetchWebpage = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/safeFetch.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchWebpageContent: mockFetchWebpage };
});

const mockAnthropicCreate = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {
      this.beta = { messages: { create: mockAnthropicCreate } };
    }
  },
}));

// ─── Supabase test double ────────────────────────────────────────────────────
//
// A minimal chainable builder matching the subset of postgrest-js the scanner
// uses. `handler` receives the accumulated query state and returns the
// { data, error } the call should resolve to, so each test can script exactly
// the rows it needs.

const dbHandler = vi.hoisted(() => ({ current: () => ({ data: null, error: null }) }));

function makeQuery(table) {
  const state = { table, op: 'select', payload: null, filters: [], single: false };
  const resolve = () => Promise.resolve(dbHandler.current(state));
  const query = {
    select(cols) { state.cols = cols; return query; },
    insert(payload) { state.op = 'insert'; state.payload = payload; return query; },
    update(payload) { state.op = 'update'; state.payload = payload; return query; },
    delete() { state.op = 'delete'; return query; },
    eq(col, val) { state.filters.push(['eq', col, val]); return query; },
    gte(col, val) { state.filters.push(['gte', col, val]); return query; },
    lt(col, val) { state.filters.push(['lt', col, val]); return query; },
    not(col, op, val) { state.filters.push(['not', col, val]); return query; },
    in(col, val) { state.filters.push(['in', col, val]); return query; },
    order() { return query; },
    limit() { return query; },
    single() { state.single = true; return resolve(); },
    maybeSingle() { state.single = true; return resolve(); },
    then(onOk, onErr) { return resolve().then(onOk, onErr); },
  };
  return query;
}

vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: { from: (table) => makeQuery(table) },
}));

const {
  runEventScan,
  runEventBacklog,
  LISTING_EVENT_SCHEMA,
  discoverCandidates,
  extractEventFromPage,
  normalizeUrl,
  isBlockedDomain,
  EVENT_SCHEMA,
} = await import('../../src/utils/eventScanner.js');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const searchResponse = (results) => ({
  stop_reason: 'end_turn',
  content: [
    { type: 'text', text: 'Found some events.' },
    { type: 'web_search_tool_result', content: results },
  ],
});

const extractionResponse = (payload) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(payload) }],
});

const validEvent = (overrides = {}) => ({
  is_trading_card_event: true,
  rejection_reason: null,
  title: 'Sydney Card Show',
  short_description: 'A card show.',
  description: 'A card show in Sydney.',
  event_type: 'card_show',
  featured_card_games: ['Pokemon'],
  venue_name: 'Rosehill Gardens',
  address: '1 Grand Ave',
  suburb: 'Rosehill',
  state: 'NSW',
  postcode: '2142',
  start_date: inDays(30),
  end_date: null,
  start_time: '09:00',
  end_time: '15:00',
  organizer_name: 'Card Shows AU',
  organizer_email: null,
  organizer_phone: null,
  website_url: null,
  ticket_url: null,
  entry_fee_aud: 5,
  presale_fee_aud: null,
  is_free: false,
  capacity: null,
  registration_required: false,
  accessibility_info: null,
  age_restrictions: null,
  image_url: null,
  seo_title: 'Sydney Card Show 2026',
  seo_description: 'Sydney card show.',
  seo_keywords: ['sydney card show'],
  tags: ['pokemon', 'sydney'],
  ...overrides,
});

/**
 * Script the database for a whole run. `opts.existingEvents` are the rows the
 * duplicate check sees; everything else defaults to a clean, empty database.
 */
function scriptDatabase(opts = {}) {
  const { sources = [], knownCandidateUrls = [], existingEvents = [], insertedEventId = 'event-1', backlog = [] } = opts;
  const calls = [];

  dbHandler.current = (state) => {
    calls.push(state);

    if (state.table === 'event_scan_runs') {
      if (state.op === 'insert') return { data: { id: 'run-1' }, error: null };
      return { data: null, error: null };
    }

    if (state.table === 'event_scan_sources') {
      if (state.op === 'select') return { data: sources, error: null };
      return { data: null, error: null };
    }

    if (state.table === 'event_scan_candidates') {
      if (state.op === 'select') {
        // The backlog read asks for pending rows; everything else asks by URL.
        if (state.filters.some(([op, col, val]) => op === 'eq' && col === 'status' && val === 'pending')) {
          return { data: backlog, error: null };
        }
        const byUrl = state.filters.find(([op, col]) => op === 'eq' && col === 'url');
        if (byUrl) {
          const i = knownCandidateUrls.indexOf(byUrl[2]);
          return { data: i === -1 ? [] : [{ id: `known-${i}`, url: byUrl[2] }], error: null };
        }
        return { data: knownCandidateUrls.map((url, i) => ({ id: `known-${i}`, url })), error: null };
      }
      if (state.op === 'insert') {
        return {
          data: state.payload.map((row, i) => ({ id: `cand-${i}`, url: row.url, title: row.title })),
          error: null,
        };
      }
      return { data: null, error: null };
    }

    if (state.table === 'events') {
      if (state.op === 'insert') {
        return {
          data: { id: insertedEventId, slug: state.payload.slug, title: state.payload.title },
          error: null,
        };
      }
      const bySourceUrl = state.filters.some(([, col]) => col === 'source_url');
      if (bySourceUrl) {
        const [, , url] = state.filters.find(([, col]) => col === 'source_url');
        return { data: existingEvents.filter((e) => e.source_url === url), error: null };
      }
      return { data: existingEvents, error: null };
    }

    return { data: null, error: null };
  };

  return calls;
}

/** The last `events` insert payload the run produced, if any. */
const eventInsert = (calls) => calls.find((c) => c.table === 'events' && c.op === 'insert')?.payload;

/** The candidate status updates the run wrote. */
const candidateUpdates = (calls) =>
  calls.filter((c) => c.table === 'event_scan_candidates' && c.op === 'update' && c.payload.status)
    .map((c) => c.payload);

/** The final state written to the run row. */
const runUpdate = (calls) =>
  calls.filter((c) => c.table === 'event_scan_runs' && c.op === 'update').pop()?.payload;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

// ─── URL normalisation ───────────────────────────────────────────────────────

describe('normalizeUrl', () => {
  it('collapses host casing, www and a trailing slash', () => {
    expect(normalizeUrl('http://WWW.Example.com.au/events/')).toBe('https://example.com.au/events');
  });

  it('drops tracking parameters but keeps meaningful ones', () => {
    expect(normalizeUrl('https://example.com.au/e?id=7&utm_source=fb&fbclid=xyz'))
      .toBe('https://example.com.au/e?id=7');
  });

  it('orders remaining parameters so the same page has one key', () => {
    expect(normalizeUrl('https://example.com.au/e?b=2&a=1'))
      .toBe(normalizeUrl('https://example.com.au/e?a=1&b=2'));
  });

  it('keeps a bare root path intact', () => {
    expect(normalizeUrl('https://example.com.au/')).toBe('https://example.com.au/');
  });
});

describe('isBlockedDomain', () => {
  it('blocks login-walled hosts and their subdomains', () => {
    expect(isBlockedDomain('https://www.facebook.com/events/123')).toBe(true);
    expect(isBlockedDomain('https://m.facebook.com/events/123')).toBe(true);
  });

  it('allows ordinary event hosts', () => {
    expect(isBlockedDomain('https://www.eventbrite.com.au/e/123')).toBe(false);
  });

  it('treats an unparseable URL as blocked', () => {
    expect(isBlockedDomain('not a url')).toBe(true);
  });
});

// ─── Discovery ───────────────────────────────────────────────────────────────

describe('discoverCandidates', () => {
  it('harvests URLs from search-result blocks and de-duplicates them', async () => {
    mockAnthropicCreate.mockResolvedValue(searchResponse([
      { type: 'web_search_result', url: 'https://example.com.au/show', title: 'Show' },
      { type: 'web_search_result', url: 'https://www.example.com.au/show/', title: 'Show again' },
      { type: 'web_search_result', url: 'https://other.com.au/fair', title: 'Fair' },
    ]));

    const candidates = await discoverCandidates(['card show sydney']);

    expect(candidates).toEqual([
      { url: 'https://example.com.au/show', title: 'Show' },
      { url: 'https://other.com.au/fair', title: 'Fair' },
    ]);
  });

  it('drops blocked domains before they consume a candidate slot', async () => {
    mockAnthropicCreate.mockResolvedValue(searchResponse([
      { type: 'web_search_result', url: 'https://www.facebook.com/events/1', title: 'FB event' },
      { type: 'web_search_result', url: 'https://example.com.au/show', title: 'Show' },
    ]));

    const candidates = await discoverCandidates(['card show sydney']);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].url).toBe('https://example.com.au/show');
  });

  it('survives a search tool error block instead of throwing', async () => {
    mockAnthropicCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'web_search_tool_result', content: { error_code: 'max_uses_exceeded' } }],
    });

    await expect(discoverCandidates(['card show sydney'])).resolves.toEqual([]);
  });

  it('throws when the model declines the request', async () => {
    mockAnthropicCreate.mockResolvedValue({
      stop_reason: 'refusal',
      stop_details: { category: 'cyber' },
      content: [],
    });

    await expect(discoverCandidates(['card show sydney'])).rejects.toThrow(/declined/i);
  });

  it('makes no API call when there are no queries', async () => {
    await expect(discoverCandidates([])).resolves.toEqual([]);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});

// ─── Extraction ──────────────────────────────────────────────────────────────

describe('extractEventFromPage', () => {
  it('returns a normalised event and stamps the source URL', async () => {
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent()));

    const { eventData } = await extractEventFromPage('page text', 'https://example.com.au/show');

    expect(eventData.title).toBe('Sydney Card Show');
    expect(eventData.state).toBe('NSW');
    expect(eventData.source_url).toBe('https://example.com.au/show');
  });

  it('reports a rejection when the page is not an event', async () => {
    mockAnthropicCreate.mockResolvedValue(extractionResponse({
      ...validEvent(),
      is_trading_card_event: false,
      rejection_reason: 'This is a shop homepage.',
    }));

    const result = await extractEventFromPage('page text', 'https://example.com.au/');

    expect(result.rejected).toBe('This is a shop homepage.');
    expect(result.eventData).toBeUndefined();
  });

  it('extracts on Sonnet 5.5 at low effort with the default fallback, while discovery stays on Opus 5.5', async () => {
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent()));
    await extractEventFromPage('page text', 'https://example.com.au/show');
    const extraction = mockAnthropicCreate.mock.calls.at(-1)[0];
    expect(extraction.model).toBe('claude-sonnet-5-5');
    expect(extraction.output_config.effort).toBe('low');
    expect(extraction.fallbacks).toBe('default');
    expect(extraction).not.toHaveProperty('tool_choice');

    mockAnthropicCreate.mockResolvedValue({ stop_reason: 'end_turn', content: [] });
    await discoverCandidates(['card show sydney']);
    expect(mockAnthropicCreate.mock.calls.at(-1)[0].model).toBe('claude-opus-5-5');
  });

  it('throws when the output was truncated', async () => {
    mockAnthropicCreate.mockResolvedValue({ stop_reason: 'max_tokens', content: [] });

    await expect(extractEventFromPage('page text', 'https://example.com.au/'))
      .rejects.toThrow(/token cap/i);
  });
});

// ─── Full run ────────────────────────────────────────────────────────────────

describe('runEventScan', () => {
  const sources = [{ id: 'src-1', kind: 'search_query', value: 'card show sydney', label: null }];

  function primeHappyPath(eventOverrides = {}) {
    mockAnthropicCreate
      .mockResolvedValueOnce(searchResponse([
        { type: 'web_search_result', url: 'https://example.com.au/show', title: 'Show' },
      ]))
      .mockResolvedValueOnce(extractionResponse(validEvent(eventOverrides)));
    mockFetchWebpage.mockResolvedValue(`<html><body><p>${'Sydney Card Show details. '.repeat(20)}</p></body></html>`);
  }

  it('files a discovered event as a pending_review draft', async () => {
    const calls = scriptDatabase({ sources });
    primeHappyPath();

    const summary = await runEventScan({ trigger: 'cron' });

    const insert = eventInsert(calls);
    expect(insert.status).toBe('pending_review');
    expect(insert.auto_discovered).toBe(true);
    expect(insert.source_url).toBe('https://example.com.au/show');
    expect(insert.slug).toBe(`sydney-card-show-${validEvent().start_date}`);
    expect(summary.eventsCreated).toBe(1);
    expect(candidateUpdates(calls)).toContainEqual(
      expect.objectContaining({ status: 'imported', event_id: 'event-1' }),
    );
  });

  it('never publishes — the draft is always pending_review', async () => {
    const calls = scriptDatabase({ sources });
    primeHappyPath();

    await runEventScan({ trigger: 'cron' });

    expect(eventInsert(calls).status).toBe('pending_review');
  });

  it('rejects an event that has already happened', async () => {
    const calls = scriptDatabase({ sources });
    primeHappyPath({ start_date: inDays(-5) });

    const summary = await runEventScan({ trigger: 'cron' });

    expect(summary.eventsCreated).toBe(0);
    expect(eventInsert(calls)).toBeUndefined();
    expect(candidateUpdates(calls)).toContainEqual(
      expect.objectContaining({ status: 'rejected', reason: 'Event has already happened.' }),
    );
  });

  it('rejects a page with no specific start date', async () => {
    const calls = scriptDatabase({ sources });
    primeHappyPath({ start_date: null });

    const summary = await runEventScan({ trigger: 'cron' });

    expect(summary.eventsCreated).toBe(0);
    expect(candidateUpdates(calls)).toContainEqual(
      expect.objectContaining({ status: 'rejected', reason: 'No specific start date on the page.' }),
    );
  });

  it('skips an event already on the site at the same title and date', async () => {
    const calls = scriptDatabase({
      sources,
      existingEvents: [{ id: 'existing-1', title: 'Sydney Card Show 2026', venue_name: null, suburb: 'Rosehill' }],
    });
    primeHappyPath();

    const summary = await runEventScan({ trigger: 'cron' });

    expect(summary.duplicatesSkipped).toBe(1);
    expect(summary.eventsCreated).toBe(0);
    expect(candidateUpdates(calls)).toContainEqual(
      expect.objectContaining({ status: 'duplicate', event_id: 'existing-1' }),
    );
  });

  it('does not re-extract a URL it has already seen', async () => {
    scriptDatabase({ sources, knownCandidateUrls: ['https://example.com.au/show'] });
    mockAnthropicCreate.mockResolvedValueOnce(searchResponse([
      { type: 'web_search_result', url: 'https://example.com.au/show', title: 'Show' },
    ]));

    const summary = await runEventScan({ trigger: 'cron' });

    expect(summary.candidatesFound).toBe(1);
    expect(summary.pagesFetched).toBe(0);
    expect(mockFetchWebpage).not.toHaveBeenCalled();
    // Discovery only — no extraction call was made.
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
  });

  it('records a failing page as a warning and completes the run', async () => {
    const calls = scriptDatabase({ sources });
    mockAnthropicCreate.mockResolvedValueOnce(searchResponse([
      { type: 'web_search_result', url: 'https://example.com.au/show', title: 'Show' },
    ]));
    mockFetchWebpage.mockRejectedValue(new Error('Fetch request timed out'));

    const summary = await runEventScan({ trigger: 'cron' });

    expect(summary.warnings.some(w => w.includes('Fetch request timed out'))).toBe(true);
    expect(runUpdate(calls).status).toBe('completed');
    expect(candidateUpdates(calls)).toContainEqual(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('marks the run failed and rethrows when discovery blows up', async () => {
    const calls = scriptDatabase({ sources });
    mockAnthropicCreate.mockRejectedValue(new Error('upstream exploded'));

    await expect(runEventScan({ trigger: 'cron' })).rejects.toThrow('upstream exploded');

    expect(runUpdate(calls)).toMatchObject({ status: 'failed', error: 'upstream exploded' });
  });

  it('completes without an API call when no sources are configured', async () => {
    const calls = scriptDatabase({ sources: [] });

    const summary = await runEventScan({ trigger: 'cron' });

    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(summary.eventsCreated).toBe(0);
    expect(runUpdate(calls).status).toBe('completed');
    expect(summary.warnings).toContain('No active scan sources configured.');
  });
});

describe('EVENT_SCHEMA', () => {
  // The API rejects a structured-output schema with more than 16 union-typed
  // properties (400, before the page is read) — this once failed every scan.
  it('stays within the API limit of 16 union-typed parameters', () => {
    const unions = Object.values(EVENT_SCHEMA.properties)
      .filter((p) => p.anyOf || Array.isArray(p.type)).length;
    expect(unions).toBeLessThanOrEqual(16);
  });
});

// ─── Listing pages ───────────────────────────────────────────────────────────

const listed = (overrides = {}) => ({
  title: 'Perth Card Fest',
  start_date: inDays(40),
  end_date: '',
  start_time: '09:00',
  end_time: '',
  event_type: 'card_show',
  venue_name: 'Claremont Showground',
  address: '',
  suburb: 'Claremont',
  state: 'WA',
  organizer_name: 'Perth Card Fest',
  url: '',
  short_description: 'Perth card show.',
  ...overrides,
});

/** Verdicts written on individual pages — not the bulk "retire stale finds" update. */
const pageVerdicts = (calls) => candidateUpdates(calls).filter((u) => !String(u.reason || '').startsWith('Never read'));

const eventInserts = (calls) => calls.filter((c) => c.table === 'events' && c.op === 'insert').map((c) => c.payload);

describe('listing pages', () => {
  it('asks for the other events only when reading a page as a listing', async () => {
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent()));

    await extractEventFromPage('page text', 'https://example.com.au/show');
    expect(mockAnthropicCreate.mock.calls[0][0].output_config.format.schema.properties.other_events).toBeUndefined();

    await extractEventFromPage('page text', 'https://example.com.au/calendar', { listing: true });
    const params = mockAnthropicCreate.mock.calls[1][0];
    expect(params.output_config.format.schema).toBe(LISTING_EVENT_SCHEMA);
    expect(params.messages[0].content).toContain('other_events');
  });

  it('adds no union-typed parameters, so the listing schema stays inside the API limit', () => {
    const items = LISTING_EVENT_SCHEMA.properties.other_events.items;
    expect(Object.values(items.properties).every((prop) => !prop.anyOf)).toBe(true);
    expect(LISTING_EVENT_SCHEMA.required).toContain('other_events');
  });

  it('returns the listed events of a page that is "only an index"', async () => {
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent({
      is_trading_card_event: false,
      rejection_reason: 'An index of several shows.',
      other_events: [
        listed({ url: 'https://perthcardfest.org/events/pcf-7?utm_source=x' }),
        listed({ title: 'Listed on the same page', url: 'https://example.com.au/calendar/' }),
        listed({ title: '   ' }),
      ],
    })));

    const result = await extractEventFromPage('page text', 'https://example.com.au/calendar', { listing: true });

    expect(result.rejected).toBe('An index of several shows.');
    expect(result.otherEvents).toHaveLength(2);
    expect(result.otherEvents[0]).toMatchObject({
      title: 'Perth Card Fest',
      state: 'WA',
      is_free: false,
      source_url: 'https://perthcardfest.org/events/pcf-7',
      website_url: 'https://perthcardfest.org/events/pcf-7',
    });
    // A row pointing back at the listing itself has no source of its own.
    expect(result.otherEvents[1].source_url).toBeNull();
  });

  it('files every upcoming event on a listing page as its own draft', async () => {
    mockFetchWebpage.mockResolvedValue(`<html><body>${'calendar '.repeat(60)}</body></html>`);
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent({
      is_trading_card_event: false,
      rejection_reason: 'An index of several shows.',
      other_events: [
        listed(),
        listed({ title: 'Hobart Collectables Fair', state: 'TAS', venue_name: 'City Hall', start_date: inDays(55) }),
        listed({ title: 'Already Happened Show', start_date: inDays(-3) }),
        listed({ title: 'No Date Show', start_date: '' }),
      ],
    })));
    const calls = scriptDatabase({ backlog: [{ id: 'cand-old', url: 'https://example.com.au/calendar', title: 'Calendar' }] });

    const summary = await runEventBacklog();

    expect(eventInserts(calls).map((e) => e.title)).toEqual(['Perth Card Fest', 'Hobart Collectables Fair']);
    expect(eventInserts(calls).every((e) => e.status === 'pending_review' && e.auto_discovered)).toBe(true);
    expect(summary.eventsCreated).toBe(2);
    expect(candidateUpdates(calls).pop()).toMatchObject({ status: 'imported', reason: 'Listing page: 2 draft(s) created.' });
  });

  it('does not draft a listed show that is already on the site under a longer name', async () => {
    const date = inDays(40);
    mockFetchWebpage.mockResolvedValue(`<html><body>${'calendar '.repeat(60)}</body></html>`);
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent({
      is_trading_card_event: false,
      rejection_reason: 'An index.',
      other_events: [listed({ start_date: date, venue_name: '' })],
    })));
    const calls = scriptDatabase({
      backlog: [{ id: 'cand-old', url: 'https://example.com.au/calendar', title: 'Calendar' }],
      existingEvents: [{ id: 'event-7', title: 'Perth Card Fest 7th Edition', venue_name: 'Somewhere Else', start_date: date }],
    });

    const summary = await runEventBacklog();

    expect(eventInserts(calls)).toEqual([]);
    expect(summary.duplicatesSkipped).toBe(1);
    expect(candidateUpdates(calls).pop().status).toBe('duplicate');
  });
});

// ─── Daily backlog run ───────────────────────────────────────────────────────

describe('runEventBacklog', () => {
  const page = `<html><body>${'Sydney Card Show at Rosehill Gardens. '.repeat(20)}</body></html>`;

  it('does nothing — no run row — when there is nothing to read', async () => {
    const calls = scriptDatabase();

    expect(await runEventBacklog()).toEqual({ skipped: 'nothing_to_read' });
    expect(calls.some((c) => c.table === 'event_scan_runs')).toBe(false);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('reads pages an earlier scan found but never read', async () => {
    mockFetchWebpage.mockResolvedValue(page);
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent()));
    const calls = scriptDatabase({ backlog: [{ id: 'cand-old', url: 'https://example.com.au/show', title: 'Show' }] });

    const summary = await runEventBacklog({ trigger: 'manual', triggeredBy: 'admin-1' });

    expect(calls.find((c) => c.table === 'event_scan_runs' && c.op === 'insert').payload)
      .toMatchObject({ scope: 'backlog', trigger: 'manual' });
    expect(eventInsert(calls)).toMatchObject({ title: 'Sydney Card Show', status: 'pending_review' });
    expect(summary).toMatchObject({ scope: 'backlog', pagesFetched: 1, eventsCreated: 1 });
    expect(runUpdate(calls).status).toBe('completed');
  });

  it('re-reads a listing page that is already in the ledger, once it is due', async () => {
    mockFetchWebpage.mockResolvedValue(page);
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent()));
    const calls = scriptDatabase({
      sources: [
        { id: 'seed-due', kind: 'seed_url', value: 'https://example.com.au/calendar/', last_scanned_at: new Date(Date.now() - 9 * 86_400_000).toISOString() },
        { id: 'seed-fresh', kind: 'seed_url', value: 'https://other.example.com.au/events', last_scanned_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
      ],
      knownCandidateUrls: ['https://example.com.au/calendar'],
    });

    const summary = await runEventBacklog();

    expect(mockFetchWebpage).toHaveBeenCalledTimes(1);
    expect(mockFetchWebpage.mock.calls[0][0]).toBe('https://example.com.au/calendar');
    expect(summary.queriesRun).toBe(1);
    const stamped = calls.filter((c) => c.table === 'event_scan_sources' && c.op === 'update')
      .flatMap((c) => c.filters.find(([op]) => op === 'in')?.[2] ?? []);
    expect(stamped).toEqual(['seed-due']);
  });

  it('never fetches our own site or a login-walled host out of the backlog', async () => {
    const calls = scriptDatabase({ backlog: [
      { id: 'c1', url: 'https://cardpop.com.au/events', title: 'CardPop' },
      { id: 'c2', url: 'https://facebook.com/events/1', title: 'FB' },
    ] });

    await runEventBacklog();

    expect(mockFetchWebpage).not.toHaveBeenCalled();
    expect(pageVerdicts(calls).map((u) => u.status)).toEqual(['rejected', 'rejected']);
  });

  it('retires finds nobody read within four months, unread', async () => {
    const calls = scriptDatabase();

    await runEventBacklog();

    const retire = calls.find((c) => c.table === 'event_scan_candidates' && c.op === 'update' && c.filters.some(([op]) => op === 'lt'));
    expect(retire.payload.status).toBe('rejected');
    expect(retire.filters).toContainEqual(['eq', 'status', 'pending']);
  });

  it('leaves pages it had no time for pending, and says so', async () => {
    mockFetchWebpage.mockResolvedValue(page);
    const realNow = Date.now;
    let jump = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + jump);
    mockAnthropicCreate.mockImplementation(async () => { jump = 10 * 60_000; return extractionResponse(validEvent()); });
    const calls = scriptDatabase({
      backlog: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, url: `https://example.com.au/show-${i}`, title: 'Show' })),
    });

    const summary = await runEventBacklog();
    vi.restoreAllMocks();

    // Three readers start one page each; none starts a second after the deadline.
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(3);
    expect(summary.warnings.some((w) => w.includes('5 page(s) wait for the next run'))).toBe(true);
    expect(pageVerdicts(calls)).toHaveLength(3);
  });
});

describe('runEventScan — weekly', () => {
  it('claims only search queries, and tells the admin when finds are left for the backlog', async () => {
    mockAnthropicCreate.mockResolvedValueOnce(searchResponse(
      Array.from({ length: 25 }, (_, i) => ({ type: 'web_search_result', url: `https://example.com.au/e-${i}`, title: `E${i}` })),
    ));
    mockAnthropicCreate.mockResolvedValue(extractionResponse(validEvent({ is_trading_card_event: false, rejection_reason: 'Not an event.' })));
    mockFetchWebpage.mockResolvedValue(`<html><body>${'text '.repeat(100)}</body></html>`);
    const calls = scriptDatabase({ sources: [{ id: 's1', kind: 'search_query', value: 'card show sydney' }] });

    const summary = await runEventScan();

    const claim = calls.find((c) => c.table === 'event_scan_sources' && c.op === 'select');
    expect(claim.filters).toContainEqual(['in', 'kind', ['search_query']]);
    expect(mockFetchWebpage).toHaveBeenCalledTimes(18);
    expect(summary.warnings).toContain('7 found page(s) were not read this run; the daily backlog run reads them.');
  });
});
