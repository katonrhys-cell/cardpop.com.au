import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── controllable supabase mock ────────────────────────────────────────────────

// Mutable result bag the mocked client reads at call time, so each test can
// configure auth/profile/MFA responses and drive the onAuthStateChange callback.
const h = vi.hoisted(() => ({
  authCallback: null,
  profileResult: { data: null, error: null },
  aalResult: { data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null },
  listFactorsResult: { data: { totp: [] }, error: null },
  signInResult: { data: { session: null, user: null }, error: null },
  signUpResult: { data: { user: {} }, error: null },
  resendResult: { error: null },
  resetResult: { error: null },
  updateUserResult: { error: null },
  enrollResult: { data: { id: 'factor-1', totp: { qr_code: 'qr', secret: 's', uri: 'u' } }, error: null },
  challengeResult: { data: { id: 'challenge-1' }, error: null },
  verifyResult: { data: { session: null }, error: null },
  unenrollResult: { error: null },
}));

vi.mock('@/lib/supabaseClient.js', () => {
  const mfa = {
    getAuthenticatorAssuranceLevel: vi.fn(() => Promise.resolve(h.aalResult)),
    listFactors: vi.fn(() => Promise.resolve(h.listFactorsResult)),
    enroll: vi.fn(() => Promise.resolve(h.enrollResult)),
    challenge: vi.fn(() => Promise.resolve(h.challengeResult)),
    verify: vi.fn(() => Promise.resolve(h.verifyResult)),
    unenroll: vi.fn(() => Promise.resolve(h.unenrollResult)),
  };
  const auth = {
    onAuthStateChange: vi.fn((cb) => {
      h.authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(() => Promise.resolve(h.signInResult)),
    signUp: vi.fn(() => Promise.resolve(h.signUpResult)),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    resend: vi.fn(() => Promise.resolve(h.resendResult)),
    resetPasswordForEmail: vi.fn(() => Promise.resolve(h.resetResult)),
    updateUser: vi.fn(() => Promise.resolve(h.updateUserResult)),
    mfa,
  };
  const builder = {
    select: vi.fn(function () { return this; }),
    eq: vi.fn(function () { return this; }),
    single: vi.fn(() => Promise.resolve(h.profileResult)),
  };
  const channel = () => {
    const ch = { on: vi.fn(() => ch), subscribe: vi.fn(() => ch) };
    return ch;
  };
  const supabase = {
    auth,
    from: vi.fn(() => builder),
    channel: vi.fn(channel),
    removeChannel: vi.fn(),
  };
  return { supabase, default: supabase };
});

// Backend lockout-gate calls made by login() — default to "allowed" so
// existing login tests exercise the same signInWithPassword path as before.
const apiClient = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('@/lib/apiServerClient.js', () => {
  const client = { fetch: (...args) => apiClient.fetchMock(...args) };
  return { default: client, apiServerClient: client };
});

import { supabase } from '@/lib/supabaseClient.js';
import { AuthProvider, useAuth } from '@/contexts/AuthContext.jsx';

// ─── harness ────────────────────────────────────────────────────────────────────

let captured;
// Every render's loading flags, so tests can assert a state change never even
// transiently flipped them (a transient true unmounts guarded routes).
const renderLog = [];
function Consumer() {
  captured = useAuth();
  const a = captured;
  renderLog.push({ loading: a.loading, profileLoading: a.profileLoading });
  return (
    <div>
      <span data-testid="loading">{String(a.loading)}</span>
      <span data-testid="profileLoading">{String(a.profileLoading)}</span>
      <span data-testid="isAuthenticated">{String(a.isAuthenticated)}</span>
      <span data-testid="isAdmin">{String(a.isAdmin)}</span>
      <span data-testid="isVerified">{String(a.isVerified)}</span>
      <span data-testid="mfaRequired">{String(a.mfaRequired)}</span>
      <span data-testid="userId">{a.currentUser?.id ?? 'none'}</span>
      <span data-testid="userName">{a.currentUser?.full_name ?? 'none'}</span>
      <span data-testid="authToken">{a.authToken ?? 'none'}</span>
    </div>
  );
}

const txt = (id) => screen.getByTestId(id).textContent;

function renderAuth() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

// Let pending effects (MFA assurance check, safety-net profile fetch) settle.
async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

// Drive Supabase's auth-state callback and wait for the resulting async work.
async function emitAuth(event, session) {
  await act(async () => { await h.authCallback(event, session); });
  await settle();
}

const SESSION = {
  access_token: 'token-abc',
  user: { id: 'user-1', email: 'a@b.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
};

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.fetchMock.mockReset();
  apiClient.fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ allowed: true }) });
  h.authCallback = null;
  h.profileResult = { data: null, error: null };
  h.aalResult = { data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null };
  h.listFactorsResult = { data: { totp: [] }, error: null };
  h.signInResult = { data: { session: null, user: null }, error: null };
  h.signUpResult = { data: { user: {} }, error: null };
  h.verifyResult = { data: { session: null }, error: null };
  renderLog.length = 0;
  try { localStorage.clear(); } catch { /* ignore */ }
});

