import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/constants/prompts.js', () => ({
  EventScraperPrompt: 'mock-event-scraper-prompt',
}));

const mockAnthropicCreate = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {
      this.beta = { messages: { create: mockAnthropicCreate } };
    }
  },
}));

// The Graph API client is stubbed; its own behaviour is covered in
// instagramClient.test.js.
const mockFetchAccountPosts = vi.hoisted(() => vi.fn());
const mockFetchTaggedPosts = vi.hoisted(() => vi.fn());
const mockDownloadImage = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/instagramClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAccountPosts: mockFetchAccountPosts,
    fetchTaggedPosts: mockFetchTaggedPosts,
    downloadPostImage: mockDownloadImage,
  };
});

const dbHandler = vi.hoisted(() => ({ current: () => ({ data: null, error: null }) }));

function makeQuery(table) {
  const state = { table, op: 'select', payload: null, filters: [] };
  const resolve = () => Promise.resolve(dbHandler.current(state));
  const query = {
    select() { return query; },
    insert(payload) { state.op = 'insert'; state.payload = payload; return query; },
    update(payload) { state.op = 'update'; state.payload = payload; return query; },
    delete() { state.op = 'delete'; return query; },
    eq(col, val) { state.filters.push(['eq', col, val]); return query; },
    in(col, val) { state.filters.push(['in', col, val]); return query; },
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

const { runInstagramEventScan, extractEventFromInstagramPost, isReadablePost } =
  await import('../../src/utils/instagramEventScanner.js');
const { InstagramApiError } = await import('../../src/utils/instagramClient.js');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const post = (overrides = {}) => ({
  id: '1',
  permalink: 'https://www.instagram.com/p/AAA/',
  caption: 'Sydney Card Show is back! Rosehill Gardens, doors 9am. $5 entry.',
  timestamp: daysAgo(2),
  mediaType: 'IMAGE',
  username: 'cardshowsau',
  imageUrls: ['https://scontent.cdninstagram.com/flyer.jpg'],
  ...overrides,
});

const extraction = (overrides = {}) => ({
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 10 },
  content: [{
    type: 'text',
    text: JSON.stringify({
      is_trading_card_event: true,
      rejection_reason: null,
      title: 'Sydney Card Show',
      short_description: 'A card show.',
      description: 'A card show in Sydney.',
      event_type: 'card_show',
      featured_card_games: ['Pokemon'],
      venue_name: 'Rosehill Gardens',
      address: '',
      suburb: 'Rosehill',
      state: 'NSW',
      postcode: '',
      start_date: inDays(20),
      end_date: null,
      start_time: '09:00',
      end_time: null,
      organizer_name: 'Card Shows AU',
      organizer_email: '',
      organizer_phone: '',
      website_url: '',
      ticket_url: '',
      entry_fee_aud: 5,
      presale_fee_aud: null,
      is_free: false,
      capacity: null,
      registration_required: false,
      accessibility_info: '',
      age_restrictions: '',
      image_url: 'https://scontent.cdninstagram.com/flyer.jpg',
      seo_title: '',
      seo_description: '',
      seo_keywords: [],
      tags: [],
      ...overrides,
    }),
  }],
});

const ACCOUNT = { id: 'src-1', kind: 'instagram_account', value: 'cardshowsau' };
const TAGGED = { id: 'src-tag', kind: 'instagram_tagged', value: 'tagged' };

function scriptDatabase({ sources = [ACCOUNT], knownUrls = [], existingEvents = [] } = {}) {
  const calls = [];
  dbHandler.current = (state) => {
    calls.push(state);
    if (state.table === 'event_scan_runs') {
      return state.op === 'insert' ? { data: { id: 'run-1' }, error: null } : { data: null, error: null };
    }
    if (state.table === 'event_scan_sources') {
      return state.op === 'select' ? { data: sources, error: null } : { data: null, error: null };
    }
    if (state.table === 'event_scan_candidates') {
      if (state.op === 'select') return { data: knownUrls.map((url, i) => ({ id: `known-${i}`, url })), error: null };
      if (state.op === 'insert') {
        return { data: state.payload.map((row) => ({ id: `cand-${row.url}`, url: row.url, title: row.title })), error: null };
      }
      return { data: null, error: null };
    }
    if (state.table === 'events') {
      if (state.op === 'insert') return { data: { id: 'event-1', slug: state.payload.slug, title: state.payload.title }, error: null };
      const bySource = state.filters.find(([, col]) => col === 'source_url');
      if (bySource) return { data: existingEvents.filter((e) => e.source_url === bySource[2]), error: null };
      return { data: existingEvents, error: null };
    }
    return { data: null, error: null };
  };
  return calls;
}

const eventInsert = (calls) => calls.find((c) => c.table === 'events' && c.op === 'insert')?.payload;
const candidateInserts = (calls) => calls.filter((c) => c.table === 'event_scan_candidates' && c.op === 'insert').flatMap((c) => c.payload);
const candidateUpdates = (calls) => calls
  .filter((c) => c.table === 'event_scan_candidates' && c.op === 'update' && c.payload.status)
  .map((c) => c.payload);
const runRow = (calls) => calls.filter((c) => c.table === 'event_scan_runs' && c.op === 'update').pop()?.payload;
const sourcesStamped = (calls) => calls
  .filter((c) => c.table === 'event_scan_sources' && c.op === 'update')
  .flatMap((c) => c.filters.find(([op]) => op === 'in')?.[2] ?? []);

const ENV_KEYS = ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'ANTHROPIC_API_KEY'];
const saved = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.INSTAGRAM_ACCESS_TOKEN = 'secret-token';
  process.env.INSTAGRAM_ACCOUNT_ID = '17840000000000000';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  mockDownloadImage.mockResolvedValue({ mediaType: 'image/jpeg', data: 'BASE64' });
  mockFetchAccountPosts.mockResolvedValue([post()]);
  mockFetchTaggedPosts.mockResolvedValue([]);
  mockAnthropicCreate.mockResolvedValue(extraction());
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('isReadablePost', () => {
  it('skips old posts and posts with nothing to read', () => {
    expect(isReadablePost(post())).toBe(true);
    expect(isReadablePost(post({ timestamp: daysAgo(90) }))).toBe(false);
    expect(isReadablePost(post({ imageUrls: [], caption: 'Soon!' }))).toBe(false);
    expect(isReadablePost(post({ imageUrls: [], caption: 'x'.repeat(60) }))).toBe(true);
    expect(isReadablePost(post({ permalink: '' }))).toBe(false);
  });
});

