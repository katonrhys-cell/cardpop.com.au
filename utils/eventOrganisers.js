// Saved event organisers (`event_organisers`: name + logo). Picking one on the
// event form fills the event's own organizer_name / organizer_logo_url, so the
// event page and its SEO never read this table. Dependency-free helpers; the
// Supabase calls live in hooks/useEventOrganisers.js.

/** Case- and space-insensitive key two spellings of a name share. */
export function organiserKey(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The saved organiser whose name matches `name`, or null. */
export function findOrganiser(list, name) {
  const key = organiserKey(name);
  if (!key || !Array.isArray(list)) return null;
  return list.find((o) => organiserKey(o?.name) === key) ?? null;
}

/** Alphabetical, case-insensitive — the order the picker shows. */
export function sortOrganisers(list) {
  return [...(Array.isArray(list) ? list : [])]
    .filter((o) => o && o.id && organiserKey(o.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