// ─── initial / session state ────────────────────────────────────────────────────

describe('AuthProvider — session state', () => {
  it('subscribes to auth changes and starts in a loading state', () => {
    renderAuth();
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(txt('loading')).toBe('true');
  });

  it('resolves to unauthenticated when there is no session', async () => {
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    expect(txt('loading')).toBe('false');
    expect(txt('isAuthenticated')).toBe('false');
    expect(txt('userId')).toBe('none');
  });

  it('exposes the user, merged profile and derived flags when signed in', async () => {
    h.profileResult = { data: { is_admin: true, full_name: 'Ada Lovelace', username: 'ada' }, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', SESSION);

    expect(txt('isAuthenticated')).toBe('true');
    expect(txt('userId')).toBe('user-1');
    expect(txt('userName')).toBe('Ada Lovelace'); // mergedUser = currentUser + profile
    expect(txt('isAdmin')).toBe('true');
    expect(txt('isVerified')).toBe('true'); // email_confirmed_at present
    expect(txt('authToken')).toBe('token-abc');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('treats a session without email_confirmed_at as unverified', async () => {
    h.profileResult = { data: { is_admin: false }, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', {
      access_token: 't2',
      user: { id: 'user-2', email_confirmed_at: null },
    });
    expect(txt('isVerified')).toBe('false');
    expect(txt('isAdmin')).toBe('false');
  });

  it('never flips loading/profileLoading when the token refreshes for the same user (tab refocus)', async () => {
    // Regression: supabase-js refreshes the session token whenever the tab
    // regains focus and re-fires onAuthStateChange. Flipping either loading
    // flag makes ProtectedRoute/ProtectedAdminRoute swap the page for a
    // spinner, unmounting it and destroying in-progress form/modal state
    // (e.g. the admin event editor closing when you switch tabs and back).
    h.profileResult = { data: { is_admin: true, full_name: 'Ada Lovelace' }, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', SESSION);
    expect(txt('loading')).toBe('false');
    expect(txt('profileLoading')).toBe('false');

    renderLog.length = 0;
    await emitAuth('TOKEN_REFRESHED', { ...SESSION, access_token: 'token-refreshed' });

    expect(renderLog.length).toBeGreaterThan(0);
    expect(renderLog.some(r => r.loading || r.profileLoading)).toBe(false);
    expect(txt('isAuthenticated')).toBe('true');
    expect(txt('authToken')).toBe('token-refreshed');
  });

  it('keeps the last good profile when a background profile re-fetch fails', async () => {
    // A transient profiles read failure on refocus must not wipe isAdmin —
    // that would bounce an admin out of /admin mid-edit.
    h.profileResult = { data: { is_admin: true, full_name: 'Ada Lovelace' }, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', SESSION);
    expect(txt('isAdmin')).toBe('true');

    h.profileResult = { data: null, error: { message: 'network hiccup' } };
    await emitAuth('TOKEN_REFRESHED', { ...SESSION, access_token: 'token-refreshed' });

    expect(txt('isAdmin')).toBe('true');
    expect(txt('userName')).toBe('Ada Lovelace');
  });

  it('still gates behind profileLoading when a different user signs in', async () => {
    h.profileResult = { data: { is_admin: true, full_name: 'Ada Lovelace' }, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', SESSION);

    renderLog.length = 0;
    h.profileResult = { data: { is_admin: false, full_name: 'Grace Hopper' }, error: null };
    await emitAuth('SIGNED_IN', {
      access_token: 'token-user-2',
      user: { id: 'user-2', email: 'g@h.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
    });

    // The switch to a new user must re-gate (transient loading render) so the
    // old user's profile/isAdmin is never shown as the new user's.
    expect(renderLog.some(r => r.loading || r.profileLoading)).toBe(true);
    expect(txt('userId')).toBe('user-2');
    expect(txt('userName')).toBe('Grace Hopper');
    expect(txt('isAdmin')).toBe('false');
    expect(txt('loading')).toBe('false');
    expect(txt('profileLoading')).toBe('false');
  });

  it('keeps isAuthenticated false while an MFA challenge is outstanding (aal1 → aal2)', async () => {
    h.aalResult = { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null };
    h.profileResult = { data: {}, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', SESSION);

    expect(txt('mfaRequired')).toBe('true');
    expect(txt('isAuthenticated')).toBe('false');
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  it('signs in with email/password and updates session state', async () => {
    h.signInResult = {
      data: { session: { access_token: 't', user: { id: 'user-1' } }, user: { id: 'user-1' } },
      error: null,
    };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    let result;
    await act(async () => { result = await captured.login('a@b.com', 'pw', 'captcha-tok'); });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw', options: { captchaToken: 'captcha-tok' } });
    expect(result).toEqual(h.signInResult.data);
    expect(txt('userId')).toBe('user-1');
  });

  it('throws when the credentials are rejected', async () => {
    h.signInResult = { data: {}, error: { message: 'Invalid login credentials' } };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    await act(async () => {
      await expect(captured.login('a@b.com', 'bad')).rejects.toThrow('Invalid login credentials');
    });
  });

  it('checks the (email, IP) lockout before signing in, and records a failure on bad credentials', async () => {
    h.signInResult = { data: {}, error: { message: 'Invalid login credentials' } };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    await act(async () => {
      await expect(captured.login('a@b.com', 'bad')).rejects.toThrow('Invalid login credentials');
    });

    expect(apiClient.fetchMock).toHaveBeenCalledWith('/auth/login/attempt', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'a@b.com' }),
    }));
    expect(apiClient.fetchMock).toHaveBeenCalledWith('/auth/login/record-failure', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'a@b.com' }),
    }));
  });

  it('records success after a valid sign-in', async () => {
    h.signInResult = {
      data: { session: { access_token: 't', user: { id: 'user-1' } }, user: { id: 'user-1' } },
      error: null,
    };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    await act(async () => { await captured.login('a@b.com', 'pw'); });

    expect(apiClient.fetchMock).toHaveBeenCalledWith('/auth/login/record-success', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'a@b.com' }),
    }));
  });

  it('blocks sign-in without calling Supabase when the account is locked out', async () => {
    apiClient.fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'Account temporarily locked due to too many failed login attempts' }) });
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    await act(async () => {
      await expect(captured.login('a@b.com', 'pw')).rejects.toThrow('Account temporarily locked due to too many failed login attempts');
    });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('fails open and still signs in when the lockout check itself is unreachable', async () => {
    apiClient.fetchMock.mockRejectedValueOnce(new Error('network down'));
    h.signInResult = {
      data: { session: { access_token: 't', user: { id: 'user-1' } }, user: { id: 'user-1' } },
      error: null,
    };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    await act(async () => { await captured.login('a@b.com', 'pw'); });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
  });

  it('returns requiresMfa and gates auth when a verified TOTP factor exists', async () => {
    h.signInResult = {
      data: { session: { access_token: 't', user: { id: 'user-1' } }, user: { id: 'user-1' } },
      error: null,
    };
    h.listFactorsResult = { data: { totp: [{ id: 'factor-9', status: 'verified' }] }, error: null };
    // An AAL1 session with a verified factor still has an outstanding aal2 step.
    h.aalResult = { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    let result;
    await act(async () => { result = await captured.login('a@b.com', 'pw'); });
    expect(result).toEqual({ requiresMfa: true, factorId: 'factor-9' });
    expect(txt('mfaRequired')).toBe('true');
    expect(txt('isAuthenticated')).toBe('false');
  });
});

