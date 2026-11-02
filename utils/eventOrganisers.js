// Saved event organisers (`event_organisers`: name + slug + logo). Picking one
// on the event form fills the event's own organizer_name / organizer_logo_url;
// event pages link the organiser name and logo to /events/organisers/<slug>,
// which lists every event naming them. Dependency-free helpers; the Supabase
// calls live in hooks/useEventOrganisers.js and the organiser page.

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

/** The organiser's public page, or null without a slug. */
export function organiserPath(org) {
  return org?.slug ? `/events/organisers/${encodeURIComponent(org.slug)}` : null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when `name` appears in `text` as whole words (case/space-insensitive). */
export function namesOrganiser(text, name) {
  const key = organiserKey(name);
  if (!key) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(key)}([^a-z0-9]|$)`).test(organiserKey(text));
}

/**
 * The saved organisers an event's organizer_name refers to, in the order they
 * appear in it. An exact match wins; otherwise a co-hosted name such as
 * "Fast Break Trading Cards Pty Ltd & Sports Addicts Australia" resolves to
 * every saved organiser named in it. A name that is part of a longer matched
 * name is dropped ("Cardcore" inside "Cardcore Events").
 */
export function organisersForEvent(list, organizerName) {
  if (!organiserKey(organizerName) || !Array.isArray(list)) return [];
  const exact = findOrganiser(list, organizerName);
  if (exact) return [exact];
  const text = organiserKey(organizerName);
  const hits = list.filter((o) => o?.slug && namesOrganiser(text, o.name));
  return hits
    .filter((o) => !hits.some((other) => other !== o
      && organiserKey(other.name).length > organiserKey(o.name).length
      && namesOrganiser(other.name, o.name)))
    .sort((a, b) => text.indexOf(organiserKey(a.name)) - text.indexOf(organiserKey(b.name)));
}

/**
 * Split an organizer_name into display pieces: { text } for plain text and
 * { text, org } for a span naming a saved organiser, so the page can link each
 * organiser's name in place ("<A> & <B>").
 */
export function organiserNameParts(organizerName, orgs) {
  const name = String(organizerName ?? '');
  if (!name) return [];
  const lower = name.toLowerCase();
  const spans = [];
  for (const org of orgs || []) {
    const re = new RegExp(`(^|[^a-z0-9])(${escapeRe(organiserKey(org.name)).replace(/ /g, '\\s+')})(?=[^a-z0-9]|$)`);
    const m = re.exec(lower);
    if (!m) continue;
    const start = m.index + m[1].length;
    const end = start + m[2].length;
    if (spans.some((s) => start < s.end && end > s.start)) continue;
    spans.push({ start, end, org });
  }
  if (spans.length === 0) return [{ text: name }];
  spans.sort((a, b) => a.start - b.start);
  const parts = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) parts.push({ text: name.slice(at, s.start) });
    parts.push({ text: name.slice(s.start, s.end), org: s.org });
    at = s.end;
  }
  if (at < name.length) parts.push({ text: name.slice(at) });
  return parts;
}

/** Escape a value for a PostgREST ilike pattern (%, _ and \ are wildcards). */
export function ilikeContains(value) {
  return `%${String(value ?? '').trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
