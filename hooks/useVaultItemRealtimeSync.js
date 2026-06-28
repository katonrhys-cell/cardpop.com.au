import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

/**
 * Custom hook to add realtime synchronization for vault items listed in the marketplace.
 * Automatically refetches data whenever any vault_items field changes.
 * This ensures updates are reflected across all pages where vault items appear
 * (marketplace listings, product detail pages, vault pages, etc.)
 *
 * Usage:
 * const fetchRef = useRef(null);
 * useVaultItemRealtimeSync(fetchRef, 'channel-name');
 *
 * Then in your fetch effect:
 * fetchRef.current = fetchFunction;
 */
const useVaultItemRealtimeSync = (fetchRef, channelName = 'vault-items-sync') => {
  useEffect(() => {
    if (!fetchRef) return;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vault_items' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRef, channelName]);
};

export default useVaultItemRealtimeSync;
