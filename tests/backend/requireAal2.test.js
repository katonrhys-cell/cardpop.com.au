import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockListFactors = vi.hoisted(() => vi.fn());
const mockSupabase = vi.hoisted(() => ({
  auth: { admin: { mfa: { listFactors: mockListFactors } } },
}));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireAal2, decodeAal } from '../../src/middleware/requireAal2.js';

// Build a JWT-shaped string whose payload carries the given claims. Only the
// payload segment is read (the middleware never verifies the signature — the
// token is already trusted by authMiddleware upstream).
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = (claims) => `h.${b64url(claims)}.sig`;

function makeApp({ userId = 'user-1' } = {}) {
  const app = express();
  app.use((req, _res, next) => { req.user = userId ? { id: userId } : undefined; next(); });
  app.use(requireAal2);
  app.get('/protected', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

const authed = (app, tok) => {
  const r = request(app).get('/protected');
  return tok ? r.set('Authorization', `Bearer ${tok}`) : r;
};

beforeEach(() => vi.clearAllMocks());

describe('decodeAal', () => {
  it('extracts the aal claim', () => {
    expect(decodeAal(token({ aal: 'aal2' }))).toBe('aal2');
    expect(decodeAal(token({ aal: 'aal1' }))).toBe('aal1');
  });
  it('returns null for a token without an aal claim or a malformed token', () => {
    expect(decodeAal(token({ sub: 'x' }))).toBeNull();
    expect(decodeAal('not-a-jwt')).toBeNull();
    expect(decodeAal('')).toBeNull();
  });
});

describe('requireAal2', () => {
  it('401s when no bearer token is present', async () => {
    const res = await authed(makeApp(), null);
    expect(res.status).toBe(401);
    expect(mockListFactors).not.toHaveBeenCalled();
  });

  it('allows an AAL2 token without even checking factors', async () => {
    const res = await authed(makeApp(), token({ aal: 'aal2' }));
    expect(res.status).toBe(200);
    expect(mockListFactors).not.toHaveBeenCalled();
  });

  it('rejects an AAL1 token when the user has a verified factor', async () => {
    mockListFactors.mockResolvedValue({ data: { factors: [{ status: 'verified' }] }, error: null });
    const res = await authed(makeApp(), token({ aal: 'aal1' }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('mfa_required');
    expect(mockListFactors).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('allows an AAL1 token when the user has NO verified factor (never locks out non-MFA users)', async () => {
    mockListFactors.mockResolvedValue({ data: { factors: [{ status: 'unverified' }] }, error: null });
    const res = await authed(makeApp(), token({ aal: 'aal1' }));
    expect(res.status).toBe(200);
  });

  it('allows an AAL1 token when the user has no factors at all', async () => {
    mockListFactors.mockResolvedValue({ data: { factors: [] }, error: null });
    const res = await authed(makeApp(), token({ aal: 'aal1' }));
    expect(res.status).toBe(200);
  });

  it('treats a missing aal claim as not-stepped-up and still enforces for MFA users', async () => {
    mockListFactors.mockResolvedValue({ data: { factors: [{ status: 'verified' }] }, error: null });
    const res = await authed(makeApp(), token({ sub: 'user-1' }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('mfa_required');
  });

  it('fails CLOSED (403) when the factor lookup errors', async () => {
    mockListFactors.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await authed(makeApp(), token({ aal: 'aal1' }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('mfa_check_failed');
  });
});
