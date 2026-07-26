import { useState, useEffect } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

// Shared fetcher for /ebay/price-estimate. The product page shows the same
// estimate twice (the compact market-price anchor beside the asking price, and
// the full EbayMarketSection below), so identical requests are de-duped through
// a module-level promise cache — one network call per card view, both
// consumers. Failures are not pinned: the entry clears so a retry can succeed.
const cache = new Map();

const buildParams = ({ cardName, cardSet, gradingService, gradeScore }) => {
  const params = new URLSearchParams();
  // Sanitize card name: remove special chars that confuse search (hyphens, dashes)
  const sanitizedName = cardName.replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  params.append('name', sanitizedName);
  if (cardSet) params.append('set', cardSet);
  if (gradingService && gradingService !== 'None') {
    params.append('gradingService', gradingService);
    if (gradeScore) params.append('gradeScore', gradeScore);
  }
  return params.toString();
};

export function useEbayEstimate({ cardName, cardSet, gradingService, gradeScore, delay = 300 }) {
  const [state, setState] = useState({ data: null, loading: Boolean(cardName), error: null });

  useEffect(() => {
    if (!cardName) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    const key = buildParams({ cardName, cardSet, gradingService, gradeScore });

    const run = async () => {
      try {
        let promise = cache.get(key);
        if (!promise) {
          promise = apiServerClient.fetch(`/ebay/price-estimate?${key}`).then(async (res) => {
            if (!res.ok) throw new Error('Failed to fetch eBay data');
            return res.json();
          });
          cache.set(key, promise);
          promise.catch(() => cache.delete(key));
        }
        const json = await promise;
        if (!cancelled) setState({ data: json, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: err.message });
      }
    };

    const timer = setTimeout(run, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cardName, cardSet, gradingService, gradeScore, delay]);

  return state;
}

export default useEbayEstimate;
