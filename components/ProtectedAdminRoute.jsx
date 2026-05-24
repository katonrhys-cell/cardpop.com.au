import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

const ProtectedAdminRoute = ({ children }) => {
  const { isAuthenticated, currentUser, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  console.log('[ProtectedAdminRoute] Evaluating admin access:', {
    isAuthenticated,
    role: currentUser?.role,
    isAdminCheck: isAdmin,
    path: location.pathname
  });

  if (!isAuthenticated) {
    console.warn('[ProtectedAdminRoute] User not authenticated. Redirecting to login.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    console.error(`[ProtectedAdminRoute] Access denied. Expected role: 'admin', got: '${currentUser?.role}'`);
    toast.error('Access denied. Administrator privileges required.');
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;