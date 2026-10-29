import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockScoped = vi.hoisted(() => ({ from: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());
const mockSendWinner = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const mockSubscribe = vi.hoisted(() => vi.fn(() => Promise.resolve({ ok: true })));
const mockUser = vi.hoisted(() => ({ current: null }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/userScopedSupabase.js', () => ({ default: () => mockScoped, createUserScopedClient: () => mockScoped }));
vi.mock('../../src/utils/emailService.js', () => ({ sendGiveawayWinner: mockSendWinner }));
vi.mock('../../src/utils/newsletter.js', () => ({ subscribeToNewsletter: mockSubscribe }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, res, next) => { if (!mockUser.current) return res.status(401).json({ error: 'auth' }); req.user = mockUser.current; req.headers.authorization = 'Bearer tok'; next(); },
  optionalAuthMiddleware: (req, _res, next) => { if (mockUser.current) req.user = mockUser.current; next(); },
  isAdminUser: mockIsAdminUser,
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  requireAdmin: async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    if (!(await mockIsAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
    next();
  },
  default: (_req, _res, next) => next(),
}));

import giveawaysRouter from '../../src/routes/giveaways.js';
import { drawWinner, entriesToCsv } from '../../src/services/giveawayService.js';

const app = express();
app.use(express.json());
app.use('/giveaways', giveawaysRouter);

/** Chainable builder resolving `result`; records calls. */
function makeBuilder(result) {
  const calls = [];
  const b = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
      if (prop === 'calls') return calls;
      return (...args) => { calls.push([prop, ...args]); return b; };
    },
  });
  return b;
}

const past = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const future = (h) => new Date(Date.now() + h * 3600_000).toISOString();
const GIVEAWAY = {
  id: '11111111-1111-4111-8111-111111111111', slug: 'hockey-young-guns', title: 'Young Guns Giveaway',
  status: 'open', entry_mode: 'pick_prize', opens_at: past(24), closes_at: future(24),
  prizes: [{ key: 'sacha-boisvert', label: 'Sacha Boisvert' }, { key: 'victor-eklund', label: 'Victor Eklund' }],
  winner_entry_id: null, drawn_at: null, min_age: 18,
};
const ENTRY_BODY = {
  instagramHandle: '@Collector_One', prizeKey: 'sacha-boisvert', state: 'VIC', postcode: '3032',
  residentConfirmed: true, ageConfirmed: true, newsletterOptIn: true,
};

let queue;
beforeEach(() => {
  vi.clearAllMocks();
  mockUser.current = null;
  mockIsAdminUser.mockResolvedValue(false);
  queue = [];
  mockSupabase.from.mockImplementation((table) => {
    const next = queue.shift();
    if (!next) throw new Error(`unexpected query on ${table}`);
    return makeBuilder(next);
  });
});

describe('GET /giveaways/:slug', () => {
  it('returns the giveaway with phase, count and no entry for a guest', async () => {
    queue.push({ data: GIVEAWAY, error: null }, { count: 12, error: null });
    const res = await request(app).get('/giveaways/hockey-young-guns');
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe('open');
    expect(res.body.entryCount).toBe(12);
    expect(res.body.myEntry).toBeNull();
    expect(res.body.winner).toBeNull();
  });
  it('404s a draft giveaway', async () => {
    queue.push({ data: { ...GIVEAWAY, status: 'draft' }, error: null });
    const res = await request(app).get('/giveaways/hockey-young-guns');
    expect(res.status).toBe(404);
  });
  it('shows the winner as a handle and prize only', async () => {
    const drawn = { ...GIVEAWAY, status: 'drawn', winner_entry_id: 'e1', drawn_at: past(1) };
    queue.push({ data: drawn, error: null }, { count: 3, error: null }, { data: { instagram_handle: 'lucky', prize_key: 'victor-eklund' }, error: null });
    const res = await request(app).get('/giveaways/hockey-young-guns');
    expect(res.status).toBe(200);
    expect(res.body.winner).toEqual({ instagram_handle: 'lucky', prize: { key: 'victor-eklund', label: 'Victor Eklund' } });
  });
});

