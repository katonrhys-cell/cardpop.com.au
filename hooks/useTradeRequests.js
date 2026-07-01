import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

export function useTradeRequests() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const fetchTrades = useCallback(async (filter) => {
    if (!currentUser) return [];
    try {
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          initiator:profiles!initiator_id(id,username,display_name,avatar_url),
          responder:profiles!responder_id(id,username,display_name,avatar_url),
          initiator_listing:listings!initiator_listing_id(
            *, vault_item:vault_items(*, vault_images(*))
          ),
          responder_listing:listings!responder_listing_id(
            *, vault_item:vault_items(*, vault_images(*))
          )
        `)
        .match(filter)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    } catch (err) {
      console.error('Error fetching trades:', err);
      return [];
    }
  }, [currentUser]);

  const getMyTradesSent = useCallback(async () => {
    setLoading(true);
    const res = await fetchTrades({ initiator_id: currentUser?.id, status: 'proposed' });
    setLoading(false);
    return res;
  }, [currentUser, fetchTrades]);

  const getMyTradesReceived = useCallback(async () => {
    if (!currentUser) return [];
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select(`
        *,
        initiator:profiles!initiator_id(id,username,display_name,avatar_url),
        initiator_listing:listings!initiator_listing_id(*, vault_item:vault_items(*, vault_images(*))),
        responder_listing:listings!responder_listing_id(*, vault_item:vault_items(*, vault_images(*)))
      `)
      .eq('responder_id', currentUser.id)
      .eq('status', 'proposed')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { console.error('Error fetching received trades:', error); return []; }
    return data ?? [];
  }, [currentUser]);

  const getTradeHistory = useCallback(async () => {
    if (!currentUser) return [];
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select(`
        *,
        initiator:profiles!initiator_id(id,username,display_name,avatar_url),
        responder:profiles!responder_id(id,username,display_name,avatar_url),
        initiator_listing:listings!initiator_listing_id(*, vault_item:vault_items(*)),
        responder_listing:listings!responder_listing_id(*, vault_item:vault_items(*))
      `)
      .or(`initiator_id.eq.${currentUser.id},responder_id.eq.${currentUser.id}`)
      .not('status', 'eq', 'proposed')
      .order('updated_at', { ascending: false });
    setLoading(false);
    if (error) { console.error('Error fetching trade history:', error); return []; }
    return data ?? [];
  }, [currentUser]);

  const acceptTrade = async (trade) => {
    try {
      const { error } = await supabase
        .from('trades')
        .update({ status: 'accepted' })
        .eq('id', trade.id)
        .eq('responder_id', currentUser?.id);
      if (error) throw error;

      // Cancel any other still-proposed trade that involves either of the two
      // listings, in either column — otherwise a card could be committed twice.
      const a = trade.initiator_listing_id;
      const b = trade.responder_listing_id;
      const { error: cancelErr } = await supabase
        .from('trades')
        .update({ status: 'cancelled' })
        .or(
          `initiator_listing_id.eq.${a},responder_listing_id.eq.${a},` +
          `initiator_listing_id.eq.${b},responder_listing_id.eq.${b}`,
        )
        .eq('status', 'proposed')
        .neq('id', trade.id);

      if (cancelErr) {
        // Roll the acceptance back to 'proposed' so we never leave a listing
        // committed to this trade while competing proposals are still live.
        // (Fully race-proof acceptance needs a DB transaction / constraint.)
        await supabase
          .from('trades')
          .update({ status: 'proposed' })
          .eq('id', trade.id)
          .eq('responder_id', currentUser?.id);
        throw cancelErr;
      }

      toast.success('Trade accepted! The fee will be calculated and contact details shared.');
      return true;
    } catch (err) {
      console.error('Accept trade error:', err);
      toast.error('Failed to accept trade. Please try again.');
      return false;
    }
  };

  const declineTrade = async (tradeId) => {
    try {
      const { error } = await supabase
        .from('trades')
        .update({ status: 'cancelled' })
        .eq('id', tradeId)
        .or(`responder_id.eq.${currentUser?.id},initiator_id.eq.${currentUser?.id}`);
      if (error) throw error;
      toast.success('Trade request declined.');
      return true;
    } catch (err) {
      console.error('Decline trade error:', err);
      toast.error('Failed to decline trade.');
      return false;
    }
  };

  const proposeTrade = async ({
    initiatorListingId,
    responderListingId,
    responderId,
    initiatorValue,
    responderValue,
    message,
  }) => {
    if (!currentUser) return null;
    const cashTopup = Math.abs(initiatorValue - responderValue);
    const topupFrom = initiatorValue < responderValue ? currentUser.id : responderId;

    const { data, error } = await supabase
      .from('trades')
      .insert({
        initiator_id:               currentUser.id,
        responder_id:               responderId,
        initiator_listing_id:       initiatorListingId,
        responder_listing_id:       responderListingId,
        initiator_trade_value_aud:  initiatorValue,
        responder_trade_value_aud:  responderValue,
        cash_topup_aud:             cashTopup,
        topup_required_from:        cashTopup > 0 ? topupFrom : null,
        message,
      })
      .select()
      .single();

    if (error) { toast.error(error.message); return null; }
    toast.success('Trade proposed!');
    return data;
  };

  return {
    getMyTradesSent,
    getMyTradesReceived,
    getTradeHistory,
    acceptTrade,
    declineTrade,
    proposeTrade,
    loading,
  };
}
