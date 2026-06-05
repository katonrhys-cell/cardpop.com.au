import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile]         = useState(null);
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const isMounted = useRef(true);

  const fetchProfile = async (userId) => {
    if (!userId) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  };

  useEffect(() => {
    isMounted.current = true;

    // Hard timeout: if loading is still true after 6s, unblock the UI.
    // This covers cases where onAuthStateChange never fires (network timeout, etc.).
    const timeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 6000);

    // Eagerly resolve the existing session so the dashboard renders immediately
    // on page load/refresh without waiting for the onAuthStateChange event.
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!isMounted.current) return;
      if (existingSession) {
        setSession(existingSession);
        setCurrentUser(existingSession.user);
        try {
          const p = await fetchProfile(existingSession.user.id);
          if (isMounted.current) setProfile(p);
        } catch (e) {
          console.error('[AuthContext] fetchProfile (getSession) failed:', e);
        }
      }
      if (isMounted.current) {
        setLoading(false);
        clearTimeout(timeout);
      }
    }).catch(() => {
      if (isMounted.current) { setLoading(false); clearTimeout(timeout); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMounted.current) return;

        setSession(newSession);
        setCurrentUser(newSession?.user ?? null);

        if (newSession?.user) {
          try {
            const p = await fetchProfile(newSession.user.id);
            if (isMounted.current) setProfile(p);
          } catch (e) {
            console.error('[AuthContext] fetchProfile failed:', e);
          }
        } else {
          if (isMounted.current) setProfile(null);
        }

        if (isMounted.current) { setLoading(false); clearTimeout(timeout); }
      }
    );

    return () => {
      isMounted.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

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
    signup,
    login,
    logout,
    requestOTP:             async () => { throw new Error('OTP auth not supported — use email/password.'); },
    requestMFA:             async () => { throw new Error('Use Supabase MFA.'); },
    loginWithOTP:           async () => { throw new Error('Use Supabase MFA.'); },
    verifyMFACode:          async () => { throw new Error('Use Supabase MFA.'); },
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
