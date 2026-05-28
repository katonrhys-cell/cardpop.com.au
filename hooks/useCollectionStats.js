import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const useCollectionStats = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCards:       0,
    collectionValue:  0,
    cardsForTrade:    0,
    growthPercentage: 0,
    isGrowing:        true,
  });

  const fetchStats = useCallback(async () => {
    if (!currentUser?.id) { setLoading(false); return; }

    try {
      const { data: items } = await supabase
        .from('vault_items')
        .select('id, estimated_value_aud, trade_value_aud, trade_value_locked')
        .eq('owner_id', currentUser.id);

      const records = items ?? [];
      const totalCards      = records.length;
      const collectionValue = records.reduce((sum, c) => sum + (c.estimated_value_aud ?? 0), 0);
      const cardsForTrade   = records.filter(c => c.trade_value_locked).length;

      // Growth vs localStorage history
      const historyKey = `vault_value_history_${currentUser.id}`;
      let history = [];
      try {
        const stored = localStorage.getItem(historyKey);
        if (stored) history = JSON.parse(stored);
      } catch { /* ignore */ }

      let growthPercentage = 0;
      let isGrowing        = true;

      if (history.length > 0) {
        const initialValue = history[0].value;
        if (initialValue > 0) {
          const diff = collectionValue - initialValue;
          growthPercentage = (diff / initialValue) * 100;
          isGrowing        = diff >= 0;
        } else if (collectionValue > 0) {
          growthPercentage = 100;
        }
      }

      // Persist today's value
      const now   = new Date().toISOString();
      const today = now.split('T')[0];
      const last  = history[history.length - 1];
      if (!last || last.date.split('T')[0] !== today || Math.abs(last.value - collectionValue) > 1) {
        history.push({ date: now, value: collectionValue });
        if (history.length > 30) history = history.slice(-30);
        localStorage.setItem(historyKey, JSON.stringify(history));
      }

      setStats({ totalCards, collectionValue, cardsForTrade, growthPercentage, isGrowing });
    } catch (err) {
      console.error('Error fetching collection stats:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
};