// ─── signup ─────────────────────────────────────────────────────────────────────

describe('signup', () => {
  it('derives a sanitized username and forwards metadata', async () => {
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    await act(async () => { await captured.signup('John.Doe@example.com', 'pw', 'John Doe', 'captcha-tok'); });
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'John.Doe@example.com',
      password: 'pw',
      options: { data: { full_name: 'John Doe', username: 'johndoe' }, captchaToken: 'captcha-tok' },
    });
  });

  it('throws when signUp errors', async () => {
    h.signUpResult = { data: null, error: { message: 'Email already registered' } };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => {
      await expect(captured.signup('x@y.com', 'pw', 'X')).rejects.toThrow('Email already registered');
    });
  });
});

// ─── logout ─────────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears sb-* storage and auth state and calls signOut', async () => {
    localStorage.setItem('sb-access-token', 'secret');
    localStorage.setItem('keep-me', 'yes');
    h.profileResult = { data: { is_admin: true }, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', SESSION);
    expect(txt('isAuthenticated')).toBe('true');

    await act(async () => { await captured.logout(); });

    expect(txt('isAuthenticated')).toBe('false');
    expect(txt('userId')).toBe('none');
    expect(localStorage.getItem('sb-access-token')).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('yes');
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});

// ─── password / verification helpers ─────────────────────────────────────────────

