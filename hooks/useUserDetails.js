
import { useState, useEffect, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient.js';

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
  const [error, setError] = useState(null);

  const fetchUserDetails = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Fetch user profile
      const user = await pb.collection('users').getOne(userId, { $autoCancel: false });

      // Fetch related data concurrently
      const [
        vaultProductsRes,
        ordersBuyerRes,
        ordersSellerRes,
        reviewsRes
      ] = await Promise.allSettled([
        pb.collection('user_vaults').getList(1, 50, { filter: `user_id = "${userId}"`, sort: '-created', $autoCancel: false }),
        pb.collection('orders').getList(1, 50, { filter: `buyer_id = "${userId}"`, sort: '-created', expand: 'seller_id', $autoCancel: false }),
        pb.collection('orders').getList(1, 50, { filter: `seller_id = "${userId}"`, sort: '-created', expand: 'buyer_id', $autoCancel: false }),
        pb.collection('reviews').getList(1, 50, { filter: `reviewer = "${userId}"`, sort: '-created', expand: 'reviewee', $autoCancel: false })
      ]);

      // Optional collections (might not exist, so we handle failures gracefully)
      let addresses = [];
      let paymentMethods = [];
      let preferences = null;

      try {
        const addrRes = await pb.collection('user_addresses').getList(1, 50, { filter: `user_id = "${userId}"`, $autoCancel: false });
        addresses = addrRes.items;
      } catch (e) { /* Ignore if collection doesn't exist */ }

      try {
        const pmRes = await pb.collection('user_payment_methods').getList(1, 50, { filter: `user_id = "${userId}"`, $autoCancel: false });
        paymentMethods = pmRes.items;
      } catch (e) { /* Ignore if collection doesn't exist */ }

      try {
        const prefRes = await pb.collection('user_preferences').getFirstListItem(`user_id = "${userId}"`, { $autoCancel: false });
        preferences = prefRes;
      } catch (e) { /* Ignore if collection doesn't exist or no record */ }

      setData({
        user,
        vaultProducts: vaultProductsRes.status === 'fulfilled' ? vaultProductsRes.value.items : [],
        ordersAsBuyer: ordersBuyerRes.status === 'fulfilled' ? ordersBuyerRes.value.items : [],
        ordersAsSeller: ordersSellerRes.status === 'fulfilled' ? ordersSellerRes.value.items : [],
        reviews: reviewsRes.status === 'fulfilled' ? reviewsRes.value.items : [],
        addresses,
        paymentMethods,
        preferences
      });

    } catch (err) {
      console.error("Error fetching user details:", err);
      setError(err.message || "Failed to load user details");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  return { ...data, isLoading, error, refetch: fetchUserDetails };
};
