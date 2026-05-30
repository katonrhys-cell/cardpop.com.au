import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile]         = useState(null);
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);

  // Fetch the public profile row for the signed-in user
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
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setCurrentUser(session?.user ?? null);
        if (session?.user) {
          const p = await fetchProfile(session.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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
    await supabase.auth.signOut();
    setCurrentUser(null);
    setProfile(null);
    setSession(null);
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

  // Profile helpers (kept for compat with components using currentUser.role etc.)
  const isAdmin    = profile?.is_admin    ?? false;
  const isVerified = currentUser?.email_confirmed_at != null;

  // Expose a merged user object that components can read like pb's model
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
    // Legacy no-ops kept so callers don't crash during incremental migration
    requestOTP:             async () => { throw new Error('OTP auth not supported with Supabase — use email/password.'); },
    requestMFA:             async () => { throw new Error('Use Supabase MFA.'); },
    loginWithOTP:           async () => { throw new Error('Use Supabase MFA.'); },
    verifyMFACode:          async () => { throw new Error('Use Supabase MFA.'); },
    enableMFA:              async () => {},
    disableMFA:             async () => {},
    resendVerificationEmail,
    resetPassword,
    updatePassword,
    refetchProfile: async () => {
      if (currentUser?.id) {
        const p = await fetchProfile(currentUser.id);
        setProfile(p);
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
