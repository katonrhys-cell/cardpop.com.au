import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

/**
 * Custom hook to add realtime synchronization for shop products.
 * Automatically refetches data whenever any shop_products field changes.
 *
 * Usage:
 * const fetchRef = useRef(null);
 * useShopProductRealtimeSync(fetchRef, 'channel-name');
 *
 * Then in your fetch effect:
 * fetchRef.current = fetchFunction;
 */
const useShopProductRealtimeSync = (fetchRef, channelName = 'shop-products-sync') => {
  useEffect(() => {
    if (!fetchRef) return;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_products' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRef, channelName]);
};

export default useShopProductRealtimeSync;
