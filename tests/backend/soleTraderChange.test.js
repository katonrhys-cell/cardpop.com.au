import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSend = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/emailService.js', () => ({ sendSoleTraderChanged: mockSend }));

const mockRecipients = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmails: mockRecipients }));

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1', email: 'rfkates09@hotmail.com' }; next(); },
  isAdminUser: vi.fn(),
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({ requireAdmin: (_req, _res, next) => next() }));

const db = vi.hoisted(() => ({ profile: null, admins: [], inserts: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const sb = {
    from: (table) => ({
      select: () => ({
        eq: (col) => (col === 'is_admin'
          ? Promise.resolve({ data: db.admins, error: null })
          : { maybeSingle: () => Promise.resolve({ data: db.profile, error: null }) }),
      }),
      insert: (rows) => { db.inserts.push({ table, rows }); return Promise.resolve({ error: null }); },
    }),
  };
  return { default: sb, supabase: sb };
});

import storesRouter from '../../src/routes/stores.js';

const app = express();
app.use(express.json());
app.use('/', storesRouter);

const PROFILE = {
  id: 'user-1', email: 'rfkates09@hotmail.com', display_name: 'Parallel House AU',
  is_sole_trader: true, business_name: 'Parallel House AU', abn: '', store_slug: 'parallel-house-au',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.profile = { ...PROFILE };
  db.admins = [{ id: 'admin-1' }];
  db.inserts = [];
  mockSend.mockResolvedValue(true);
  mockRecipients.mockResolvedValue(['admin@cardpop.com.au']);
});

describe('POST /sole-trader-change', () => {
  it('rejects a non-boolean body', async () => {
    const res = await request(app).post('/sole-trader-change').send({ enabled: 'yes' });
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('emails the admins and bells them when the saved state matches', async () => {
    const res = await request(app).post('/sole-trader-change').send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notified: true });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['admin@cardpop.com.au'], enabled: true, userName: 'Parallel House AU', storeSlug: 'parallel-house-au',
    }));
    expect(db.inserts[0].table).toBe('notifications');
    expect(db.inserts[0].rows[0]).toMatchObject({ user_id: 'admin-1', type: 'sole_trader_changed', related_id: 'user-1' });
  });

  it('reports a switch OFF', async () => {
    db.profile = { ...PROFILE, is_sole_trader: false };
    await request(app).post('/sole-trader-change').send({ enabled: false });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('sends nothing when the claim does not match the database', async () => {
    const res = await request(app).post('/sole-trader-change').send({ enabled: false });
    expect(res.body).toEqual({ notified: false });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
