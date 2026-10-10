import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { planFromTier, isProAccount, PLAN_HOBBY } from '@/config/plans.js';
import { isVerified as isIdVerified } from '@/utils/verification.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// How long a loaded profile is trusted before a refocus re-reads it.
export const PROFILE_REFRESH_MIN_MS = 5 * 60_000;

// Does the user object a new auth event carries differ from the one in state
// in any way a consumer could observe? Everything else about it (a fresh
// object for the same record) is noise from supabase-js re-announcing the
// session on refocus.
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function userChanged(prev, next) {
  if (prev === next) return false;
  if (!prev || !next) return true;
  return prev.id !== next.id
    || prev.email !== next.email
    || prev.phone !== next.phone
    || prev.updated_at !== next.updated_at
    || prev.email_confirmed_at !== next.email_confirmed_at
    || prev.last_sign_in_at !== next.last_sign_in_at
    || !sameJson(prev.app_metadata, next.app_metadata)
    || !sameJson(prev.user_metadata, next.user_metadata);
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile]         = useState(null);
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  // MFA gating: when a session is only AAL1 but the user has a verified factor,
  // the login MFA challenge is still outstanding and the session must NOT count
  // as authenticated. checkedUserId tracks which user the AAL result applies
  // to, so isAuthenticated never briefly flips true before the first check for
  // that user completes. It is deliberately keyed by user — NOT by access
  // token — because supabase-js refreshes the token whenever the tab regains
  // focus; gating per token flipped `loading` true on every refocus, which
  // made the route guards unmount the whole page tree (losing any in-progress
  // form/modal state, e.g. the admin event editor). A token refresh can't
  // change the assurance level, and mfaRequired keeps its last value while the
  // re-check below runs, so skipping the gate for an already-checked user is
  // safe.
  const [mfaRequired, setMfaRequired] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState(null);
  const isMounted = useRef(true);
  // Which user's profile is currently loaded. Lets repeat auth events for the
  // same user (token refresh on tab refocus) leave profileLoading alone —
  // flipping it would unmount every guarded route.
  const loadedProfileUserRef = useRef(null);
  // When the profile was last read, so a refocus only re-reads it after
  // PROFILE_REFRESH_MIN_MS (the realtime channel below keeps it fresh in
  // between; the periodic re-read covers events that channel may have missed
  // while the tab was hidden).
  const lastProfileFetchAtRef = useRef(0);
  // The user object currently in state. supabase-js re-announces the session
  // (`SIGNED_IN` / `TOKEN_REFRESHED`) every time the tab regains focus, each
  // time with a freshly deserialised user object. Handing that new object to
  // setCurrentUser re-ran every effect keyed on `currentUser` across the app —
  // a dozen pages refetched their data on every alt-tab. Keep the identity
  // unless something a consumer can see has actually changed.
  const lastUserRef = useRef(null);

  const applyUser = (user) => {
    if (!userChanged(lastUserRef.current, user)) return;
    lastUserRef.current = user;
    setCurrentUser(user);
  };

  const fetchProfile = async (userId) => {
    if (!userId) return null;
    lastProfileFetchAtRef.current = Date.now();
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', userId)
      .single();
    if (error) console.warn('[AuthContext] fetchProfile error:', error.message);
    return data ?? null;
  };

  useEffect(() => {
    isMounted.current = true;

    // Hard timeouts to unblock UI if Supabase never responds.
    const authTimeout    = setTimeout(() => { if (isMounted.current) { setLoading(false); setProfileLoading(false); } }, 6000);
    const profileTimeout = setTimeout(() => { if (isMounted.current) setProfileLoading(false); }, 8000);

    // Rely solely on onAuthStateChange for session state.
    // Using getSession() concurrently caused a race where a stale null result
    // would prematurely set profileLoading=false, making isAdmin appear false.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted.current) return;

        // Keep the session object's identity when neither the token nor the
        // user changed (a refocus re-announcing the same session), so the
        // context value — and every consumer — doesn't churn for nothing.
        setSession((prev) => (
          prev && newSession && prev.access_token === newSession.access_token && prev.user?.id === newSession.user?.id
            ? prev
            : newSession
        ));
        applyUser(newSession?.user ?? null);
        clearTimeout(authTimeout);
        if (isMounted.current) setLoading(false);

        if (newSession?.user) {
          // Only gate the UI behind profileLoading the first time we load this
          // user's profile. Later events for the same user (TOKEN_REFRESHED /
          // SIGNED_IN on tab refocus) don't re-read it at all unless the user
          // record changed (USER_UPDATED) or the last read is old; when they
          // do, it is a background refresh that never unmounts guarded routes.
          const isNewUser = loadedProfileUserRef.current !== newSession.user.id;
          const stale = Date.now() - lastProfileFetchAtRef.current >= PROFILE_REFRESH_MIN_MS;
          if (!isNewUser && event !== 'USER_UPDATED' && !stale) return;
          if (isMounted.current && isNewUser) setProfileLoading(true);
          try {
            const p = await fetchProfile(newSession.user.id);
            if (isMounted.current) {
              if (p) {
                loadedProfileUserRef.current = newSession.user.id;
                setProfile(p);
              } else if (isNewUser) {
                // No profile for this user (or first fetch failed) — clear any
                // previous user's profile. On a background refresh, keep the
                // last good profile instead of wiping isAdmin over a transient
                // fetch error (which would bounce admins out of /admin).
                setProfile(null);
              }
              setProfileLoading(false); clearTimeout(profileTimeout);
            }
          } catch (e) {
            console.error('[AuthContext] fetchProfile failed:', e);
            if (isMounted.current) { setProfileLoading(false); clearTimeout(profileTimeout); }
          }
        } else {
          loadedProfileUserRef.current = null;
          if (isMounted.current) { setProfile(null); setProfileLoading(false); clearTimeout(profileTimeout); }
        }
      }
    );

    return () => {
      isMounted.current = false;
      clearTimeout(authTimeout);
      clearTimeout(profileTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Safety net: if profile wasn't set by onAuthStateChange (e.g. slow network,
  // swallowed error), fetch it directly whenever currentUser is available and
  // profile is still null. Retries with backoff because a single transient
  // failure — common on flaky mobile connections — would otherwise strand the
  // session with no profile (isAdmin=false, name falls back to "Collector",
  // avatar falls back to the generic icon) until a manual page reload. Once a
  // fetch succeeds the effect stops retrying; each new currentUser resets it.
  useEffect(() => {
    if (!currentUser?.id || profile !== null) return;
    let cancelled = false;
    const timers = [];
    // ~1s, 2s, 4s, 8s, 16s between attempts (6 tries over ~30s total).
    const MAX_ATTEMPTS = 6;

    const attempt = (n) => {
      if (cancelled || !isMounted.current) return;
      fetchProfile(currentUser.id).then(p => {
        if (cancelled || !isMounted.current) return;
        if (p) {
          loadedProfileUserRef.current = currentUser.id;
          setProfile(p);
          setProfileLoading(false);
        } else if (n < MAX_ATTEMPTS - 1) {
          timers.push(setTimeout(() => attempt(n + 1), 1000 * 2 ** n));
        } else {
          setProfileLoading(false);
        }
      }).catch(() => {
        if (cancelled || !isMounted.current) return;
        if (n < MAX_ATTEMPTS - 1) {
          timers.push(setTimeout(() => attempt(n + 1), 1000 * 2 ** n));
        } else {
          setProfileLoading(false);
        }
      });
    };

    attempt(0);
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [currentUser?.id, profile]);

  // Keep the profile (and therefore isAdmin) fresh while the app is open by
  // subscribing to realtime UPDATEs on the current user's own profiles row.
  // Without this, a mid-session change such as an admin being demoted would
  // leave stale chrome (the Admin nav/links) visible until a full reload.
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;
    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          if (isMounted.current && payload.new) setProfile(payload.new);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // Derive whether an MFA challenge is still outstanding for the current session
  // from Supabase's assurance level. Runs whenever the access token changes
  // (login, refresh, MFA upgrade) so a page reload mid-challenge can't bypass it.
  useEffect(() => {
    const token = session?.access_token ?? null;
    const userId = session?.user?.id ?? null;
    if (!token) { setMfaRequired(false); setCheckedUserId(null); return; }
    let cancelled = false;
    // Timeout after 5 seconds to prevent indefinite MFA blocking if Supabase is slow
    const mfaTimeout = setTimeout(() => {
      if (!cancelled && isMounted.current) {
        setMfaRequired(false);
        setCheckedUserId(userId);
      }
    }, 5000);
    supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data }) => {
        if (cancelled || !isMounted.current) return;
        clearTimeout(mfaTimeout);
        setMfaRequired(data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2');
        setCheckedUserId(userId);
      })
      .catch(() => {
        if (!cancelled && isMounted.current) {
          clearTimeout(mfaTimeout);
          setMfaRequired(false);
          setCheckedUserId(userId);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(mfaTimeout);
    };
  }, [session?.access_token, session?.user?.id]);

  const signup = async (email, password, fullName, captchaToken, { next } = {}) => {
    const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
    // Optional app-internal path appended to the confirmation link, so a buyer
    // who signed up from checkout returns there after confirming (WelcomePage
    // honours ?next=; anything that isn't a plain internal path is dropped).
    const nextParam = typeof next === 'string' && /^\/(?!\/)/.test(next) ? `?next=${encodeURIComponent(next)}` : '';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
        // Required when Cloudflare Turnstile CAPTCHA is enabled in Supabase.
        // Harmlessly ignored when it isn't.
        captchaToken,
        // Where Supabase sends the confirmation-email link. /welcome establishes
        // the session then routes the newly email-verified user into onboarding
        // (ID verification → add a card → wallet). This URL must be added to
        // Supabase → Authentication → URL Configuration → Redirect URLs, else
        // Supabase falls back to the Site URL and the chain isn't entered.
        emailRedirectTo: `${window.location.origin}/welcome${nextParam}`,
      },
    });
    if (error) throw error;
    return data;
  };

  const login = async (email, password, captchaToken) => {
    // (email, IP) brute-force gate — ask the backend's lockout tracker whether
    // this attempt is even allowed before touching Supabase. A network error
    // reaching the check fails open (mirrors the backend's own catch-and-allow
    // behavior); only an explicit 429 lockout blocks sign-in.
    //
    // NOTE: this check is TELEMETRY / UX, NOT a security boundary. It runs only
    // in our own client; the actual credential check below is a direct
    // client→Supabase call, so an attacker scripting GoTrue never hits it. The
    // real brute-force/credential-stuffing boundary is Supabase-native: the
    // Turnstile captchaToken passed below (once CAPTCHA is enabled in the
    // Supabase dashboard) + Supabase Auth rate limits. See
    // docs/auth-brute-force-protection.md (audit M2).
    let attemptRes = null;
    try {
      attemptRes = await apiServerClient.fetch('/auth/login/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (_networkErr) {
      attemptRes = null;
    }
    if (attemptRes?.status === 429) {
      const body = await attemptRes.json().catch(() => ({}));
      throw new Error(body.error || 'Account temporarily locked due to too many failed login attempts.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });

    if (error) {
      apiServerClient.fetch('/auth/login/record-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
      throw new Error(error.message);
    }

    apiServerClient.fetch('/auth/login/record-success', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {});

    // Check if the user has a verified TOTP factor enrolled via Supabase native MFA.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find(f => f.status === 'verified');

    if (totpFactor) {
      // The session is only AAL1 until the challenge is completed. Mark MFA as
      // required so isAuthenticated stays false until verifyMFACode upgrades it.
      setMfaRequired(true);
      if (data.session) {
        setSession(data.session);
        applyUser(data.session.user);
      }
      return { requiresMfa: true, factorId: totpFactor.id };
    }

    // Eagerly update session state so ProtectedRoute sees isAuthenticated=true
    // before onAuthStateChange fires asynchronously.
    if (data.session) {
      setSession(data.session);
      applyUser(data.session.user);
    }
    return data;
  };

  const logout = async () => {
    // Clear local state and storage first so UI updates immediately
    // even if the Supabase signOut network call hangs.
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
    } catch (_) { /* storage unavailable in some envs */ }
    applyUser(null);
    setProfile(null);
    setSession(null);
    setMfaRequired(false);
    loadedProfileUserRef.current = null;
    lastProfileFetchAtRef.current = 0;
    setCheckedUserId(null);
    // Fire signOut in background — don't await so a hanging request
    // doesn't block the user from being logged out locally.
    supabase.auth.signOut().catch(e => console.error('[AuthContext] signOut failed:', e));
  };

  const resendVerificationEmail = async (email, captchaToken) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { captchaToken },
    });
    if (error) throw new Error(error.message);
    return true;
  };

  const resetPassword = async (email, captchaToken) => {
    // Must point at a real, public route that renders PasswordResetPage so the
    // recovery link resolves (there is no /account/reset-password route).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      // Required when Turnstile CAPTCHA is enabled in Supabase.
      captchaToken,
    });
    if (error) throw new Error(error.message);
    return true;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return true;
  };

  // ── Supabase native TOTP MFA ──────────────────────────────────────────────

  // mfa.verify() resolves with the session's tokens at the top level
  // ({ access_token, refresh_token, expires_in, token_type, user }) — there is
  // no `data.session`. A successful verify means the session is now AAL2, so
  // clear mfaRequired unconditionally rather than waiting for the assurance
  // re-check (which made the login page flash), and adopt the upgraded
  // tokens. supabase-js has already persisted them and will also emit
  // MFA_CHALLENGE_VERIFIED with the canonical session.
  const applyVerifiedSession = (data) => {
    const upgraded = data?.session
      ?? (data?.access_token
        ? {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_type: data.token_type,
            expires_in: data.expires_in,
            expires_at: data.expires_at ?? Math.round(Date.now() / 1000) + (Number(data.expires_in) || 0),
            user: data.user,
          }
        : null);
    if (upgraded?.access_token) {
      setSession(upgraded);
      if (upgraded.user) applyUser(upgraded.user);
    }
    setMfaRequired(false);
  };

  // Start enrollment: returns { id, totp: { qr_code, secret, uri } }
  const enrollTOTP = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) throw new Error(error.message);
    return data;
  };

  // Confirm enrollment with the first code from the authenticator app,
  // and upgrade the session to AAL2.
  const confirmTOTP = async (factorId, code) => {
    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId });
    if (ce) throw new Error(ce.message);
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) throw new Error(error.message);
    applyVerifiedSession(data);
    return data;
  };

  // Remove a TOTP factor (disables MFA).
  const unenrollTOTP = async (factorId) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new Error(error.message);
  };

  // List enrolled MFA factors.
  const listMFAFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    return data;
  };

  // Complete the MFA challenge at login (upgrades session from AAL1 → AAL2).
  const verifyMFACode = async (factorId, code) => {
    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId });
    if (ce) throw new Error(ce.message);
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) throw new Error(error.message);
    applyVerifiedSession(data);
    return data;
  };

  const isAdmin    = profile?.is_admin    ?? false;
  // Read email_confirmed_at from the raw session user, not from mergedUser,
  // so that profile fields can never accidentally shadow it.
  const isVerified = session?.user?.email_confirmed_at != null;

  // ── Account plan (Hobby free vs Pro) ──────────────────────────────────────
  // `subscription_tier` is the plan column ('free' = Hobby, 'pro'+ = Pro); the
  // Pro subscription lifecycle is mirrored onto `subscription_status`. Both are
  // consulted so a brief mismatch can't lock a paying member out. UX only — the
  // real Pro enforcement lives server-side.
  const subscriptionStatus = profile?.subscription_status ?? null;
  const subscriptionTier = profile?.subscription_tier ?? 'free';
  const plan = profile ? planFromTier(subscriptionTier) : PLAN_HOBBY;
  const isPro = isProAccount({ subscriptionTier, subscriptionStatus });

  // Pro free-trial window (drives the "N days left" nudges on the membership UI).
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = trialEndsAt != null && trialEndsAt.getTime() > Date.now();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null;

  // ── Selling / trading entitlement (identity verification + card on file) ───
  // Mirrors the DB `can_sell()` rule: ANY account — free Hobby included — may
  // list/sell/trade once it has (1) completed Stripe Identity verification AND
  // (2) a card on file (so the per-sale/trade fee can always be collected). It
  // is not gated on a paid subscription. `is_verified` is the identity flag
  // (distinct from `isVerified` below, which is *email* confirmation).
  const isIdentityVerified = isIdVerified(profile?.is_verified);
  const hasSavedCard = profile?.has_saved_card === true;
  const canSell = isIdentityVerified && hasSavedCard;

  // Memoize so the reference is stable across re-renders that don't change the
  // user/profile (e.g. loading/mfaRequired toggles). Consumers that key effects
  // on currentUser would otherwise re-fire on every AuthProvider render.
  const mergedUser = useMemo(
    () => {
      if (!currentUser) return null;
      const merged = { ...currentUser, ...profile, id: currentUser.id };
      // A photo may sit in either column depending on which form saved it
      // (see utils/profileAvatar.js); expose one `avatar_url` to every consumer.
      if (!merged.avatar_url && merged.profile_photo_or_character) {
        merged.avatar_url = merged.profile_photo_or_character;
      }
      return merged;
    },
    [currentUser, profile],
  );

  // The auth functions above are re-created each render (they close over the
  // latest state). Handing them to consumers through a ref + once-created
  // wrappers gives them a PERMANENTLY stable identity without ever calling a
  // stale closure — which lets `value` below memoize on data fields alone.
  const fnsRef = useRef({});
  fnsRef.current = {
    signup,
    login,
    logout,
    verifyMFACode,
    enrollTOTP,
    confirmTOTP,
    unenrollTOTP,
    listMFAFactors,
    resendVerificationEmail,
    resetPassword,
    updatePassword,
    refetchProfile: async () => {
      if (session?.user?.id) {
        const p = await fetchProfile(session.user.id);
        if (isMounted.current) {
          if (p) loadedProfileUserRef.current = session.user.id;
          setProfile(p);
        }
      }
    },
  };
  const stableFns = useMemo(() => {
    const wrap = (name) => (...args) => fnsRef.current[name](...args);
    return {
      signup: wrap('signup'),
      login: wrap('login'),
      logout: wrap('logout'),
      requestOTP:   async () => { throw new Error('OTP auth not supported — use email/password.'); },
      requestMFA:   async () => { throw new Error('Use Supabase MFA.'); },
      loginWithOTP: async () => { throw new Error('Use Supabase MFA.'); },
      verifyMFACode: wrap('verifyMFACode'),
      enrollTOTP: wrap('enrollTOTP'),
      confirmTOTP: wrap('confirmTOTP'),
      unenrollTOTP: wrap('unenrollTOTP'),
      listMFAFactors: wrap('listMFAFactors'),
      resendVerificationEmail: wrap('resendVerificationEmail'),
      resetPassword: wrap('resetPassword'),
      updatePassword: wrap('updatePassword'),
      refetchProfile: wrap('refetchProfile'),
    };
  }, []);

  // Keep loading until the MFA assurance level for the current user is known,
  // so ProtectedRoute never flashes protected content before the check lands.
  // Keyed per user (not per token) so a background token refresh on tab
  // refocus doesn't flip loading and unmount every guarded route.
  const effectiveLoading = loading || (!!session && checkedUserId !== session.user?.id);

  // Memoized so a AuthProvider re-render that changes nothing consumers read
  // (e.g. the token-refresh listener firing on tab refocus with the same
  // session object) doesn't hand every useAuth() consumer a fresh reference
  // and re-render the whole tree. trialEndsAt is a derived Date (new identity
  // each render) — its dep is covered by `profile`; the derived primitives
  // (trialActive/trialDaysLeft) dep directly so an in-session flip still
  // propagates.
  const value = useMemo(() => ({
    currentUser: mergedUser,
    profile,
    session,
    authToken: session?.access_token ?? null,
    // A session with an outstanding MFA challenge (AAL1 while a verified factor
    // exists) does not count as authenticated.
    isAuthenticated: !!session && !mfaRequired,
    mfaRequired,
    isAdmin,
    isVerified,
    isEmailVerified: isVerified,
    // Identity (Stripe Identity) verification — one of the selling/trading gates.
    isIdentityVerified,
    // Whether the user has a card on file — the other selling/trading gate.
    hasSavedCard,
    // Selling/trading entitlement — see the derivation above (identity + card).
    canSell,
    // Account plan.
    plan,               // 'hobby' | 'pro'
    isPro,
    subscriptionTier,
    subscriptionStatus,
    trialActive,
    trialEndsAt,
    trialDaysLeft,
    loading: effectiveLoading,
    profileLoading,
    ...stableFns,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    mergedUser, profile, session, mfaRequired, isAdmin, isVerified,
    isIdentityVerified, hasSavedCard, canSell, plan, isPro, subscriptionTier,
    subscriptionStatus, trialActive, trialDaysLeft, effectiveLoading,
    profileLoading, stableFns,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
