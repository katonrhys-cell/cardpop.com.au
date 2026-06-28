import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';

const AccountContext = createContext();

export const useAccount = () => useContext(AccountContext);

export const AccountProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    listingsCount: 0,
    offersCount: 0,
    transactionsCount: 0,
    reviewsCount: 0,
    unreadNotifications: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated || !currentUser) {
      if (isMounted) setLoading(false);
      return;
    }

    const fetchAccountData = async () => {
      if (isMounted) setLoading(true);
      try {
        // In a real app, these would be actual queries to respective collections
        // For now, we'll simulate fetching stats safely
        if (isMounted) {
          setStats({
            listingsCount: currentUser.inventoryCount || 0,
            offersCount: 0,
            transactionsCount: 0,
            reviewsCount: currentUser.reviewsCount || 0,
            unreadNotifications: 0
          });
        }
      } catch (error) {
        console.error('[AccountContext] Failed to fetch account stats:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAccountData();

    return () => {
      isMounted = false;
    };
    // Depend on the stable user id, not the currentUser object — a new object
    // identity on every AuthContext re-render would otherwise re-run this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser?.id]);

  // Memoise so consumers don't re-render on every provider render.
  const value = useMemo(() => ({ stats, loading }), [stats, loading]);

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};