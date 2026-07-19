import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { isEntitled } from '@/config/subscription.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

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
  // same user (token refresh on tab refocus) re-fetch the profile silently in
  // the background instead of flipping profileLoading true — which would also
  // unmount every guarded route.
  const loadedProfileUserRef = useRef(null);

  const fetchProfile = async (userId) => {
    if (!userId) return null;
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
      async (_event, newSession) => {
        if (!isMounted.current) return;

        setSession(newSession);
        setCurrentUser(newSession?.user ?? null);
        clearTimeout(authTimeout);
        if (isMounted.current) setLoading(false);

        if (newSession?.user) {
          // Only gate the UI behind profileLoading the first time we load this
          // user's profile. Subsequent events (TOKEN_REFRESHED / SIGNED_IN on
          // tab refocus) refresh it in the background without unmounting
          // guarded routes.
          const isNewUser = loadedProfileUserRef.current !== newSession.user.id;
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
  // profile is still null.
  useEffect(() => {
    if (!currentUser?.id || profile !== null) return;
    let cancelled = false;
    fetchProfile(currentUser.id).then(p => {
      if (!cancelled && isMounted.current && p) {
        loadedProfileUserRef.current = currentUser.id;
        setProfile(p);
        setProfileLoading(false);
      }
    }).catch(() => {
      if (!cancelled && isMounted.current) setProfileLoading(false);
    });
    return () => { cancelled = true; };
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

  const signup = async (email, password, fullName, captchaToken) => {
    const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
        // Required when Cloudflare Turnstile CAPTCHA is enabled in Supabase.
        // Harmlessly ignored when it isn't.
        captchaToken,
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
        setCurrentUser(data.session.user);
      }
      return { requiresMfa: true, factorId: totpFactor.id };
    }

    // Eagerly update session state so ProtectedRoute sees isAuthenticated=true
    // before onAuthStateChange fires asynchronously.
    if (data.session) {
      setSession(data.session);
      setCurrentUser(data.session.user);
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
    setCurrentUser(null);
    setProfile(null);
    setSession(null);
    setMfaRequired(false);
    loadedProfileUserRef.current = null;
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
    if (data.session) {
      setSession(data.session);
      setCurrentUser(data.session.user);
      setMfaRequired(false);
    }
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
    if (data.session) {
      setSession(data.session);
      setCurrentUser(data.session.user);
      setMfaRequired(false);
    }
    return data;
  };

  const isAdmin    = profile?.is_admin    ?? false;
  // Read email_confirmed_at from the raw session user, not from mergedUser,
  // so that profile fields can never accidentally shadow it.
  const isVerified = session?.user?.email_confirmed_at != null;

  // ── Selling entitlement (free trial / subscription) ───────────────────────
  // Mirrors the DB `can_sell()` rule: an active/trialing/grandfathered
  // subscription, or an unexpired trial window, grants listing/selling access.
  // This drives UX only; the database RLS policy is the real enforcement.
  const subscriptionStatus = profile?.subscription_status ?? null;
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = trialEndsAt != null && trialEndsAt.getTime() > Date.now();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null;
  const canSell = isEntitled(subscriptionStatus) || trialActive;

  // Memoize so the reference is stable across re-renders that don't change the
  // user/profile (e.g. loading/mfaRequired toggles). Consumers that key effects
  // on currentUser would otherwise re-fire on every AuthProvider render.
  const mergedUser = useMemo(
    () => (currentUser ? { ...currentUser, ...profile, id: currentUser.id } : null),
    [currentUser, profile],
  );

  const value = {
    currentUser: mergedUser,
    profile,
    session,
    authToken:       session?.access_token ?? null,
    // A session with an outstanding MFA challenge (AAL1 while a verified factor
    // exists) does not count as authenticated.
    isAuthenticated: !!session && !mfaRequired,
    mfaRequired,
    isAdmin,
    isVerified,
    isEmailVerified: isVerified,
    // Selling entitlement — see the derivation above.
    canSell,
    subscriptionStatus,
    trialActive,
    trialEndsAt,
    trialDaysLeft,
    // Keep loading until the MFA assurance level for the current user is known,
    // so ProtectedRoute never flashes protected content before the check lands.
    // Keyed per user (not per token) so a background token refresh on tab
    // refocus doesn't flip loading and unmount every guarded route.
    loading: loading || (!!session && checkedUserId !== session.user?.id),
    profileLoading,
    signup,
    login,
    logout,
    requestOTP:             async () => { throw new Error('OTP auth not supported — use email/password.'); },
    requestMFA:             async () => { throw new Error('Use Supabase MFA.'); },
    loginWithOTP:           async () => { throw new Error('Use Supabase MFA.'); },
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
