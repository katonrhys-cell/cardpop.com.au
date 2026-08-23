import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockPush = vi.hoisted(() => ({
  getVapidPublicKey: vi.fn(),
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
  isPushConfigured: vi.fn(),
}));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/pushService.js', () => mockPush);
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
  optionalAuthMiddleware: (req, _res, next) => next(),
  isAdminUser: vi.fn(),
}));

import pushRouter from '../../src/routes/push.js';

const app = express();
app.use(express.json());
app.use('/', pushRouter);

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}

beforeEach(() => vi.clearAllMocks());

const SUB = {
  endpoint: 'https://push.example.com/sub/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

describe('GET /public-key', () => {
  it('returns the configured key', async () => {
    mockPush.getVapidPublicKey.mockReturnValue('vapid-pub');
    const res = await request(app).get('/public-key');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: 'vapid-pub' });
  });

  it('returns null when push is unconfigured', async () => {
    mockPush.getVapidPublicKey.mockReturnValue(null);
    const res = await request(app).get('/public-key');
    expect(res.body).toEqual({ publicKey: null });
  });
});

describe('POST /subscribe', () => {
  it('upserts the subscription for the signed-in user', async () => {
    const builder = makeBuilder({ error: null });
    mockSupabase.from.mockReturnValueOnce(builder);
    const res = await request(app).post('/subscribe').send(SUB);
    expect(res.status).toBe(201);
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', endpoint: SUB.endpoint, p256dh: 'p256dh-key', auth: 'auth-key' }),
      { onConflict: 'endpoint' },
    );
  });

  it('rejects a malformed body', async () => {
    const res = await request(app).post('/subscribe').send({ endpoint: 'not-a-url' });
    expect(res.status).toBe(400);
  });
});

describe('POST /unsubscribe', () => {
  it('deletes only the caller\'s row for that endpoint', async () => {
    const builder = makeBuilder({ error: null });
    mockSupabase.from.mockReturnValueOnce(builder);
    const res = await request(app).post('/unsubscribe').send({ endpoint: SUB.endpoint });
    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('endpoint', SUB.endpoint);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

describe('POST /dispatch', () => {
  const record = { id: 'n-1' };

  it('claims the notification and sends the push once', async () => {
    const claimed = { user_id: 'seller-9', type: 'offer_received', title: 'New offer', body: 'An offer', link: '/account/offers' };
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: claimed, error: null }));

    const res = await request(app).post('/dispatch').send({ type: 'INSERT', record });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true });
    expect(mockPush.sendPushToUser).toHaveBeenCalledWith('seller-9', expect.objectContaining({
      title: 'New offer',
      url: '/account/offers',
      tag: 'offer_received',
    }));
  });

  it('is a no-op when the notification was already claimed', async () => {
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/dispatch').send({ type: 'INSERT', record });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: false });
    expect(mockPush.sendPushToUser).not.toHaveBeenCalled();
  });

  it('rejects a payload without a record id', async () => {
    const res = await request(app).post('/dispatch').send({ type: 'INSERT' });
    expect(res.status).toBe(400);
  });
});
