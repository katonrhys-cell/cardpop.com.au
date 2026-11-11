// An organiser page's public profile (event_organisers). Dependency-free.
// The owner/profile columns arrived with 20261110224209_event_organiser_requests.sql;
// until it lands, readers fall back to BASE_ORGANISER_COLUMNS.

export const BASE_ORGANISER_COLUMNS = 'id, name, slug, logo_url';
export const ORGANISER_PROFILE_COLUMNS = `${BASE_ORGANISER_COLUMNS}, owner_id, description, website_url, instagram_url, facebook_url, youtube_url`;
// extra_logo_urls ships in 20261111050000_organiser_extra_logos.sql; readers try
// this set first and fall back to ORGANISER_PROFILE_COLUMNS, then BASE.
export const ORGANISER_PAGE_COLUMNS = `${ORGANISER_PROFILE_COLUMNS}, extra_logo_urls`;

// A joint organiser: the primary logo plus up to this many more.
export const MAX_EXTRA_LOGOS = 5;

/** Every logo on the page, primary first — http(s) only, de-duplicated. */
export function organiserLogos(org) {
  const seen = new Set();
  const out = [];
  for (const raw of [org?.logo_url, ...(Array.isArray(org?.extra_logo_urls) ? org.extra_logo_urls : [])]) {
    const url = typeof raw === 'string' ? raw.trim() : '';
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out.slice(0, MAX_EXTRA_LOGOS + 1);
}

const LINK_FIELDS = [
  ['website_url', 'Website'],
  ['instagram_url', 'Instagram'],
  ['facebook_url', 'Facebook'],
  ['youtube_url', 'YouTube'],
];

/** The organiser's outbound links that are present and http(s), in display order. */
export function organiserLinks(org) {
  return LINK_FIELDS
    .map(([key, label]) => ({ key, label, url: org?.[key] }))
    .filter(({ url }) => typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url));
}

/**
 * The page's meta description: the organiser's own words (whitespace collapsed,
 * cut to 155 characters at a word boundary) when they've written some, else
 * `fallback`. One rule for the SPA (EventOrganiserPage) and the prerender.
 */
export function organiserMetaDescription(org, fallback = '') {
  const text = String(org?.description ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (text.length <= 155) return text;
  const cut = text.slice(0, 155);
  const space = cut.lastIndexOf(' ');
  return `${(space > 100 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, '')}…`;
}

/** Can this viewer edit the page? Its owner, or an admin. */
export function canEditOrganiserPage(org, userId, isAdmin) {
  if (!org) return false;
  return Boolean(isAdmin) || (Boolean(userId) && org.owner_id === userId);
}
