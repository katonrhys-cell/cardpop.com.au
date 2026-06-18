import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

export const useUserDetails = (userId) => {
  const [data, setData] = useState({
    user: null,
    vaultProducts: [],
    ordersAsBuyer: [],
    ordersAsSeller: [],
    reviews: [],
    addresses: [],
    paymentMethods: [],
    preferences: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  // isActive lets the caller abort stale results — when userId changes quickly,
  // an in-flight request for the old id must not overwrite the newer data (or
  // setState after unmount).
  const fetchUserDetails = useCallback(async (isActive = () => true) => {
    if (!userId) { if (isActive()) setIsLoading(false); return; }

    setIsLoading(true);
    setError(null);

    try {
      const [
        profileRes,
        vaultRes,
        buyerOrdersRes,
        sellerOrdersRes,
        reviewsRes,
        addressesRes,
      ] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('vault_items').select('*, categories(name,slug)').eq('owner_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*, profiles!seller_id(username,display_name,avatar_url)').eq('buyer_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*, profiles!buyer_id(username,display_name,avatar_url)').eq('seller_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('reviews').select('*').eq('reviewer_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('shipping_addresses').select('*').eq('user_id', userId),
      ]);

      if (!isActive()) return;

      setData({
        user:           profileRes.status === 'fulfilled' ? profileRes.value.data : null,
        vaultProducts:  vaultRes.status === 'fulfilled'       ? (vaultRes.value.data ?? [])        : [],
        ordersAsBuyer:  buyerOrdersRes.status === 'fulfilled' ? (buyerOrdersRes.value.data ?? [])  : [],
        ordersAsSeller: sellerOrdersRes.status === 'fulfilled'? (sellerOrdersRes.value.data ?? []) : [],
        reviews:        reviewsRes.status === 'fulfilled'     ? (reviewsRes.value.data ?? [])      : [],
        addresses:      addressesRes.status === 'fulfilled'   ? (addressesRes.value.data ?? [])    : [],
        paymentMethods: [],
        preferences:    null,
      });
    } catch (err) {
      console.error('Error fetching user details:', err);
      if (isActive()) setError(err.message || 'Failed to load user details');
    } finally {
      if (isActive()) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    fetchUserDetails(() => active);
    return () => { active = false; };
  }, [fetchUserDetails]);

  return { ...data, isLoading, error, refetch: () => fetchUserDetails() };
};
