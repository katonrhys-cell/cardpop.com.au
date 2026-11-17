/**
 * What a sole trader's dealer store (/dealer/<slug>) is made of, shared by the
 * member's own editor (pages/account/AccountSoleTrader.jsx) and the admin's
 * (components/admin/SoleTraderStoreDialog.jsx), so the two can't drift.
 *
 * The ABN, store slug and logo upload stay with the owner: the ABN is private,
 * a slug change would break links, and a logo goes through the member's own
 * storage path. An admin can clear a logo, not replace it.
 */

export const STORE_CATEGORIES = [
  'Basketball Cards', 'Football Cards', 'Pokémon Cards', 'Graded Cards',
  'Rookie Cards', 'Autographs', 'Numbered Parallels', 'Case Hits',
  'Sealed Wax', 'Baseball Cards', 'Soccer Cards', 'Cricket Cards',
  'UFC Cards', 'Vintage Cards', 'Sports Memorabilia',
];

export const TRUST_BADGES = [
  { key: 'authentic',         label: '100% Authentic',       desc: 'All cards verified before listing' },
  { key: 'safe_secure',       label: 'Safe & Secure',        desc: 'Cards packed with care and protection' },
  { key: 'worldwide_shipping',label: 'Worldwide Shipping',   desc: 'Fast & reliable shipping Australia & Worldwide' },
  { key: 'collector_first',   label: 'Collector First',      desc: "We're collectors too — you're in good hands" },
  { key: 'fast_dispatch',     label: 'Fast Dispatch',        desc: 'Ships within 1–2 business days' },
  { key: 'returns_accepted',  label: 'Returns Accepted',     desc: '7-day returns on eligible items' },
];

export const STORE_NAME_MAX = 80;
export const STORE_TAGLINE_MAX = 140;
export const STORE_POLICY_MAX = 1000;

const BADGE_KEYS = new Set(TRUST_BADGES.map((b) => b.key));
const CATEGORY_SET = new Set(STORE_CATEGORIES);

/** Starting form values from a profile row. */
export function storeFormFromProfile(profile = {}) {
  return {
    business_name: profile.business_name ?? '',
    business_tagline: profile.business_tagline ?? '',
    dealer_shipping_policy: profile.dealer_shipping_policy ?? '',
    business_categories: Array.isArray(profile.business_categories) ? profile.business_categories : [],
    dealer_trust_badges: Array.isArray(profile.dealer_trust_badges) ? profile.dealer_trust_badges : [],
    removeLogo: false,
  };
}

/**
 * Validate an admin's edit and build the `profiles` update.
 * @returns {{ error: string } | { update: object }}
 */
export function buildStoreUpdate(form = {}) {
  const name = String(form.business_name ?? '').trim();
  if (!name) return { error: 'A business name is required.' };
  if (name.length > STORE_NAME_MAX) return { error: `Keep the business name under ${STORE_NAME_MAX} characters.` };
  const tagline = String(form.business_tagline ?? '').trim();
  if (tagline.length > STORE_TAGLINE_MAX) return { error: `Keep the tagline under ${STORE_TAGLINE_MAX} characters.` };
  const policy = String(form.dealer_shipping_policy ?? '').trim();
  if (policy.length > STORE_POLICY_MAX) return { error: `Keep the shipping policy under ${STORE_POLICY_MAX} characters.` };

  const update = {
    business_name: name,
    business_tagline: tagline,
    dealer_shipping_policy: policy,
    // Only values the member's own editor can produce, in a stable order.
    business_categories: STORE_CATEGORIES.filter((c) => (form.business_categories || []).includes(c) && CATEGORY_SET.has(c)),
    dealer_trust_badges: TRUST_BADGES.map((b) => b.key).filter((k) => (form.dealer_trust_badges || []).includes(k) && BADGE_KEYS.has(k)),
  };
  if (form.removeLogo) update.business_logo_url = null;
  return { update };
}
