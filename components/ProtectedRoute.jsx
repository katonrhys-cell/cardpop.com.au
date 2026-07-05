import React, { Suspense, lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

// Lazy so this guard — eagerly imported by every protected route — doesn't pull
// VerificationPendingPage (and its sonner dependency) onto the app's critical
// path. It only renders for authenticated-but-unverified users.
const VerificationPendingPage = lazy(() => import('@/pages/VerificationPendingPage.jsx'));

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ProtectedRoute = ({ children, requireVerification = false }) => {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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