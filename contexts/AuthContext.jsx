import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { isEntitled } from '@/config/subscription.js';

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
  // as authenticated. checkedToken tracks which access token the AAL result
  // applies to, so isAuthenticated never briefly flips true before we've checked.
  const [mfaRequired, setMfaRequired] = useState(false);
  const [checkedToken, setCheckedToken] = useState(null);
  const isMounted = useRef(true);

  const fetchProfile = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
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
          if (isMounted.current) setProfileLoading(true);
          try {
            const p = await fetchProfile(newSession.user.id);
            if (isMounted.current) { setProfile(p); setProfileLoading(false); clearTimeout(profileTimeout); }
          } catch (e) {
            console.error('[AuthContext] fetchProfile failed:', e);
            if (isMounted.current) { setProfileLoading(false); clearTimeout(profileTimeout); }
          }
        } else {
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
    if (!token) { setMfaRequired(false); setCheckedToken(null); return; }
    let cancelled = false;
    // Timeout after 5 seconds to prevent indefinite MFA blocking if Supabase is slow
    const mfaTimeout = setTimeout(() => {
      if (!cancelled && isMounted.current) {
        setMfaRequired(false);
        setCheckedToken(token);
      }
    }, 5000);
    supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data }) => {
        if (cancelled || !isMounted.current) return;
        clearTimeout(mfaTimeout);
        setMfaRequired(data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2');
        setCheckedToken(token);
      })
      .catch(() => {
        if (!cancelled && isMounted.current) {
          clearTimeout(mfaTimeout);
          setMfaRequired(false);
          setCheckedToken(token);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(mfaTimeout);
    };
  }, [session?.access_token]);

  const signup = async (email, password, fullName) => {
    const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
      },
    });
    if (error) throw error;
    return data;
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

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
    // Fire signOut in background — don't await so a hanging request
    // doesn't block the user from being logged out locally.
    supabase.auth.signOut().catch(e => console.error('[AuthContext] signOut failed:', e));
  };

  const resendVerificationEmail = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
    return true;
  };

  const resetPassword = async (email) => {
    // Must point at a real, public route that renders PasswordResetPage so the
    // recovery link resolves (there is no /account/reset-password route).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
    // Keep loading until the MFA assurance level for the current token is known,
    // so ProtectedRoute never flashes protected content before the check lands.
    loading: loading || (!!session && checkedToken !== session.access_token),
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
        if (isMounted.current) setProfile(p);
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
