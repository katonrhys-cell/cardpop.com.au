import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetUser = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/supabaseClient.js', () => ({
  supabase: { auth: { getUser: mockGetUser } },
  default: { auth: { getUser: mockGetUser } },
}));

import { supabaseAuth } from '../../../src/middleware/supabase-auth.js';

beforeEach(() => vi.clearAllMocks());

describe('supabaseAuth (optional auth)', () => {
  it('continues without a userId when no Authorization header is present', async () => {
    const req = { headers: {} };
    const next = vi.fn();
    await supabaseAuth(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBeUndefined();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('populates req.userId for a valid Bearer token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } }, error: null });
    const req = { headers: { authorization: 'Bearer good-token' } };
    const next = vi.fn();
    await supabaseAuth(req, {}, next);
    expect(mockGetUser).toHaveBeenCalledWith('good-token');
    expect(req.userId).toBe('user-42');
    expect(next).toHaveBeenCalledWith();
  });

  it('continues without a userId when the token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    const req = { headers: { authorization: 'Bearer bad' } };
    const next = vi.fn();
    await supabaseAuth(req, {}, next);
    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('continues unauthenticated (does not surface a 500) when token verification throws', async () => {
    // A thrown getUser is treated as "not authenticated", not a server error —
    // next() is called with no argument so the request proceeds without a userId.
    mockGetUser.mockRejectedValue(new Error('network down'));
    const req = { headers: { authorization: 'Bearer x' } };
    const next = vi.fn();
    await supabaseAuth(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect(req.userId).toBeUndefined();
  });
});
