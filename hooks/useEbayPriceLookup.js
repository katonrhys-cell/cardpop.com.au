import { useState, useCallback } from 'react';
import { apiServerClient } from '@/lib/apiServerClient';
import { useIsMounted } from '@/hooks/useIsMounted.js';

export function useEbayPriceLookup() {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const isMounted = useIsMounted();

  const lookupPrice = useCallback(async (scanResult) => {
    if (!scanResult?.name) return;

    setIsLookingUp(true);
    setPriceData(null);

    try {
      const params = new URLSearchParams({ name: scanResult.name });
      if (scanResult.cardSetName) params.set('set', scanResult.cardSetName);
      if (scanResult.gradingService && scanResult.gradingService !== 'None') {
        params.set('gradingService', scanResult.gradingService);
        if (scanResult.gradeScore) params.set('gradeScore', scanResult.gradeScore);
      }

      const response = await apiServerClient.fetch(`/ebay/price-estimate?${params}`);
      const data = await response.json();

      if (isMounted() && data.count > 0) {
        setPriceData(data);
      }
    } catch (err) {
      // Price lookup is optional — fail silently
      console.warn('[useEbayPriceLookup] Lookup failed:', err.message);
    } finally {
      if (isMounted()) setIsLookingUp(false);
    }
  }, [isMounted]);

  return {
    lookupPrice,
    isLookingUp,
    priceData,
    clearPrice: () => setPriceData(null),
  };
}
