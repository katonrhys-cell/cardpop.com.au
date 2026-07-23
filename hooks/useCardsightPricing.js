import { useState, useCallback } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

export function useCardsightPricing() {
  const [isLoadingCsPrice, setIsLoadingCsPrice] = useState(false);
  const [csPrice, setCsPrice] = useState(null);

  // Both fetchers resolve with the pricing data when found, else null — so
  // on-demand callers can tell the user "nothing found" instead of silence.
  const fetchPricingById = useCallback(async (cardId, period = '30d') => {
    if (!cardId) return null;
    setIsLoadingCsPrice(true);
    try {
      const res = await apiServerClient.fetch(
        `/cardsight/pricing/${cardId}?period=${period}&listing_type=sold`
      );
      if (!res.ok) throw new Error('Pricing fetch failed');
      const data = await res.json();
      const priced = { cardId, ...data };
      setCsPrice(priced);
      return priced;
    } catch {
      // non-critical; leave csPrice null
      return null;
    } finally {
      setIsLoadingCsPrice(false);
    }
  }, []);

  const fetchPricingByName = useCallback(async (cardName) => {
    if (!cardName) return null;
    setIsLoadingCsPrice(true);
    setCsPrice(null);
    try {
      const res = await apiServerClient.fetch(
        `/catalog/pricing?name=${encodeURIComponent(cardName)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.count > 0) {
        const priced = { cardId: null, ...data };
        setCsPrice(priced);
        return priced;
      }
      return null;
    } catch {
      // non-critical
      return null;
    } finally {
      setIsLoadingCsPrice(false);
    }
  }, []);

  const clearCsPrice = useCallback(() => setCsPrice(null), []);

  return { fetchPricingByName, fetchPricingById, isLoadingCsPrice, csPrice, clearCsPrice };
}
