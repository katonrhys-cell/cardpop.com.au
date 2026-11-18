import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { findOrganiser, sortOrganisers } from '@/utils/eventOrganisers.js';
import { ORGANISER_CONTACT_COLUMNS, ORGANISER_LINK_COLUMNS, ORGANISER_PROFILE_COLUMNS, organiserBlanksFromEvent } from '@/utils/organiserPage.js';

/**
 * Carry an event's organiser details (logo, website, socials, contact email /
 * phone) onto the organiser's page — blank fields only, never an overwrite.
 * Admins only (RLS). Returns the labels of what was added, [] when the page
 * already had everything.
 */
export async function fillOrganiserPageFromEvent(organiserId, event) {
  const read = (columns) => supabase.from('event_organisers').select(columns).eq('id', organiserId).maybeSingle();
  let { data: org, error } = await read(ORGANISER_CONTACT_COLUMNS);
  // Newer columns ship in migrations; fill what this database has.
  if (error) ({ data: org, error } = await read(ORGANISER_LINK_COLUMNS));
  if (error) ({ data: org, error } = await read(ORGANISER_PROFILE_COLUMNS));
  if (error) throw error;
  const { patch, labels } = organiserBlanksFromEvent(org, event);
  if (labels.length === 0) return [];
  const { data: saved, error: writeError } = await supabase
    .from('event_organisers').update(patch).eq('id', organiserId).select('id').maybeSingle();
  if (writeError) throw writeError;
  // RLS refusing an update returns no row and no error.
  return saved ? labels : [];
}

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
        .select('id, name, slug, logo_url')
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
    const { data, error } = await query.select('id, name, slug, logo_url').single();
    if (error) throw error;
    await reload();
    return { organiser: data, created: !existing };
  }, [organisers, reload]);

  return { organisers, saveOrganiser, reload };
}

export default useEventOrganisers;
