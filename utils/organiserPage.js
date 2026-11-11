// An organiser page's public profile (event_organisers). Dependency-free.
// The owner/profile columns arrived with 20261110224209_event_organiser_requests.sql;
// until it lands, readers fall back to BASE_ORGANISER_COLUMNS.

export const BASE_ORGANISER_COLUMNS = 'id, name, slug, logo_url';
export const ORGANISER_PAGE_COLUMNS = `${BASE_ORGANISER_COLUMNS}, owner_id, description, website_url, instagram_url, facebook_url, youtube_url`;

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

/** Can this viewer edit the page? Its owner, or an admin. */
export function canEditOrganiserPage(org, userId, isAdmin) {
  if (!org) return false;
  return Boolean(isAdmin) || (Boolean(userId) && org.owner_id === userId);
}