describe('extractEventFromInstagramPost', () => {
  it('sends the caption and the flyer photos, under the event schema', async () => {
    await extractEventFromInstagramPost(post(), [{ mediaType: 'image/jpeg', data: 'BASE64' }]);

    const params = mockAnthropicCreate.mock.calls[0][0];
    expect(params.output_config.format.type).toBe('json_schema');
    const content = params.messages[0].content;
    expect(content[0].text).toContain('@cardshowsau');
    expect(content[0].text).toContain('Rosehill Gardens');
    expect(content[0].text).toContain('untrusted');
    expect(content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'BASE64' } });
  });

  it('links the organiser account and never keeps an expiring CDN photo or an Instagram "website"', async () => {
    mockAnthropicCreate.mockResolvedValue(extraction({ website_url: 'https://www.instagram.com/cardshowsau/' }));

    const { eventData } = await extractEventFromInstagramPost(post(), []);

    expect(eventData.image_url).toBeNull();
    expect(eventData.website_url).toBeNull();
    expect(eventData.instagram_url).toBe('https://www.instagram.com/cardshowsau/');
    expect(eventData.source_url).toBe('https://www.instagram.com/p/AAA/');
  });

  it('passes a "not an event" verdict through', async () => {
    mockAnthropicCreate.mockResolvedValue(extraction({ is_trading_card_event: false, rejection_reason: 'A recap of last weekend.' }));

    expect(await extractEventFromInstagramPost(post(), [])).toEqual({ rejected: 'A recap of last weekend.' });
  });
});

