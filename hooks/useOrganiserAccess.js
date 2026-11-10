import { useCallback, useEffect, useRef, useState } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

/**
 * The signed-in member's organiser-access state: their latest request
 * (pending / approved / rejected) and the organiser page they own, if any.
 *
 * On first load it also asks the API to turn the "I'm an event organiser"
 * choice made on the sign-up form into a request (a no-op for everyone else) —
 * the member has no session until they confirm their email, so the choice
 * waits in their account metadata until now. docs/event-organiser-access.md
 */
export function useOrganiserAccess(userId) {
  const [state, setState] = useState({ loading: true, request: null, organiser: null, error: null });
  const triedSignup = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      if (!triedSignup.current) {
        triedSignup.current = true;
        await apiServerClient.fetch('/organiser-requests/from-signup', { method: 'POST' }).catch(() => {});
      }
      const res = await apiServerClient.fetch('/organiser-requests/me');
      if (!res.ok) throw new Error('Could not load your organiser status');
      const body = await res.json();
      setState({ loading: false, request: body.request || null, organiser: body.organiser || null, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (payload) => {
    const res = await apiServerClient.fetch('/organiser-requests', {
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

export default useOrganiserAccess;
