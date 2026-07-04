import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

const ProtectedAdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading, profileLoading } = useAuth();
  const location = useLocation();

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

  // Wait for both auth and profile to resolve before making access decisions
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;