import { useState, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

export function useTradeRequests() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const fetchWithCards = async (filterString) => {
    if (!currentUser) return [];
    try {
      const trades = await pb.collection('trade_requests').getFullList({
        filter: filterString,
        sort: '-created',
        $autoCancel: false
      });
      
      if (trades.length === 0) return [];
      
      const cardIds = [...new Set(trades.flatMap(t => [t.offerer_card_id, t.recipient_card_id]))].filter(Boolean);
      let cardMap = {};
      
      if (cardIds.length > 0) {
        // Build a filter to fetch all related cards at once
        const chunks = [];
        for (let i = 0; i < cardIds.length; i += 50) {
          const chunk = cardIds.slice(i, i + 50);
          const filter = chunk.map(id => `id="${id}"`).join(' || ');
          const cards = await pb.collection('cards').getFullList({ filter, $autoCancel: false });
          cards.forEach(c => cardMap[c.id] = c);
        }
      }

      return trades.map(t => ({
        ...t,
        offererCard: cardMap[t.offerer_card_id] || null,
        recipientCard: cardMap[t.recipient_card_id] || null
      }));
    } catch (err) {
      console.error("Error fetching trades:", err);
      return [];
    }
  };

  const getMyTradesSent = useCallback(async () => {
    setLoading(true);
    const res = await fetchWithCards(`offerer_id="${currentUser?.id}" && status="pending"`);
    setLoading(false);
    return res;
  }, [currentUser]);

  const getMyTradesReceived = useCallback(async () => {
    setLoading(true);
    const res = await fetchWithCards(`recipient_id="${currentUser?.id}" && status="pending"`);
    setLoading(false);
    return res;
  }, [currentUser]);

  const getTradeHistory = useCallback(async () => {
    setLoading(true);
    const res = await fetchWithCards(`(offerer_id="${currentUser?.id}" || recipient_id="${currentUser?.id}") && status!="pending"`);
    setLoading(false);
    return res;
  }, [currentUser]);

  const acceptTrade = async (trade) => {
    try {
      // 1. Swap owners (Updates the cards in place, preserving images and IDs)
      if (trade.offererCard) {
        await pb.collection('cards').update(trade.offerer_card_id, { owner: trade.recipient_id }, { $autoCancel: false });
      }
      if (trade.recipientCard) {
        await pb.collection('cards').update(trade.recipient_card_id, { owner: trade.offerer_id }, { $autoCancel: false });
      }
      
      // 2. Update trade status
      await pb.collection('trade_requests').update(trade.id, { status: 'accepted' }, { $autoCancel: false });
      
      // 3. Decline any other pending trades involving these exact cards to prevent double-spending
      const relatedTrades = await pb.collection('trade_requests').getFullList({
        filter: `status="pending" && (offerer_card_id="${trade.offerer_card_id}" || recipient_card_id="${trade.offerer_card_id}" || offerer_card_id="${trade.recipient_card_id}" || recipient_card_id="${trade.recipient_card_id}")`,
        $autoCancel: false
      });
      
      for (const t of relatedTrades) {
        if (t.id !== trade.id) {
          await pb.collection('trade_requests').update(t.id, { status: 'declined' }, { $autoCancel: false });
        }
      }

      toast.success('Trade accepted successfully! Cards have been swapped.');
      return true;
    } catch (err) {
      console.error("Accept trade error:", err);
      toast.error('Failed to complete trade. Please try again.');
      return false;
    }
  };

  const declineTrade = async (tradeId) => {
    try {
      await pb.collection('trade_requests').update(tradeId, { status: 'declined' }, { $autoCancel: false });
      toast.success('Trade request declined.');
      return true;
    } catch (err) {
      console.error("Decline trade error:", err);
      toast.error('Failed to decline trade.');
      return false;
    }
  };

  return { getMyTradesSent, getMyTradesReceived, getTradeHistory, acceptTrade, declineTrade, loading };
}