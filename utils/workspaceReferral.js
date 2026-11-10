// Google Workspace referral (Impact advocate programme). The link is a
// platform setting (google_workspace_referral_url, Admin → Settings →
// Referrals) so it can change without a deploy; this file decides whether
// and how it may be shown. Dependency-free so it is trivially testable.

export const WORKSPACE_REFERRAL_DEFAULT_URL = 'https://sharegoogleworkspace.advocate.impact.com/mQZonNp';

// GA4 event fired on every click, with `placement` naming the surface, so
// the placements can be compared in GA4 → Reports → Events.
export const WORKSPACE_REFERRAL_EVENT = 'click_referral';
export const WORKSPACE_REFERRAL_PROGRAM = 'google_workspace';

// ACCC: a commercial relationship behind a recommendation must be disclosed.
export const WORKSPACE_REFERRAL_DISCLOSURE =
  'CardPop may earn a referral reward if you sign up through this link, at no extra cost to you.';

/**
 * The URL to link to, or null when it must not be shown. Only an absolute
 * https URL passes — an admin typo, a `javascript:` URL or a bare path renders
 * nothing rather than a broken or unsafe link.
 */
export function safeReferralUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The link from the platform settings, or null when switched off / invalid. */
export function workspaceReferralUrl(settings = {}) {
  const enabled = settings.google_workspace_referral_enabled;
  if (enabled === false || enabled === 'false') return null;
  return safeReferralUrl(settings.google_workspace_referral_url ?? WORKSPACE_REFERRAL_DEFAULT_URL);
}
