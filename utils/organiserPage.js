// An organiser page's public profile (event_organisers). Dependency-free.
// The owner/profile columns arrived with 20261110224209_event_organiser_requests.sql;
// until it lands, readers fall back to BASE_ORGANISER_COLUMNS.

export const BASE_ORGANISER_COLUMNS = 'id, name, slug, logo_url';
export const ORGANISER_PROFILE_COLUMNS = `${BASE_ORGANISER_COLUMNS}, owner_id, description, website_url, instagram_url, facebook_url, youtube_url`;
// extra_logo_urls ships in 20261111050000_organiser_extra_logos.sql and the
// TikTok / X / Linktree links in 20261116110000_organiser_tiktok_x_linktree_links.sql;
// readers try this set first and fall back to ORGANISER_PROFILE_COLUMNS, then BASE.
export const ORGANISER_LINK_COLUMNS = `${ORGANISER_PROFILE_COLUMNS}, extra_logo_urls, tiktok_url, x_url, linktree_url`;
// gallery_albums / videos ship in 20261117190000_organiser_page_photos_and_videos.sql;
// readers try the full set, then ORGANISER_LINK_COLUMNS, then the older tiers.
export const ORGANISER_PAGE_COLUMNS = `${ORGANISER_LINK_COLUMNS}, gallery_albums, videos`;
// contact_name / contact_email / contact_phone ship in
// 20261118232637_organiser_contact_details.sql; the organiser page tries this
// set first, then ORGANISER_PAGE_COLUMNS and the older tiers.
export const ORGANISER_CONTACT_COLUMNS = `${ORGANISER_PAGE_COLUMNS}, contact_name, contact_email, contact_phone`;

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
  ['tiktok_url', 'TikTok'],
  ['x_url', 'X'],
  ['linktree_url', 'Linktree'],
];

/** The organiser's outbound links that are present and http(s), in display order. */
export function organiserLinks(org) {
  return LINK_FIELDS
    .map(([key, label]) => ({ key, label, url: org?.[key] }))
    .filter(({ url }) => typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url));
}

const CONTACT_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CONTACT_PHONE_RE = /^\+?[0-9(][0-9 ()-]{5,23}$/;

/** A contact email worth saving / linking, else ''. Same rule as the column check. */
export function cleanContactEmail(value) {
  const email = String(value ?? '').trim();
  return email.length <= 254 && CONTACT_EMAIL_RE.test(email) ? email : '';
}

/** A contact phone worth saving / linking (digits, spaces, brackets, dashes, optional +), else ''. */
export function cleanContactPhone(value) {
  const phone = String(value ?? '').trim().replace(/\s+/g, ' ');
  return CONTACT_PHONE_RE.test(phone) ? phone : '';
}

/**
 * The public contact details an organiser chose to show: `{ name, email, phone,
 * telHref }`, each '' when absent or malformed. `name` only counts alongside
 * an email or phone — a name alone gives nobody a way to get in touch.
 */
export function organiserContact(org) {
  const email = cleanContactEmail(org?.contact_email);
  const phone = cleanContactPhone(org?.contact_phone);
  const name = email || phone ? String(org?.contact_name ?? '').trim().slice(0, 80) : '';
  return { name, email, phone, telHref: phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '' };
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
