import { useState, useCallback } from 'react';
import { apiServerClient } from '@/lib/apiServerClient';
import { useIsMounted } from '@/hooks/useIsMounted.js';

export function useEbayPriceLookup() {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const isMounted = useIsMounted();

  // Resolves with the price data when listings were found, else null — so
  // on-demand callers can tell the user "nothing found" instead of silence.
  const lookupPrice = useCallback(async (scanResult, { signal } = {}) => {
    if (!scanResult?.name) return null;

    setIsLookingUp(true);
    setPriceData(null);

    try {
      const params = new URLSearchParams({ name: scanResult.name });
      if (scanResult.cardSetName) params.set('set', scanResult.cardSetName);
      if (scanResult.gradingService && scanResult.gradingService !== 'None') {
        params.set('gradingService', scanResult.gradingService);
        if (scanResult.gradeScore) params.set('gradeScore', scanResult.gradeScore);
      }

      const response = await apiServerClient.fetch(`/ebay/price-estimate?${params}`, { signal });
      if (!response.ok) throw new Error(`Price lookup failed (${response.status})`);
      const data = await response.json();

      if (isMounted() && data.count > 0) {
        setPriceData(data);
        return data;
      }
    } catch (err) {
      // Price lookup is optional — fail silently
      if (err.name !== 'AbortError') console.warn('[useEbayPriceLookup] Lookup failed:', err.message);
    } finally {
      if (isMounted()) setIsLookingUp(false);
    }
    return null;
  }, [isMounted]);

  return {
    lookupPrice,
    isLookingUp,
    priceData,
    clearPrice: () => setPriceData(null),
  };
}
