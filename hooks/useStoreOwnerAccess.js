import { useCallback, useEffect, useState } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

/**
 * The signed-in member's shop-ownership state: their requests to own a card
 * shop page (newest first, each with its shop) and the shops they own. The
 * organiser twin is useOrganiserAccess. docs/store-pages.md → "Shop owners"
 */
export function useStoreOwnerAccess(userId) {
  const [state, setState] = useState({ loading: Boolean(userId), requests: [], stores: [], error: null });

  const load = useCallback(async () => {
    if (!userId) {
      setState({ loading: false, requests: [], stores: [], error: null });
      return;
    }
    try {
      const res = await apiServerClient.fetch('/store-owner-requests/me');
      if (!res.ok) throw new Error('Could not load your shop ownership status');
      const body = await res.json();
      setState({ loading: false, requests: body.requests || [], stores: body.stores || [], error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (payload) => {
    const res = await apiServerClient.fetch('/store-owner-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.issues?.[0]?.message || body.error || 'Could not send your request');
    await load();
    return body.request;
  }, [load]);

  return { ...state, reload: load, submit };
}

export default useStoreOwnerAccess;