describe('runInstagramEventScan', () => {
  it('does nothing — no run row, no API call — until Instagram is connected', async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    const calls = scriptDatabase();

    expect(await runInstagramEventScan()).toEqual({ skipped: 'not_configured' });
    expect(calls).toHaveLength(0);
    expect(mockFetchAccountPosts).not.toHaveBeenCalled();
  });

  it('does nothing when no Instagram source is switched on', async () => {
    const calls = scriptDatabase({ sources: [] });

    expect(await runInstagramEventScan()).toEqual({ skipped: 'no_sources' });
    expect(calls.some((c) => c.table === 'event_scan_runs')).toBe(false);
    // Only Instagram kinds are claimed.
    expect(calls[0].filters).toContainEqual(['in', 'kind', ['instagram_account', 'instagram_tagged']]);
  });

  it('files a new post as a pending_review draft linked to the organiser', async () => {
    const calls = scriptDatabase();

    const summary = await runInstagramEventScan({ trigger: 'manual', triggeredBy: 'admin-1' });

    expect(calls.find((c) => c.table === 'event_scan_runs' && c.op === 'insert').payload)
      .toMatchObject({ scope: 'instagram', trigger: 'manual', triggered_by: 'admin-1' });
    expect(candidateInserts(calls)).toEqual([expect.objectContaining({
      url: 'https://instagram.com/p/AAA', source_id: 'src-1', status: 'pending',
    })]);
    expect(eventInsert(calls)).toMatchObject({
      title: 'Sydney Card Show',
      status: 'pending_review',
      auto_discovered: true,
      source_url: 'https://www.instagram.com/p/AAA/',
      instagram_url: 'https://www.instagram.com/cardshowsau/',
      image_url: null,
    });
    expect(candidateUpdates(calls)).toEqual([expect.objectContaining({ status: 'imported', event_id: 'event-1' })]);
    expect(summary).toMatchObject({ scope: 'instagram', queriesRun: 1, candidatesFound: 1, pagesFetched: 1, eventsCreated: 1 });
    expect(runRow(calls)).toMatchObject({ status: 'completed', events_created: 1 });
    expect(sourcesStamped(calls)).toEqual(['src-1']);
  });

  it('never sends a post to the model twice', async () => {
    const calls = scriptDatabase({ knownUrls: ['https://instagram.com/p/AAA'] });

    const summary = await runInstagramEventScan();

    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(candidateInserts(calls)).toEqual([]);
    expect(summary.candidatesFound).toBe(0);
  });

  it('treats a second post about the same show as a duplicate, by organiser account and date', async () => {
    const calls = scriptDatabase({
      existingEvents: [{
        id: 'event-9', title: 'SCS Summer Edition', venue_name: null, source_url: 'https://www.instagram.com/p/OLD/',
        instagram_url: 'https://www.instagram.com/CardShowsAU/',
      }],
    });

    const summary = await runInstagramEventScan();

    expect(eventInsert(calls)).toBeUndefined();
    expect(candidateUpdates(calls)).toEqual([expect.objectContaining({ status: 'duplicate', event_id: 'event-9' })]);
    expect(summary.duplicatesSkipped).toBe(1);
  });

  it('reads posts that tag CardPop', async () => {
    mockFetchTaggedPosts.mockResolvedValue([post({ permalink: 'https://www.instagram.com/p/TAG/', username: 'neworganiser' })]);
    const calls = scriptDatabase({ sources: [TAGGED] });

    await runInstagramEventScan();

    expect(mockFetchAccountPosts).not.toHaveBeenCalled();
    expect(eventInsert(calls).instagram_url).toBe('https://www.instagram.com/neworganiser/');
  });

  it('takes a few new posts per account and leaves the rest unrecorded for the next run', async () => {
    mockFetchAccountPosts.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => post({ id: String(i), permalink: `https://www.instagram.com/p/P${i}/` })),
    );
    const calls = scriptDatabase();

    await runInstagramEventScan();

    expect(candidateInserts(calls)).toHaveLength(4);
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(4);
    // Not read in full, so it keeps its place at the front of the rotation.
    expect(sourcesStamped(calls)).toEqual([]);
  });

  it('skips the model when the photo cannot be read and the caption says nothing', async () => {
    mockFetchAccountPosts.mockResolvedValue([post({ caption: 'Soon!' })]);
    mockDownloadImage.mockResolvedValue(null);
    const calls = scriptDatabase();

    await runInstagramEventScan();

    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(candidateUpdates(calls)).toEqual([expect.objectContaining({ status: 'rejected' })]);
  });

  it('records an unreadable account as a warning and carries on', async () => {
    mockFetchAccountPosts
      .mockRejectedValueOnce(new InstagramApiError('Invalid user id', { code: 110, status: 400 }))
      .mockResolvedValueOnce([post()]);
    const calls = scriptDatabase({ sources: [{ ...ACCOUNT, id: 'src-0', value: 'personalaccount' }, ACCOUNT] });

    const summary = await runInstagramEventScan();

    expect(summary.warnings).toEqual(['@personalaccount: Invalid user id']);
    expect(summary.eventsCreated).toBe(1);
    expect(runRow(calls).status).toBe('completed');
    expect(sourcesStamped(calls).sort()).toEqual(['src-0', 'src-1']);
  });

  it('fails the whole run, loudly, when the token has expired', async () => {
    mockFetchAccountPosts.mockRejectedValue(new InstagramApiError('The Instagram access token has expired', { code: 190, status: 400 }));
    const calls = scriptDatabase({ sources: [ACCOUNT, { ...ACCOUNT, id: 'src-2', value: 'another' }] });

    await expect(runInstagramEventScan()).rejects.toThrow(/expired/);

    expect(mockFetchAccountPosts).toHaveBeenCalledTimes(1);
    expect(runRow(calls)).toMatchObject({ status: 'failed', error: expect.stringMatching(/expired/) });
  });

  it('one failed post does not end the run', async () => {
    mockFetchAccountPosts.mockResolvedValue([
      post({ permalink: 'https://www.instagram.com/p/BAD/' }),
      post({ permalink: 'https://www.instagram.com/p/GOOD/' }),
    ]);
    mockAnthropicCreate.mockRejectedValueOnce(new Error('overloaded')).mockResolvedValueOnce(extraction());
    const calls = scriptDatabase();

    const summary = await runInstagramEventScan();

    expect(summary.eventsCreated).toBe(1);
    expect(candidateUpdates(calls).map((u) => u.status)).toEqual(['failed', 'imported']);
    expect(summary.warnings[0]).toContain('overloaded');
  });

  it('releases posts it ran out of time to read, so the next run sees them', async () => {
    mockFetchAccountPosts.mockResolvedValue([
      post({ permalink: 'https://www.instagram.com/p/ONE/' }),
      post({ permalink: 'https://www.instagram.com/p/TWO/' }),
    ]);
    const realNow = Date.now;
    let jump = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + jump);
    // The first extraction "takes" longer than the run's whole budget.
    mockAnthropicCreate.mockImplementation(async () => { jump = 10 * 60_000; return extraction(); });
    const calls = scriptDatabase();

    const summary = await runInstagramEventScan();
    vi.restoreAllMocks();

    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    const released = calls.find((c) => c.table === 'event_scan_candidates' && c.op === 'delete');
    expect(released.filters).toContainEqual(['in', 'id', ['cand-https://instagram.com/p/TWO']]);
    expect(summary.warnings.some((w) => w.includes('left for the next run'))).toBe(true);
  });
});
