/**
 * Resolves who a listing is sold by, for display.
 *
 * Three tiers, in priority order:
 *   1. The platform's own storefront account (`is_admin`) — branded
 *      "Official CardPop Store" with the CardPop logo, never shown as a
 *      community member and never under the Community Vault badge.
 *   2. A dealer (`is_sole_trader` with a claimed `store_slug`) — shown under
 *      their business name, linking to their /dealer/<slug> store.
 *   3. Everyone else — display name / username, linking to /seller/<id>.
 *
 * `is_admin` is in PUBLIC_PROFILE_COLUMNS (readable by any client), so this
 * works from the embedded seller row on a listing without extra queries.
 */

export const OFFICIAL_STORE_NAME = 'Official CardPop Store';

/**
 * @param {object|null|undefined} profile - a public profiles row (or embedded
 *   subset). Recognised fields: id, is_admin, is_sole_trader, store_slug,
 *   business_name, business_logo_url, display_name, username, full_name,
 *   is_verified.
 * @param {string} [fallbackId] - seller id when the profile row is missing
 * @returns {{id: string|null, business_name: string, is_verified: boolean,
 *   type: 'official'|'user', isDealer: boolean, storePath: string|null,
 *   logoUrl: string|null}}
 */
export function sellerFromProfile(profile, fallbackId) {
  if (!profile) {
    return {
      id: fallbackId ?? null,
      business_name: 'Community Member',
      is_verified: false,
      type: 'user',
      isDealer: false,
      storePath: null,
      logoUrl: null,
    };
  }

  const official = profile.is_admin === true;
  const isDealer = profile.is_sole_trader === true && !!profile.store_slug;

  return {
    id: profile.id ?? fallbackId ?? null,
    business_name: official
      ? OFFICIAL_STORE_NAME
      : (isDealer && profile.business_name)
        || profile.display_name || profile.username || profile.full_name
        || 'Community Member',
    // The platform's own store is verified by definition.
    is_verified: official || profile.is_verified === true,
    type: official ? 'official' : 'user',
    isDealer,
    storePath: isDealer ? `/dealer/${profile.store_slug}` : null,
    logoUrl: profile.business_logo_url || null,
  };
}
