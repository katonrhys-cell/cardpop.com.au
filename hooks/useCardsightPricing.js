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

  const fetchPricingByName = useCallback(async (cardName, period = '30d') => {
    if (!cardName) return;
    setIsLoadingCsPrice(true);
    setCsPrice(null);
    try {
      const acRes = await apiServerClient.fetch(
        `/cardsight/autocomplete?q=${encodeURIComponent(cardName)}&take=1`
      );
      if (!acRes.ok) throw new Error('Autocomplete failed');
      const acData = await acRes.json();
      const cardId = acData?.results?.[0]?.id ?? acData?.[0]?.id ?? acData?.data?.[0]?.id;
      if (!cardId) return;
      await fetchPricingById(cardId, period);
    } catch {
      // non-critical
    } finally {
      setIsLoadingCsPrice(false);
    }
  }, [fetchPricingById]);

  const clearCsPrice = useCallback(() => setCsPrice(null), []);

  return { fetchPricingByName, fetchPricingById, isLoadingCsPrice, csPrice, clearCsPrice };
}
