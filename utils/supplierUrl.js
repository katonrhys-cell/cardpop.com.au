// Canonical form of a shop product's supplier link (Admin → Products →
// Supplier link). Dependency-free: the admin form and the backend supplier
// price watch (src/utils/supplierPrice.js) both use it, so the stored URL and
// the one the watch fetches are the same.

// Marketplace share links carry tracking that changes every time the link is
// shared; strip it so the same listing is the same URL.
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'msclkid', 'ref', 'ref_src', 'igshid',
  'share_token', 'refer_page_el_sn', 'refer_page_name', 'refer_page_id', 'refer_page_sn',
  '_x_sessn_id', 'top_gallery_url', 'spec_gallery_id',
];

/** Canonical form of a supplier link, or null when it isn't a usable http(s) URL. */
export function normaliseSupplierUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  for (const p of TRACKING_PARAMS) url.searchParams.delete(p);
  url.hash = '';
  const out = url.toString();
  return out.length <= 2048 ? out : null;
}

