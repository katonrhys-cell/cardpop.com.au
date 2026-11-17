import React, { Suspense, lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import PageLoader from '@/components/PageLoader.jsx';

// Lazy so this guard — eagerly imported by every protected route — doesn't pull
// VerificationPendingPage (and its sonner dependency) onto the app's critical
// path. It only renders for authenticated-but-unverified users.
const VerificationPendingPage = lazy(() => import('@/pages/VerificationPendingPage.jsx'));

// The same loader the static shell and the route Suspense show, so the
// spinner doesn't change size and jump while the session is checked.
const Spinner = PageLoader;

const ProtectedRoute = ({ children, requireVerification = false }) => {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    // Keep the loader up while the redirect lands: the sign-in page is a lazy
    // chunk and the router holds this screen until it has loaded, so with
    // nothing rendered here the footer jumped up under the header and back.
    return (
      <>
        <Navigate to="/login" state={{ from: location }} replace />
        <Spinner />
      </>
    );
  }

  if (requireVerification && !isEmailVerified) {
    return (
      <Suspense fallback={<Spinner />}>
        <VerificationPendingPage />
      </Suspense>
    );
  }

  return children;
};

export default ProtectedRoute;