describe('password & verification helpers', () => {
  it('resetPassword targets the public /reset-password route', async () => {
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => { await captured.resetPassword('a@b.com', 'captcha-tok'); });
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'a@b.com',
      { redirectTo: `${window.location.origin}/reset-password`, captchaToken: 'captcha-tok' },
    );
  });

  it('updatePassword calls updateUser and throws on error', async () => {
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => { await captured.updatePassword('newpw'); });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpw' });

    h.updateUserResult = { error: { message: 'weak password' } };
    await act(async () => {
      await expect(captured.updatePassword('123')).rejects.toThrow('weak password');
    });
  });

  it('resendVerificationEmail resends a signup confirmation', async () => {
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => { await captured.resendVerificationEmail('a@b.com', 'captcha-tok'); });
    expect(supabase.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com', options: { captchaToken: 'captcha-tok' } });
  });
});

// ─── TOTP MFA management ─────────────────────────────────────────────────────────

describe('TOTP MFA management', () => {
  it('enrollTOTP returns the enrollment payload', async () => {
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    let data;
    await act(async () => { data = await captured.enrollTOTP(); });
    expect(supabase.auth.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp' });
    expect(data).toEqual(h.enrollResult.data);
  });

  it('confirmTOTP challenges, verifies, and upgrades the session', async () => {
    h.verifyResult = { data: { session: { access_token: 'aal2-token', user: { id: 'user-1' } } }, error: null };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);

    await act(async () => { await captured.confirmTOTP('factor-1', '123456'); });
    expect(supabase.auth.mfa.challenge).toHaveBeenCalledWith({ factorId: 'factor-1' });
    expect(supabase.auth.mfa.verify).toHaveBeenCalledWith({
      factorId: 'factor-1', challengeId: 'challenge-1', code: '123456',
    });
    expect(txt('userId')).toBe('user-1');
    expect(txt('mfaRequired')).toBe('false');
  });

  it('verifyMFACode completes the login challenge and sets the session', async () => {
    h.verifyResult = { data: { session: { access_token: 'aal2', user: { id: 'user-7' } } }, error: null };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => { await captured.verifyMFACode('factor-7', '000111'); });
    expect(txt('userId')).toBe('user-7');
  });

  it('confirmTOTP surfaces a challenge error', async () => {
    h.challengeResult = { data: null, error: { message: 'challenge failed' } };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => {
      await expect(captured.confirmTOTP('factor-1', '123')).rejects.toThrow('challenge failed');
    });
  });

  it('unenrollTOTP throws on error', async () => {
    h.unenrollResult = { error: { message: 'cannot unenroll' } };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => {
      await expect(captured.unenrollTOTP('factor-1')).rejects.toThrow('cannot unenroll');
    });
  });

  it('listMFAFactors returns the factor list', async () => {
    h.listFactorsResult = { data: { totp: [{ id: 'f1', status: 'verified' }] }, error: null };
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    let data;
    await act(async () => { data = await captured.listMFAFactors(); });
    expect(data).toEqual(h.listFactorsResult.data);
  });
});

// ─── refetchProfile & deprecated shims ──────────────────────────────────────────

describe('refetchProfile & deprecated methods', () => {
  it('refetchProfile re-reads the profile for the current session user', async () => {
    h.profileResult = { data: { full_name: 'Old Name' }, error: null };
    renderAuth();
    await emitAuth('SIGNED_IN', SESSION);
    expect(txt('userName')).toBe('Old Name');

    h.profileResult = { data: { full_name: 'New Name' }, error: null };
    await act(async () => { await captured.refetchProfile(); });
    expect(txt('userName')).toBe('New Name');
  });

  it('rejects unsupported legacy auth methods', async () => {
    renderAuth();
    await emitAuth('INITIAL_SESSION', null);
    await act(async () => {
      await expect(captured.requestOTP()).rejects.toThrow(/OTP auth not supported/i);
      await expect(captured.requestMFA()).rejects.toThrow(/Supabase MFA/i);
      await expect(captured.loginWithOTP()).rejects.toThrow(/Supabase MFA/i);
    });
  });
});
