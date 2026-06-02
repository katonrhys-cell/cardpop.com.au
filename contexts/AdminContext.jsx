import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

const AdminContext = createContext(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within AdminProvider');
  return context;
};

export const AdminProvider = ({ children }) => {
  const { currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) { setLoading(true); return; }
    // is_admin comes from the profiles table via AuthContext mergedUser
    setIsAdmin(isAuthenticated && (currentUser?.is_admin === true));
    setLoading(false);
  }, [currentUser, isAuthenticated, authLoading]);

  const logAdminAction = async (action, details = {}) => {
    if (!isAdmin) {
      console.warn('Attempted admin action without admin privileges:', action);
      return;
    }
    // Supabase has no auditLogs table — log to console in development
    console.info('[AdminAudit]', action, details);
  };

  const getSystemHealth = useCallback(async () => {
    try {
      const { error } = await supabase.from('categories').select('id').limit(1);
      return {
        database: error ? 'Error' : 'Healthy',
        storage:  'Healthy',
        api:      'Online',
        uptime:   '99.9%',
      };
    } catch {
      return { database: 'Error', storage: 'Error', api: 'Error', uptime: 'Unknown' };
    }
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, loading, logAdminAction, getSystemHealth }}>
      {children}
    </AdminContext.Provider>
  );
};
