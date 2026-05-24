import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import VerificationPendingPage from '@/pages/VerificationPendingPage.jsx';

const ProtectedRoute = ({ children, requireVerification = false }) => {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireVerification && !isEmailVerified) {
    return <VerificationPendingPage />;
  }

  return children;
};

export default ProtectedRoute;