describe('POST /giveaways/:slug/enter', () => {
  it('requires sign-in', async () => {
    const res = await request(app).post('/giveaways/hockey-young-guns/enter').send(ENTRY_BODY);
    expect(res.status).toBe(401);
  });
  it('rejects a body without the residency tick', async () => {
    mockUser.current = { id: 'u1', email: 'u1@example.com' };
    const res = await request(app).post('/giveaways/hockey-young-guns/enter').send({ ...ENTRY_BODY, residentConfirmed: false });
    expect(res.status).toBe(400);
  });
  it('writes through the caller-scoped client with the normalised handle and subscribes on opt-in', async () => {
    mockUser.current = { id: 'u1', email: 'u1@example.com', user_metadata: { full_name: 'Uma' } };
    queue.push({ data: GIVEAWAY, error: null });
    const insert = makeBuilder({ data: { id: 'e1', instagram_handle: 'collector_one', prize_key: 'sacha-boisvert', newsletter_opt_in: true }, error: null });
    mockScoped.from.mockReturnValue(insert);
    const res = await request(app).post('/giveaways/hockey-young-guns/enter').send(ENTRY_BODY);
    expect(res.status).toBe(201);
    expect(mockScoped.from).toHaveBeenCalledWith('giveaway_entries');
    const row = insert.calls.find(([m]) => m === 'insert')[1];
    expect(row).toMatchObject({ giveaway_id: GIVEAWAY.id, user_id: 'u1', instagram_handle: 'collector_one', prize_key: 'sacha-boisvert', state: 'VIC', postcode: '3032', resident_confirmed: true, age_confirmed: true });
    expect(mockSupabase.from).not.toHaveBeenCalledWith('giveaway_entries'); // never the service role
    expect(mockSubscribe).toHaveBeenCalledWith('u1@example.com', 'Uma', {});
  });
  it('refuses once the window has closed, before touching the DB write', async () => {
    mockUser.current = { id: 'u1' };
    queue.push({ data: { ...GIVEAWAY, closes_at: past(1) }, error: null });
    const res = await request(app).post('/giveaways/hockey-young-guns/enter').send(ENTRY_BODY);
    expect(res.status).toBe(409);
    expect(mockScoped.from).not.toHaveBeenCalled();
  });
  it('maps the DB rules to friendly errors', async () => {
    mockUser.current = { id: 'u1' };
    const cases = [
      [{ code: '23505', message: 'duplicate key value violates unique constraint "giveaway_entries_one_per_handle"' }, 409, /Instagram account has already entered/],
      [{ code: '23505', message: 'duplicate key value violates unique constraint "giveaway_entries_one_per_member"' }, 409, /already entered/],
      [{ code: '22023', message: 'Confirm your email address before entering' }, 400, /Confirm your email/],
      [{ code: '42501', message: 'rls' }, 403, /yourself/],
    ];
    for (const [error, status, re] of cases) {
      queue.push({ data: GIVEAWAY, error: null });
      mockScoped.from.mockReturnValue(makeBuilder({ data: null, error }));
      const res = await request(app).post('/giveaways/hockey-young-guns/enter').send(ENTRY_BODY);
      expect(res.status).toBe(status);
      expect(res.body.error).toMatch(re);
    }
  });
  it('swallows the honeypot', async () => {
    mockUser.current = { id: 'u1' };
    const res = await request(app).post('/giveaways/hockey-young-guns/enter').send({ ...ENTRY_BODY, company: 'Acme' });
    expect(res.status).toBe(201);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('admin', () => {
  it('403s a non-admin', async () => {
    mockUser.current = { id: 'u1' };
    const res = await request(app).get('/giveaways/admin');
    expect(res.status).toBe(403);
  });
  it('creates a giveaway with cleaned prizes', async () => {
    mockUser.current = { id: 'admin-1' };
    mockIsAdminUser.mockResolvedValue(true);
    const insert = makeBuilder({ data: { id: GIVEAWAY.id }, error: null });
    queue.push({ data: { id: GIVEAWAY.id }, error: null });
    mockSupabase.from.mockImplementation(() => insert);
    const res = await request(app).post('/giveaways/admin').send({
      slug: 'hockey-young-guns', title: 'Young Guns Giveaway', opensAt: past(1), closesAt: future(48),
      prizes: [{ label: 'Sacha Boisvert' }, { label: 'Victor Eklund', image_url: 'javascript:x' }],
    });
    expect(res.status).toBe(201);
    const row = insert.calls.find(([m]) => m === 'insert')[1];
    expect(row.prizes).toEqual([{ key: 'sacha-boisvert', label: 'Sacha Boisvert' }, { key: 'victor-eklund', label: 'Victor Eklund' }]);
    expect(row.created_by).toBe('admin-1');
    expect(row.status).toBe('draft');
  });
  it('rejects a draw while entries are still open', async () => {
    mockUser.current = { id: 'admin-1' };
    mockIsAdminUser.mockResolvedValue(true);
    queue.push({ data: GIVEAWAY, error: null });
    const res = await request(app).post(`/giveaways/admin/${GIVEAWAY.id}/draw`).send({ pool: 'all' });
    expect(res.status).toBe(409);
    expect(mockSendWinner).not.toHaveBeenCalled();
  });
  it('draws a winner from the verified pool, records it, emails and bells', async () => {
    mockUser.current = { id: 'admin-1' };
    mockIsAdminUser.mockResolvedValue(true);
    const closed = { ...GIVEAWAY, closes_at: past(1) };
    const entries = [
      { id: 'e1', user_id: 'u1', instagram_handle: 'one', prize_key: 'sacha-boisvert', created_at: past(20), verified_at: null },
      { id: 'e2', user_id: 'u2', instagram_handle: 'two', prize_key: 'victor-eklund', created_at: past(10), verified_at: past(2) },
    ];
    const update = makeBuilder({ data: { ...closed, status: 'drawn', winner_entry_id: 'e2' }, error: null });
    const bell = makeBuilder({ data: null, error: null });
    queue.push(
      { data: closed, error: null },
      { data: entries, error: null },
      { data: [{ id: 'u1', email: 'one@example.com', display_name: 'One' }, { id: 'u2', email: 'two@example.com', display_name: 'Two' }], error: null },
      update,
      bell,
    );
    mockSupabase.from.mockImplementation((table) => {
      const next = queue.shift();
      if (!next) throw new Error(`unexpected query on ${table}`);
      return next.calls ? next : makeBuilder(next);
    });
    const res = await request(app).post(`/giveaways/admin/${GIVEAWAY.id}/draw`).send({ pool: 'verified' });
    expect(res.status).toBe(200);
    expect(res.body.winner.instagram_handle).toBe('two');
    expect(res.body.winner.prize.label).toBe('Victor Eklund');
    expect(res.body.record).toMatchObject({ pool: 'verified', count: 1, index: 0 });
    const patch = update.calls.find(([m]) => m === 'update')[1];
    expect(patch).toMatchObject({ status: 'drawn', winner_entry_id: 'e2', drawn_by: 'admin-1' });
    expect(update.calls).toContainEqual(['neq', 'status', 'drawn']);
    expect(mockSendWinner).toHaveBeenCalledWith(expect.objectContaining({ to: 'two@example.com', prizeLabel: 'Victor Eklund', instagramHandle: 'two' }));
    const bellRow = bell.calls.find(([m]) => m === 'insert')[1];
    expect(bellRow).toMatchObject({ user_id: 'u2', type: 'giveaway_won' });
  });
});

describe('giveawayService', () => {
  it('draws with an injectable random over a stable order', () => {
    const entries = [
      { id: 'b', created_at: '2026-11-02T00:00:00Z', verified_at: 'x' },
      { id: 'a', created_at: '2026-11-01T00:00:00Z', verified_at: 'x' },
      { id: 'c', created_at: '2026-11-03T00:00:00Z', verified_at: null },
    ];
    const { winner, record } = drawWinner(entries, { pool: 'verified', randomInt: (_min, max) => max - 1 });
    expect(winner.id).toBe('b');
    expect(record).toMatchObject({ pool: 'verified', count: 2, index: 1 });
    expect(record.nonce).toMatch(/^[0-9a-f]{16}$/);
    expect(drawWinner(entries, { pool: 'all', randomInt: () => 2 }).winner.id).toBe('c');
    expect(drawWinner([], {}).winner).toBeNull();
  });
  it('exports CSV with quoted cells and prize labels', () => {
    const csv = entriesToCsv([{ created_at: 't', instagram_handle: 'h', prize_key: 'a', state: 'VIC', postcode: '3032', verified_at: 'v', email: 'e@x', name: 'Na "me"', user_id: 'u' }], [{ key: 'a', label: 'Card A' }]);
    expect(csv.split('\n')[0]).toBe('entered_at,instagram_handle,prize,state,postcode,verified,email,name,user_id');
    expect(csv.split('\n')[1]).toBe('"t","h","Card A","VIC","3032","yes","e@x","Na ""me""","u"');
  });
});
