import { useState, useCallback } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

export function useCardsightPricing() {
  const [isLoadingCsPrice, setIsLoadingCsPrice] = useState(false);
  const [csPrice, setCsPrice] = useState(null);

  const fetchPricingById = useCallback(async (cardId, period = '30d') => {
    if (!cardId) return;
    setIsLoadingCsPrice(true);
    try {
      const res = await apiServerClient.fetch(
        `/cardsight/pricing/${cardId}?period=${period}&listing_type=sold`
      );
      if (!res.ok) throw new Error('Pricing fetch failed');
      const data = await res.json();
      setCsPrice({ cardId, ...data });
    } catch {
      // non-critical; leave csPrice null
    } finally {
      setIsLoadingCsPrice(false);
    }
  }, []);

  const fetchPricingByName = useCallback(async (cardName) => {
    if (!cardName) return;
    setIsLoadingCsPrice(true);
    setCsPrice(null);
    try {
      const res = await apiServerClient.fetch(
        `/catalog/pricing?name=${encodeURIComponent(cardName)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.count > 0) setCsPrice({ cardId: null, ...data });
    } catch {
      // non-critical
    } finally {
      setIsLoadingCsPrice(false);
    }
  }, []);

  const clearCsPrice = useCallback(() => setCsPrice(null), []);

  return { fetchPricingByName, fetchPricingById, isLoadingCsPrice, csPrice, clearCsPrice };
}
