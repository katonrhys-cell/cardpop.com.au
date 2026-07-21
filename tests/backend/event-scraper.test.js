import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The SSRF guard resolves the host before fetching; stub DNS to a public IP so
// the happy-path tests don't depend on real network resolution.
const mockDnsLookup = vi.hoisted(() => vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]));
vi.mock('dns/promises', () => ({
  default: { lookup: mockDnsLookup },
  lookup: mockDnsLookup,
}));

// The route fetches via undici's own fetch/Agent (not the Node global fetch) so
// the custom DNS-pinning dispatcher works — mock that module directly.
const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('undici', () => ({
  fetch: mockFetch,
  Agent: class {},
}));

vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  decodeAal: () => 'aal2',
  default: (_req, _res, next) => next(),
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1', app_metadata: { is_admin: true } }; next(); },
  isAdminUser: async (req) => req.user?.app_metadata?.is_admin === true,
}));

const mockAiStream = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/integrated-ai.js', () => ({
  stream: mockAiStream,
  streamOneShot: vi.fn(),
  uploadImagesToSupabase: vi.fn(),
  uploadImagesToSupabase: vi.fn(),
  ContentBlockType: { Text: 'text', Image: 'image' },
}));

vi.mock('../../src/constants/prompts.js', () => ({
  EventScraperPrompt: 'mock-event-scraper-prompt',
  SystemPrompt: 'mock-system-prompt',
  CardOCRPrompt: 'mock-ocr-prompt',
}));

const mockSupabaseInsert = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: {
    from: vi.fn().mockReturnValue({
      insert: mockSupabaseInsert,
    }),
  },
}));

import eventScraperRouter, { ssrfSafeLookup, validateAndNormalizeEventData } from '../../src/routes/event-scraper.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', eventScraperRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeSseStream() {
  const emitter = new EventEmitter();
  emitter.pipe = vi.fn().mockImplementation((dest) => {
    setImmediate(() => dest.end());
    return dest;
  });
  emitter.destroy = vi.fn();
  return emitter;
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── POST /scrape-event-url ───────────────────────────────────────────────────

describe('POST /scrape-event-url', () => {
  it('returns 400 when url is missing', async () => {
    const res = await request(app).post('/scrape-event-url').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url is required/i);
  });

  it('returns 400 when url is whitespace-only', async () => {
    const res = await request(app).post('/scrape-event-url').send({ url: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url is required/i);
  });

  it('returns 400 when url is an invalid format', async () => {
    const res = await request(app).post('/scrape-event-url').send({ url: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid url/i);
  });

  it('returns 400 when url uses a non-http scheme', async () => {
    const res = await request(app).post('/scrape-event-url').send({ url: 'ftp://example.com/event' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid url/i);
  });

  it('returns fetched text content for a valid https url', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<html><body><p>Pokemon Card Show this Saturday!</p></body></html>',
    });

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.content).toContain('Pokemon Card Show this Saturday!');
  });

  it('strips script and style tags from the response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<html><head><style>.a{}</style></head><body><script>alert(1)</script><p>Clean</p></body></html>',
    });

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.body.content).not.toContain('<script>');
    expect(res.body.content).not.toContain('.a{}');
    expect(res.body.content).toContain('Clean');
  });

  it('returns 400 when the fetch call throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when the fetched page returns a non-ok status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.status).toBe(400);
  });

  it('blocks a literal private/loopback IP url before ever calling fetch', async () => {
    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'http://127.0.0.1/latest' });

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('routes the connection through the SSRF-pinning dispatcher', async () => {
    // Regression coverage for the wiring: fetch must be called with a
    // dispatcher (ssrfSafeDispatcher), not the bare hostname-based call a
    // DNS-rebinding attacker could exploit if the check and the connection
    // used two independent lookups. The actual blocking behaviour of that
    // dispatcher's lookup function is covered directly below.
    mockFetch.mockResolvedValue({ ok: true, text: async () => '<p>ok</p>' });

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/event',
      expect.objectContaining({ dispatcher: expect.anything() }),
    );
  });
});

// ─── ssrfSafeLookup (the DNS-rebinding-safe dispatcher lookup) ────────────────

