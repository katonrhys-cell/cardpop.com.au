import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import PageLoader from '@/components/PageLoader.jsx';

// The same loader the static shell and the route Suspense show, so the
// spinner doesn't change size and jump while the session is checked.
const Spinner = PageLoader;

const ProtectedAdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading, profileLoading, listMFAFactors } = useAuth();
  const location = useLocation();
  // 'checking' → running the MFA policy check; 'ok' → allowed; 'enroll' → the
  // require_mfa_admins policy is on and this admin has no verified 2FA factor.
  const [mfaStatus, setMfaStatus] = useState('checking');

  useEffect(() => {
    if (!loading && !profileLoading && isAuthenticated && !isAdmin) {
      // Defer the sonner import so this eagerly-loaded route guard doesn't drag
      // the toast library onto the app's initial critical path — the message
      // only ever fires for the rare non-admin who reaches an /admin URL.
      import('sonner').then(({ toast }) =>
        toast.error('Access denied. Administrator privileges required.'),
      );
    }
  }, [loading, profileLoading, isAuthenticated, isAdmin]);

  // Enforce require_mfa_admins: when the policy is on, an admin without a
  // verified TOTP factor is soft-redirected to /account/security to enrol
  // before they can use the admin area. Fails OPEN (allow) on any read error so
  // a transient failure never locks admins out of their own panel.
  useEffect(() => {
    if (loading || profileLoading || !isAuthenticated || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'require_mfa_admins')
          .maybeSingle();
        const required = data?.value === true || data?.value === 'true';
        if (!required) { if (!cancelled) setMfaStatus('ok'); return; }
        const factors = await listMFAFactors();
        const hasVerified = (factors?.totp || []).some((f) => f.status === 'verified');
        if (!cancelled) setMfaStatus(hasVerified ? 'ok' : 'enroll');
      } catch {
        if (!cancelled) setMfaStatus('ok');
      }
    })();
    return () => { cancelled = true; };
  }, [loading, profileLoading, isAuthenticated, isAdmin, listMFAFactors]);

  useEffect(() => {
    if (mfaStatus === 'enroll') {
      import('sonner').then(({ toast }) =>
        toast.error('Two-factor authentication is required for admin accounts. Please set it up to continue.'),
      );
    }
  }, [mfaStatus]);

  // Wait for both auth and profile to resolve before making access decisions
  if (loading || profileLoading) return <Spinner />;

  if (!isAuthenticated) {
    // Loader stays up while the lazy sign-in page loads (see ProtectedRoute).
    return (
      <>
        <Navigate to="/login" state={{ from: location }} replace />
        <Spinner />
      </>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Hold the admin area until the MFA policy check resolves, then redirect
  // un-enrolled admins to set up 2FA (they keep account access to do so).
  if (mfaStatus === 'checking') return <Spinner />;
  if (mfaStatus === 'enroll') {
    return <Navigate to="/account/security" state={{ mfaRequired: true, from: location }} replace />;
  }

  return children;
};

export default ProtectedAdminRoute;
