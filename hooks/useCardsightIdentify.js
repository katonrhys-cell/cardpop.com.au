import { useState, useCallback } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

export function useCardsightIdentify() {
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState(null);
  const [identifyError, setIdentifyError] = useState(null);

  const identifyCard = useCallback(async (imageFile) => {
    if (!imageFile) return;
    setIsIdentifying(true);
    setIdentifyError(null);
    setIdentifyResult(null);
    try {
      const form = new FormData();
      form.append('image', imageFile);
      const res = await apiServerClient.fetch('/cardsight/identify', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `CardSight error: ${res.status}`);
      }
      const data = await res.json();
      const best = data.detections?.[0] ?? data;
      setIdentifyResult(best);
    } catch (err) {
      setIdentifyError(err.message);
    } finally {
      setIsIdentifying(false);
    }
  }, []);

  const clearIdentify = useCallback(() => {
    setIdentifyResult(null);
    setIdentifyError(null);
  }, []);

  return { identifyCard, isIdentifying, identifyResult, identifyError, clearIdentify };
}
