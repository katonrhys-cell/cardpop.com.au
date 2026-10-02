import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// mfa.verify() returns tokens at the top level (AuthMFAVerifyResponseData:
// { access_token, refresh_token, expires_in, token_type, user }) — never a
// `session` key. A successful verify must still clear mfaRequired.

const h = vi.hoisted(() => ({
  authCallback: null,
  aalResult: { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null },
}));

vi.mock('@/lib/supabaseClient.js', () => {
  const mfa = {
    getAuthenticatorAssuranceLevel: vi.fn(() => Promise.resolve(h.aalResult)),
    listFactors: vi.fn(() => Promise.resolve({ data: { totp: [] }, error: null })),
    challenge: vi.fn(() => Promise.resolve({ data: { id: 'challenge-1' }, error: null })),
    verify: vi.fn(() => Promise.resolve({
      data: {
        access_token: 'aal2-token', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
        user: { id: 'user-1', email: 'a@b.com' },
      },
      error: null,
    })),
  };
  const auth = {
    onAuthStateChange: vi.fn((cb) => { h.authCallback = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    mfa,
  };
  const builder = {
    select: vi.fn(function () { return this; }),
    eq: vi.fn(function () { return this; }),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  const channel = () => { const ch = { on: vi.fn(() => ch), subscribe: vi.fn(() => ch) }; return ch; };
  const supabase = { auth, from: vi.fn(() => builder), channel: vi.fn(channel), removeChannel: vi.fn() };
  return { supabase, default: supabase };
});
vi.mock('@/lib/apiServerClient.js', () => {
  const client = { fetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) };
  return { default: client, apiServerClient: client };
});

import { AuthProvider, useAuth } from '@/contexts/AuthContext.jsx';

let captured;
function Consumer() {
  captured = useAuth();
  return (
    <div>
      <span data-testid="mfaRequired">{String(captured.mfaRequired)}</span>
      <span data-testid="authToken">{captured.authToken ?? 'none'}</span>
    </div>
  );
}
const txt = (id) => screen.getByTestId(id).textContent;
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { vi.clearAllMocks(); h.aalResult = { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }; });

describe('AuthContext MFA verify', () => {
  it('verifyMFACode clears mfaRequired using the real verify response shape', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await act(async () => {
      await h.authCallback('SIGNED_IN', { access_token: 'aal1-token', user: { id: 'user-1', email: 'a@b.com' } });
    });
    await settle();
    expect(txt('mfaRequired')).toBe('true');

    h.aalResult = { data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null };
    await act(async () => { await captured.verifyMFACode('factor-1', '123456'); });
    expect(txt('mfaRequired')).toBe('false');
    expect(txt('authToken')).toBe('aal2-token');
  });
});