describe('ssrfSafeLookup', () => {
  it('rejects a hostname that resolves to a private/link-local address', async () => {
    mockDnsLookup.mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);

    await new Promise((resolve) => {
      ssrfSafeLookup('metadata.evil.example', {}, (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toMatch(/private address/);
        resolve();
      });
    });
  });

  it('allows a hostname that resolves to a public address, returning the validated address', async () => {
    mockDnsLookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);

    await new Promise((resolve) => {
      ssrfSafeLookup('example.com', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('93.184.216.34');
        expect(family).toBe(4);
        resolve();
      });
    });
  });

  it('rejects when any resolved address is private, even if others are public (DNS-rebinding-adjacent multi-A-record case)', async () => {
    mockDnsLookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);

    await new Promise((resolve) => {
      ssrfSafeLookup('mixed.evil.example', { all: true }, (err) => {
        expect(err).toBeInstanceOf(Error);
        resolve();
      });
    });
  });
});

// ─── POST /extract-event-from-content ────────────────────────────────────────

describe('POST /extract-event-from-content', () => {
  it('returns 400 when content is missing', async () => {
    const res = await request(app).post('/extract-event-from-content').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content is required/i);
  });

  it('returns 400 when content is whitespace-only', async () => {
    const res = await request(app).post('/extract-event-from-content').send({ content: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content is required/i);
  });

  it('sends an SSE error event when AI stream initialization fails', async () => {
    mockAiStream.mockRejectedValue(new Error('AI service unavailable'));

    const res = await request(app)
      .post('/extract-event-from-content')
      .send({ content: 'Pokemon Card Show event details here' });

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('AI service unavailable');
  });

  it('sets SSE headers when content is valid', async () => {
    mockAiStream.mockRejectedValue(new Error('AI down'));

    const res = await request(app)
      .post('/extract-event-from-content')
      .send({ content: 'Some event text' });

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
  });
});

// ─── validateAndNormalizeEventData ────────────────────────────────────────────

describe('validateAndNormalizeEventData — accessibility & age restrictions', () => {
  it('trims and keeps accessibility_info and age_restrictions', () => {
    const normalized = validateAndNormalizeEventData({
      title: 'Test',
      accessibility_info: '  Wheelchair accessible venue  ',
      age_restrictions: '18+',
    });
    expect(normalized.accessibility_info).toBe('Wheelchair accessible venue');
    expect(normalized.age_restrictions).toBe('18+');
  });

  it('nulls missing, blank, or non-string values', () => {
    const missing = validateAndNormalizeEventData({ title: 'Test' });
    expect(missing.accessibility_info).toBeNull();
    expect(missing.age_restrictions).toBeNull();

    const invalid = validateAndNormalizeEventData({
      title: 'Test',
      accessibility_info: '   ',
      age_restrictions: 18,
    });
    expect(invalid.accessibility_info).toBeNull();
    expect(invalid.age_restrictions).toBeNull();
  });
});

// ─── POST /create-event-from-data ─────────────────────────────────────────────

describe('POST /create-event-from-data', () => {
  it('returns 400 when eventData is missing', async () => {
    const res = await request(app).post('/create-event-from-data').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/eventdata is required/i);
  });

  it('returns 400 when eventData.title is missing', async () => {
    const res = await request(app)
      .post('/create-event-from-data')
      .send({ eventData: { event_type: 'card_show' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/event title is required/i);
  });

  it('returns 400 when eventData.title is an empty string', async () => {
    const res = await request(app)
      .post('/create-event-from-data')
      .send({ eventData: { title: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/event title is required/i);
  });

  it('creates event and returns 201', async () => {
    const created = { id: 'evt-1', title: 'Pokemon Card Show', status: 'pending_review' };
    mockSupabaseInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      }),
    });

    const res = await request(app)
      .post('/create-event-from-data')
      .send({ eventData: { title: 'Pokemon Card Show', event_type: 'card_show' } });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.eventId).toBe('evt-1');
    expect(res.body.event).toEqual(created);
  });

  it('inserts with status set to pending_review', async () => {
    const created = { id: 'evt-2', title: 'Test', status: 'pending_review' };
    mockSupabaseInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      }),
    });

    await request(app)
      .post('/create-event-from-data')
      .send({ eventData: { title: 'Test Event' } });

    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review' }),
    );
  });

  it('removes source_url from the insert payload', async () => {
    const created = { id: 'evt-3', title: 'Test', status: 'pending_review' };
    mockSupabaseInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      }),
    });

    await request(app)
      .post('/create-event-from-data')
      .send({ eventData: { title: 'Test', source_url: 'https://example.com' } });

    expect(mockSupabaseInsert.mock.calls[0][0]).not.toHaveProperty('source_url');
  });

  it('returns 500 when the Supabase insert returns an error', async () => {
    mockSupabaseInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB constraint failed') }),
      }),
    });

    const res = await request(app)
      .post('/create-event-from-data')
      .send({ eventData: { title: 'Failing Event' } });

    expect(res.status).toBe(500);
  });
});
