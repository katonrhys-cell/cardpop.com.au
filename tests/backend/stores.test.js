import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'admin-1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));

import storesRouter from '../../src/routes/stores.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', storesRouter);
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {};
  for (const m of ['select', 'insert', 'eq', 'ilike', 'like', 'order', 'limit']) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}

let builders;
beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(true);
  builders = [];
  mockSupabase.from.mockImplementation(() => {
    const next = builders.shift();
    if (!next) throw new Error('Unexpected supabase query');
    return next;
  });
});

const validBody = {
  name: 'Test Card Emporium',
  suburb: 'Parramatta',
  city: 'sydney',
  state: 'NSW',
  website: 'https://testcards.com.au',
  categories: ['pokemon', 'sports'],
  description: 'Local shop for singles and slabs.',
  email: 'owner@testcards.com.au',
};

describe('POST /stores/submit', () => {
  it('accepts a valid submission as a pending row', async () => {
    const dupCheck = makeBuilder({ data: null, error: null });
    const slugCheck = makeBuilder({ data: [], error: null });
    const insert = makeBuilder({ data: null, error: null });
    builders.push(dupCheck, slugCheck, insert);

    const res = await request(app).post('/submit').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const inserted = insert.insert.mock.calls[0][0];
    expect(inserted.status).toBe('pending');
    expect(inserted.slug).toBe('test-card-emporium-parramatta');
    expect(inserted.categories).toEqual(['pokemon', 'sports']);
  });

  it('silently accepts honeypot submissions without touching the database', async () => {
    const res = await request(app).post('/submit').send({ ...validBody, company: 'spam co' });
    expect(res.status).toBe(200);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('rejects an unknown city', async () => {
    const res = await request(app).post('/submit').send({ ...validBody, city: 'gotham' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing name', async () => {
    const res = await request(app).post('/submit').send({ ...validBody, name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid website URL', async () => {
    const res = await request(app).post('/submit').send({ ...validBody, website: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('rejects URLs smuggled into free-text fields', async () => {
    const res = await request(app).post('/submit').send({ ...validBody, description: 'visit https://spam.example now' });
    expect(res.status).toBe(400);
  });

  it('deduplicates a store already submitted for the same city', async () => {
    builders.push(makeBuilder({ data: { id: 'existing' }, error: null }));
    const res = await request(app).post('/submit').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, duplicate: true });
  });

  it('escapes LIKE wildcards in the submitted name for the duplicate check', async () => {
    // An unescaped ilike('name', name) treats a submitted '%' or '_' as a
    // wildcard, so a name containing one could match (and get silently
    // dropped as a "duplicate" of) an unrelated existing store.
    const dupCheck = makeBuilder({ data: null, error: null });
    const slugCheck = makeBuilder({ data: [], error: null });
    const insert = makeBuilder({ data: null, error: null });
    builders.push(dupCheck, slugCheck, insert);

    await request(app).post('/submit').send({ ...validBody, name: '100% Cards_Store' });

    expect(dupCheck.ilike).toHaveBeenCalledWith('name', '100\\% Cards\\_Store');
  });

  it('suffixes the slug when it is already taken', async () => {
    const dupCheck = makeBuilder({ data: null, error: null });
    const slugCheck = makeBuilder({ data: [{ slug: 'test-card-emporium-parramatta' }], error: null });
    const insert = makeBuilder({ data: null, error: null });
    builders.push(dupCheck, slugCheck, insert);

    const res = await request(app).post('/submit').send(validBody);
    expect(res.status).toBe(200);
    expect(insert.insert.mock.calls[0][0].slug).toBe('test-card-emporium-parramatta-2');
  });

  it('drops invalid categories rather than failing', async () => {
    const dupCheck = makeBuilder({ data: null, error: null });
    const slugCheck = makeBuilder({ data: [], error: null });
    const insert = makeBuilder({ data: null, error: null });
    builders.push(dupCheck, slugCheck, insert);

    await request(app).post('/submit').send({ ...validBody, categories: ['pokemon', 'weapons'] });
    expect(insert.insert.mock.calls[0][0].categories).toEqual(['pokemon']);
  });
});

describe('GET /stores/admin', () => {
  it('returns the full store list (including submitter_email) for an admin', async () => {
    builders.push(makeBuilder({
      data: [{ id: 's1', name: 'Top Deck', status: 'pending', submitter_email: 'owner@example.com' }],
      error: null,
    }));
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
    expect(res.body.stores).toHaveLength(1);
    expect(res.body.stores[0].submitter_email).toBe('owner@example.com');
  });

  it('rejects a non-admin with 403 and runs no query', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).get('/admin');
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
