import { useState, useCallback, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const useCollectionStats = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCards: 0,
    collectionValue: 0,
    cardsForTrade: 0,
    growthPercentage: 0,
    isGrowing: true
  });

  const fetchStats = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all cards for the user to calculate stats
      const records = await pb.collection('cardListings').getFullList({
        filter: `owner="${currentUser.id}"`,
        $autoCancel: false
      });

      const totalCards = records.length;
      const collectionValue = records.reduce((sum, card) => sum + (card.estimatedValue || 0), 0);
      const cardsForTrade = records.filter(card => card.tradeAvailable).length;

      // Handle history and growth calculation
      const historyKey = `vault_value_history_${currentUser.id}`;
      let history = [];
      try {
        const stored = localStorage.getItem(historyKey);
        if (stored) history = JSON.parse(stored);
      } catch (e) {
        console.error('Error reading history from localStorage', e);
      }

      const now = new Date().toISOString();
      let growthPercentage = 0;
      let isGrowing = true;

      if (history.length > 0) {
        // Find the oldest record (or a specific timeframe like 30 days ago)
        // For simplicity, we'll compare against the first recorded value
        const initialValue = history[0].value;
        
        if (initialValue > 0) {
          const diff = collectionValue - initialValue;
          growthPercentage = (diff / initialValue) * 100;
          isGrowing = diff >= 0;
        } else if (collectionValue > 0) {
          growthPercentage = 100; // Grew from 0
          isGrowing = true;
        }
      }

      // Update history if value changed significantly or it's a new day
      const lastRecord = history[history.length - 1];
      const today = now.split('T')[0];
      const lastRecordDate = lastRecord ? lastRecord.date.split('T')[0] : null;

      if (!lastRecord || lastRecordDate !== today || Math.abs(lastRecord.value - collectionValue) > 1) {
        history.push({ date: now, value: collectionValue });
        // Keep only last 30 entries to prevent unbounded growth
        if (history.length > 30) history = history.slice(-30);
        localStorage.setItem(historyKey, JSON.stringify(history));
      }

      setStats({
        totalCards,
        collectionValue,
        cardsForTrade,
        growthPercentage,
        isGrowing
      });
    } catch (error) {
      console.error('Error fetching collection stats:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
};