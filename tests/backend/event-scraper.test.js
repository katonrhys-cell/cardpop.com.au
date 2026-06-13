import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1', app_metadata: { is_admin: true } }; next(); },
}));

const mockAiStream = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/integrated-ai.js', () => ({
  stream: mockAiStream,
  streamOneShot: vi.fn(),
  uploadImagesToSupabase: vi.fn(),
  uploadImagesToPocketBase: vi.fn(),
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

import eventScraperRouter from '../../src/routes/event-scraper.js';

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body><p>Pokemon Card Show this Saturday!</p></body></html>',
    }));

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.content).toContain('Pokemon Card Show this Saturday!');
  });

  it('strips script and style tags from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><style>.a{}</style></head><body><script>alert(1)</script><p>Clean</p></body></html>',
    }));

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.body.content).not.toContain('<script>');
    expect(res.body.content).not.toContain('.a{}');
    expect(res.body.content).toContain('Clean');
  });

  it('returns 500 when the fetch call throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.status).toBe(500);
  });

  it('returns 500 when the fetched page returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    const res = await request(app)
      .post('/scrape-event-url')
      .send({ url: 'https://example.com/event' });

    expect(res.status).toBe(500);
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
