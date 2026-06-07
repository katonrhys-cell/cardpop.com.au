import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile]         = useState(null);
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('mfa_enabled')
      .eq('id', data.user.id)
      .single();

    if (profileData?.mfa_enabled) {
      const res = await fetch('/hcgi/api/auth/mfa/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, email: data.user.email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to send MFA code');
      }
      const mfaResult = await res.json();
      // Set session eagerly — MFA is a UI gate; backend APIs are already protected by Supabase JWT.
      if (data.session) {
        setSession(data.session);
        setCurrentUser(data.session.user);
      }
      return { requiresMfa: true, mfaId: mfaResult.mfaId };
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/reset-password`,
    });
    if (error) throw new Error(error.message);
    return true;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return true;
  };

  const isAdmin    = profile?.is_admin    ?? false;
  // Read email_confirmed_at from the raw session user, not from mergedUser,
  // so that profile fields can never accidentally shadow it.
  const isVerified = session?.user?.email_confirmed_at != null;

  const mergedUser = currentUser
    ? { ...currentUser, ...profile, id: currentUser.id }
    : null;

  const value = {
    currentUser: mergedUser,
    profile,
    session,
    authToken:       session?.access_token ?? null,
    isAuthenticated: !!session,
    isAdmin,
    isVerified,
    isEmailVerified: isVerified,
    loading,
    profileLoading,
    signup,
    login,
    logout,
    requestOTP:             async () => { throw new Error('OTP auth not supported — use email/password.'); },
    requestMFA:             async () => { throw new Error('Use Supabase MFA.'); },
    loginWithOTP:           async () => { throw new Error('Use Supabase MFA.'); },
    verifyMFACode:          async (mfaId, _otpId, code) => {
      const res = await fetch('/hcgi/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaId, code }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'MFA verification failed');
      }
      return res.json();
    },
    enableMFA:              async () => {},
    disableMFA:             async () => {},
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
