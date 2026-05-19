
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(pb.authStore.model);
  const [authToken, setAuthToken] = useState(pb.authStore.token);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let timeoutId;

    const initAuth = async () => {
      console.log('[AuthContext] Initializing auth. Current model:', pb.authStore.model?.id, 'Role:', pb.authStore.model?.role);
      
      if (pb.authStore.isValid) {
        try {
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Auth refresh timeout')), 5000);
          });
          
          await Promise.race([
            pb.collection('users').authRefresh({ $autoCancel: false }),
            timeoutPromise
          ]);
          
          if (timeoutId) clearTimeout(timeoutId);

          if (isMounted.current) {
            console.log('[AuthContext] Auth refreshed successfully. Role:', pb.authStore.model?.role);
            setCurrentUser(pb.authStore.model);
            setAuthToken(pb.authStore.token);
          }
        } catch (error) {
          console.warn('[AuthContext] Auth refresh failed, clearing session:', error.message);
          if (timeoutId) clearTimeout(timeoutId);
          pb.authStore.clear();
          if (isMounted.current) {
            setCurrentUser(null);
            setAuthToken(null);
          }
        }
      } else {
        if (isMounted.current) {
          setCurrentUser(null);
          setAuthToken(null);
        }
      }
      
      if (isMounted.current) setLoading(false);
    };

    initAuth();

    const unsubscribe = pb.authStore.onChange((token, model) => {
      if (isMounted.current) {
        console.log('[AuthContext] authStore changed. New Role:', model?.role);
        setCurrentUser(model);
        setAuthToken(token);
      }
    });

    const handleStorageChange = (e) => {
      if (e.key === 'pocketbase_auth') {
        try {
          const authData = JSON.parse(e.newValue);
          if (authData && authData.token) {
            console.log('[AuthContext] Restoring session from storage. Role:', authData.model?.role);
            pb.authStore.save(authData.token, authData.model);
          } else {
            console.log('[AuthContext] Clearing session from storage sync');
            pb.authStore.clear();
          }
          if (isMounted.current) {
            setCurrentUser(pb.authStore.model);
            setAuthToken(pb.authStore.token);
          }
        } catch (err) {
          console.error('[AuthContext] Failed to parse auth data from storage', err);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('storage', handleStorageChange);
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (e) {
          // Silently handle unsubscribe errors
        }
      }
    };
  }, []);

  const signup = async (email, password, name) => {
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
      fullName: name,
      location: 'Not specified',
      currentBalance: 0,
      totalCommissionsPaid: 0,
      mfaEnabled: false,
      role: 'user', // Default role is strictly 'user'
      verified: false,
      verificationStatus: 'pending'
    }, { $autoCancel: false });
    
    return user;
  };

  const requestOTP = async (email) => {
    try {
      const result = await pb.collection('users').requestOTP(email);
      if (!result || !result.otpId) {
        throw new Error('Invalid response from server. No OTP ID returned.');
      }
      return result;
    } catch (error) {
      let errorMessage = 'Failed to send OTP code. Please check your email address and try again.';
      if (error.status === 400 || error.status === 404) {
        errorMessage = 'Could not process request for this email. Please verify the address is correct.';
      } else if (error.response?.message) {
        errorMessage = error.response.message;
      }
      throw new Error(errorMessage);
    }
  };

  const login = async (email, password) => {
    try {
      // 1. Format credentials as JSON payload
      const payload = {
        email: email.trim(),
        password: password,
        ipAddress: 'client-browser', // Required by backend
        userAgent: navigator.userAgent
      };

      const jsonString = JSON.stringify(payload);
      
      // Comprehensive logging: Exact JSON string being sent
      console.log('[AuthContext] Sending login request payload:', jsonString);

      // 2. Send request with proper Content-Type header
      const response = await apiServerClient.fetch('/auth/login/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: jsonString
      });

      // Log response status
      console.log('[AuthContext] Response status:', response.status);

      // 3. Get raw response text first to handle potential JSON parse errors
      const responseText = await response.text();
      
      // Comprehensive logging: Raw response received
      console.log('[AuthContext] Raw response received:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // Comprehensive logging: JSON parse errors
        console.error('[AuthContext] JSON parse error:', parseError);
        console.error('[AuthContext] Failed to parse response text as JSON:', responseText);
        throw new Error('Invalid response format from server. Please try again later.');
      }

      if (!response.ok) {
        console.error('[AuthContext] Login failed with status:', response.status, data);
        if (response.status === 429) {
          throw new Error(data.error || 'Account temporarily locked due to too many failed attempts.');
        }
        throw new Error(data.error || data.message || 'Invalid credentials. Entrance denied.');
      }

      if (data.otpRequired) {
        console.log('[AuthContext] MFA required for user:', email);
        return { 
          requiresMfa: true, 
          mfaId: data.mfaId || null,
          otpId: data.otpId,
          email 
        };
      }

      // 4. Explicitly set state before redirecting to ensure UI updates
      console.log('[AuthContext] Login successful. Saving session state. Role verified as:', data.user?.role);
      pb.authStore.save(data.token, data.user);
      setCurrentUser(data.user);
      setAuthToken(data.token);
      
      // Redirect to account dashboard on successful standard login
      window.location.href = '/account';
      return { requiresMfa: false, user: data.user };
      
    } catch (error) {
      console.error('[AuthContext] Authentication exception caught:', error);
      throw error;
    }
  };

  const loginWithOTP = async (otpId, code) => {
    try {
      const authData = await pb.collection('users').authWithOTP(otpId, code, { $autoCancel: false });
      console.log('[AuthContext] OTP Login successful. Role verified as:', authData.record?.role);
      setCurrentUser(authData.record);
      setAuthToken(authData.token);
      window.location.href = '/account';
      return authData;
    } catch (error) {
      console.error('OTP login failed:', error);
      throw new Error(error.response?.message || 'Invalid or expired verification code.');
    }
  };

  const verifyMFACode = async (mfaId, otpId, code) => {
    try {
      const authData = await pb.collection('users').authWithOTP(otpId, code, { mfaId, $autoCancel: false });
      console.log('[AuthContext] MFA Verification successful. Role verified as:', authData.record?.role);
      setCurrentUser(authData.record);
      setAuthToken(authData.token);
      window.location.href = '/account';
      return authData;
    } catch (error) {
      console.error('MFA verification failed:', error);
      throw new Error(error.response?.message || 'Invalid verification code.');
    }
  };

  const enableMFA = async () => {
    if (!currentUser) return;
    await pb.collection('users').update(currentUser.id, {
      mfaEnabled: true
    }, { $autoCancel: false });
  };

  const disableMFA = async () => {
    if (!currentUser) return;
    await pb.collection('users').update(currentUser.id, {
      mfaEnabled: false
    }, { $autoCancel: false });
  };

  const logout = () => {
    try {
      console.log('[AuthContext] Logging out user');
      pb.authStore.clear();
      setCurrentUser(null);
      setAuthToken(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const resendVerificationEmail = async (email) => {
    try {
      await pb.collection('users').requestVerification(email, { $autoCancel: false });
      return true;
    } catch (error) {
      console.error('Verification email resend failed:', error);
      throw new Error(error.response?.message || 'Failed to resend verification email.');
    }
  };

  const isVerified = currentUser?.emailVerified || currentUser?.verified || false;
  // Centralized check for admin role, strictly checking against PocketBase schema values
  const isAdmin = currentUser?.role === 'admin';

  const value = {
    currentUser,
    authToken,
    isAuthenticated: pb.authStore.isValid && !!currentUser,
    isAdmin,
    isVerified,
    isEmailVerified: isVerified,
    loading,
    signup,
    login,
    logout,
    requestOTP,
    requestMFA: requestOTP,
    loginWithOTP,
    verifyMFACode,
    enableMFA,
    disableMFA,
    resendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
