
import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

const AdminContext = createContext(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }) => {
  const { currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    const adminStatus = isAuthenticated && currentUser?.role === 'admin';
    setIsAdmin(adminStatus);
    setLoading(false);
  }, [currentUser, isAuthenticated, authLoading]);

  const logAdminAction = async (action, details = {}) => {
    if (!isAdmin) {
      console.warn('Attempted admin action without admin privileges:', action);
      return;
    }
    
    try {
      await pb.collection('auditLogs').create({
        userId: currentUser.id,
        eventType: action,
        status: 'success',
        ipAddress: 'internal',
        deviceInfo: navigator.userAgent,
        details: details
      }, { $autoCancel: false });
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  };

  const getSystemHealth = async () => {
    try {
      // Simulate health check - in production this would ping actual services
      const dbHealthy = pb.authStore.isValid;
      
      return {
        database: dbHealthy ? 'Healthy' : 'Error',
        storage: 'Healthy',
        api: 'Online',
        uptime: '99.9%'
      };
    } catch (error) {
      console.error('System health check failed:', error);
      return {
        database: 'Error',
        storage: 'Error',
        api: 'Error',
        uptime: 'Unknown'
      };
    }
  };

  const value = {
    isAdmin,
    loading,
    logAdminAction,
    getSystemHealth
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};
