import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const useNotifications = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(null);

  // Derive the unread count from the source of truth so it can never drift out
  // of sync (e.g. marking an already-read item must not decrement it).
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const uid = currentUser.id;

    const run = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!cancelled) {
          setNotifications(data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();

    const channel = supabase
      .channel(`notifications-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => fetchRef.current?.()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => fetchRef.current?.()
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [currentUser?.id, isAuthenticated]);

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', currentUser?.id).catch(console.error);
  }, [currentUser?.id]);

  const markAllRead = useCallback(async () => {
    if (!currentUser?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', currentUser.id).eq('is_read', false).catch(console.error);
  }, [currentUser?.id]);

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: () => fetchRef.current?.() };
};
