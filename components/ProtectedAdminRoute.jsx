import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

const ProtectedAdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading, profileLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !profileLoading && isAuthenticated && !isAdmin) {
      toast.error('Access denied. Administrator privileges required.');
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