import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { findOrganiser, sortOrganisers } from '@/utils/eventOrganisers.js';

/**
 * The saved organisers list for the event form, plus `saveOrganiser` (admins:
 * RLS refuses everyone else) which adds the organiser or updates the one with
 * the same name. A failed read just leaves the list empty — the form still
 * works with a typed name.
 */
export function useEventOrganisers(enabled = true) {
  const [organisers, setOrganisers] = useState([]);

  const reload = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_organisers')
        .select('id, name, logo_url')
        .order('name')
        .limit(500);
      if (!error && Array.isArray(data)) setOrganisers(sortOrganisers(data));
    } catch {
      /* directory unavailable — typed names still work */
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const saveOrganiser = useCallback(async ({ name, logoUrl }) => {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('Enter the organiser name first.');
    const existing = findOrganiser(organisers, trimmed);
    const row = { name: trimmed, logo_url: logoUrl || null };
    const query = existing
      ? supabase.from('event_organisers').update(row).eq('id', existing.id)
      : supabase.from('event_organisers').insert(row);
    const { data, error } = await query.select('id, name, logo_url').single();
    if (error) throw error;
    await reload();
    return { organiser: data, created: !existing };
  }, [organisers, reload]);

  return { organisers, saveOrganiser, reload };
}

export default useEventOrganisers;
