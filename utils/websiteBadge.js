// Copy-paste "CardPop" website badges that earn backlinks.
//
// Each badge is a plain followed <a><img></a> pointing at a public CardPop
// page, for a partner to paste on their own site: an event organiser
// (utils/eventBadge.js), a seller's storefront, or a grading submission
// partner. A followed link from a relevant Australian site is the backlink
// signal we want, so never add rel="nofollow" here. Dependency-free and
// HTML-escaped, since names come from users.

export const SITE = 'https://cardpop.com.au';

export const BADGE_WIDTH = 200;
export const BADGE_HEIGHT = 56;

export const BADGES = {
  event: {
    path: '/badges/listed-on-cardpop.svg',
    alt: 'Listed on CardPop — Australian trading card events',
  },
  seller: {
    path: '/badges/sell-on-cardpop.svg',
    alt: 'Buy my cards on CardPop — Australian trading card marketplace',
  },
  gradingPartner: {
    path: '/badges/grading-partner-cardpop.svg',
    alt: 'CardPop grading partner — Australian card grading submissions',
  },
};

export const escAttr = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The `<a><img></a>` snippet for one badge kind linking to `href`. */
export const badgeSnippet = (kind, href, title) => {
  const badge = BADGES[kind];
  return `<a href="${escAttr(href)}" title="${escAttr(title)}">`
    + `<img src="${SITE}${badge.path}" alt="${escAttr(badge.alt)}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" style="border:0" /></a>`;
};

/** Absolute URL of a seller's public storefront. */
export const sellerPublicUrl = (sellerId) => `${SITE}/seller/${encodeURIComponent(sellerId || '')}`;

/** "Buy my cards on CardPop" — for a seller's site, link page or blog. */
export const sellerBadgeSnippet = ({ id, name } = {}) => badgeSnippet(
  'seller',
  sellerPublicUrl(id),
  name ? `${name} on CardPop` : 'Buy my cards on CardPop',
);

/** Absolute URL of the page listing a grading submission partner. */
export const GRADING_PARTNERS_URL = `${SITE}/grading/submission-partners`;

/** "CardPop grading partner" — for a partner's own site. */
export const gradingPartnerBadgeSnippet = ({ name } = {}) => badgeSnippet(
  'gradingPartner',
  GRADING_PARTNERS_URL,
  name ? `${name} — Australian grading submission partner on CardPop` : 'CardPop grading submission partners',
);
