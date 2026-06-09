import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  auth: {
    admin: {
      generateLink: vi.fn().mockResolvedValue({ error: null }),
      listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
      updateUserById: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1', email: 'test@example.com' }; next(); },
}));

// Mock the anon client created inside password.js via createClient
const mockAnonSignIn = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    auth: { signInWithPassword: mockAnonSignIn },
  }),
}));

vi.mock('../../../src/utils/passwordValidator.js', () => ({
  validatePassword: vi.fn().mockReturnValue({ isStrong: true, strengthScore: 5, missing: [] }),
}));

import passwordRouter from '../../../src/routes/auth/password.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', passwordRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: fn => Promise.resolve(result).catch(fn),
  };
  return b;
}

beforeEach(() => vi.clearAllMocks());

// ─── POST /validate ───────────────────────────────────────────────────────────

describe('POST /validate', () => {
  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/validate').send({});
    expect(res.status).toBe(400);
  });

  it('returns strength info for a valid password', async () => {
    const res = await request(app).post('/validate').send({ password: 'StrongPass1!' });
    expect(res.status).toBe(200);
    expect(res.body.isStrong).toBe(true);
    expect(res.body.strengthScore).toBeDefined();
  });
});

// ─── POST /reset/request ──────────────────────────────────────────────────────

describe('POST /reset/request', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/reset/request').send({});
    expect(res.status).toBe(400);
  });

  it('always returns success (prevents enumeration)', async () => {
    const res = await request(app).post('/reset/request').send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('calls generateLink with recovery type', async () => {
    await request(app).post('/reset/request').send({ email: 'test@example.com' });
    expect(mockSupabase.auth.admin.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recovery', email: 'test@example.com' }),
    );
  });
});

// ─── POST /change ─────────────────────────────────────────────────────────────

describe('POST /change', () => {
  it('returns 400 when currentPassword is missing', async () => {
    const res = await request(app).post('/change').send({ newPassword: 'NewPass1!' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const res = await request(app).post('/change').send({ currentPassword: 'OldPass1!' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when new password is same as current', async () => {
    const res = await request(app).post('/change').send({ currentPassword: 'Same1!', newPassword: 'Same1!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/i);
  });

  it('returns 400 when current password is wrong', async () => {
    mockAnonSignIn.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } });
    const res = await request(app).post('/change').send({ currentPassword: 'Wrong1!', newPassword: 'NewPass1!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/incorrect/i);
  });

  it('changes password successfully', async () => {
    mockAnonSignIn.mockResolvedValueOnce({ error: null });
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/change').send({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { password: 'NewPass1!' });
  });
});
