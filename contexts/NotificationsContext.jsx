import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uniqueTopic } from '@/lib/realtimeTopic.js';

/**
 * App-wide in-app notifications. Mounted once in App.jsx so the header bell
 * and Account → Notifications share ONE query and ONE realtime channel.
 *
 * They used to run separate copies of this logic, each opening
 * `notifications-${uid}`. `supabase.channel()` hands back the existing channel
 * for a topic that is already registered, so on /account/notifications the
 * page's `.on()` landed on the bell's already-subscribed channel (which
 * throws), and whichever of the two unmounted first removed the channel the
 * other was still relying on. One provider, one channel.
 */
const NotificationsContext = createContext(null);

const PAGE_SIZE = 50;

export const NotificationsProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(null);

  // Derive the unread count from the source of truth so it can never drift out
  // of sync (e.g. marking an already-read item must not decrement it).
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      setNotifications([]);
      setLoading(false);
      return undefined;
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
          .limit(PAGE_SIZE);

        if (!cancelled) {
          setNotifications(data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();

    // Apply realtime payloads to local state instead of refetching all 50
    // rows per event — markAllRead updates N rows, which fires N UPDATE
    // events; refetching per event turned one click into N full re-reads.
    const channel = supabase
      .channel(uniqueTopic(`notifications-${uid}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          if (cancelled || !payload.new) return;
          setNotifications(prev => prev.some(n => n.id === payload.new.id)
            ? prev
            : [payload.new, ...prev].slice(0, PAGE_SIZE));
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          if (cancelled || !payload.new) return;
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n));
        }
      )
      .subscribe();

    return () => { cancelled = true; fetchRef.current = null; supabase.removeChannel(channel); };
  }, [currentUser?.id, isAuthenticated]);

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', currentUser?.id).then(() => {}, console.error);
  }, [currentUser?.id]);

  const markAllRead = useCallback(async () => {
    if (!currentUser?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', currentUser.id).eq('is_read', false).then(() => {}, console.error);
  }, [currentUser?.id]);

  const refetch = useCallback(() => fetchRef.current?.(), []);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, markRead, markAllRead, refetch }),
    [notifications, unreadCount, loading, markRead, markAllRead, refetch],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

const EMPTY = Object.freeze({
  notifications: [], unreadCount: 0, loading: false,
  markRead: async () => {}, markAllRead: async () => {}, refetch: () => {},
});

/** Read the shared notifications state. Safe (empty) outside the provider. */
export const useNotificationsContext = () => useContext(NotificationsContext) ?? EMPTY;
