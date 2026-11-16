/**
 * What an event organiser can pay CardPop for, per event. Two separate things:
 *
 *   1. FEATURED PLACEMENT — where the event sits on the site. One package,
 *      Calendar Spotlight: paying turns `events.is_featured` on (the webhook,
 *      src/services/eventFeatureService.js) and the event moves into the
 *      "Featured events" strip above the calendar, first in its month, with a
 *      Featured badge — utils/eventFeatured.js. An Ultimate member gets the
 *      same placement on every event they run as part of the membership
 *      (config/plans.js), so they never buy it.
 *
 *   2. PROMOTION EXTRAS — work the CardPop team does by hand for the event:
 *      an Instagram story, an Instagram post, or a full event review. Extras
 *      are sold to any organiser on any plan, never change where the event
 *      sits on the site, and are not part of any membership. An event can
 *      carry each extra once, with or without featuring.
 *
 * One source for the prices shown on the pages, the price the organiser is
 * charged (src/routes/events.js prices the Stripe session from here, never
 * from the request) and the tests. Dependency-free so the SPA, the prerender
 * and the backend share it. Prices are AUD, GST-inclusive, per event.
 *
 * The homepage "Featured events" section (events.homepage_featured) is not
 * sold: an admin switches it on in the event form. Never promise anything
 * here the site or the team doesn't do.
 */

export const FEATURED_PACKAGES = [
  {
    key: 'spotlight',
    name: 'Calendar Spotlight',
    priceAud: 49,
    points: [
      'A spot in the "Featured events" section at the top of the events calendar',
      'First in its month on the calendar, with a Featured badge',
      'A Featured badge on your event\'s own page',
      'A clicks and reveals report after the show',
    ],
  },
];

/**
 * Packages sold before 2026-11 (Spotlight + Instagram, Full Feature). No
 * longer on sale; kept so a purchase row that names one still has a label.
 */
export const RETIRED_FEATURED_PACKAGES = {
  spotlight_instagram: 'Spotlight + Instagram',
  full: 'Full Feature',
};

/** Where an organiser asks for anything beyond the listed extras. */
export const EXTRAS_ENQUIRY_EMAIL = 'admin@cardpop.com.au';

/**
 * Promotion extras. `todo` is what the team does by hand once it is paid
 * (the admin bell and email list it); `terms` are conditions the organiser
 * accepts by buying, shown before they pay.
 */
export const EVENT_EXTRAS = [
  {
    key: 'story',
    name: 'Instagram story',
    priceAud: 49,
    points: [
      'A story about your show on CardPop\'s Instagram before it runs',
      'Links to your event page so collectors can get the details and tickets',
    ],
    todo: ['Instagram story before the show'],
    terms: [],
  },
  {
    key: 'post',
    name: 'Instagram post',
    priceAud: 99,
    highlight: true,
    points: [
      'A post about your show on CardPop\'s Instagram feed before it runs',
      'Stays on the CardPop profile after the show',
    ],
    todo: ['Instagram post before the show'],
    terms: [],
  },
  {
    key: 'review',
    name: 'Full event review',
    priceAud: 199,
    points: [
      'CardPop attends your show on the day',
      'A written review of the event published on CardPop, linked from your event page',
      'An Instagram post about your show, included',
    ],
    todo: [
      'Instagram post before the show',
      'Attend the show on the day (organiser provides free entry)',
      'Write and publish the event review',
    ],
    terms: [
      'You provide free entry for CardPop on the day',
      'Attendance is on the day of the show only',
    ],
  },
];

export const eventExtra = (key) => EVENT_EXTRAS.find((x) => x.key === key) || null;
export const isEventExtra = (key) => Boolean(eventExtra(key));

/** The price of one extra in cents (no early bird, no pack), or null. */
export const extraCents = (key) => {
  const extra = eventExtra(key);
  return extra ? Math.round(extra.priceAud * 100) : null;
};

/** Booked at least `minDays` before the first day of the show → `pct` off. */
export const EARLY_BIRD = { pct: 20, minDays: 28 };

export const featuredPackage = (key) => FEATURED_PACKAGES.find((p) => p.key === key) || null;

/** A display name for any package or extra a purchase row can carry. */
export const purchaseName = (key) =>
  featuredPackage(key)?.name || eventExtra(key)?.name || RETIRED_FEATURED_PACKAGES[key] || key;

/** Today's date (YYYY-MM-DD) in Sydney — the day a booking is made, for every caller. */
export const todayInAustralia = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const DAY_MS = 86400000;
const dayNumber = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS : null;
};

/** Whole days from `today` to the event's first day; null when either is missing. */
export const daysUntilEvent = (startDate, today) => {
  const a = dayNumber(today);
  const b = dayNumber(startDate);
  return a == null || b == null ? null : b - a;
};

export const isEarlyBird = (startDate, today) => {
  const days = daysUntilEvent(startDate, today);
  return days != null && days >= EARLY_BIRD.minDays;
};

/**
 * The price of one package for one event, in cents. `null` for an unknown
 * package. The early-bird discount is rounded to whole cents in the
 * organiser's favour.
 */
export const featuredQuote = (packageKey, startDate, today) => {
  const pkg = featuredPackage(packageKey);
  if (!pkg) return null;
  const baseCents = Math.round(pkg.priceAud * 100);
  const earlyBird = isEarlyBird(startDate, today);
  const discountCents = earlyBird ? Math.ceil((baseCents * EARLY_BIRD.pct) / 100) : 0;
  return { pkg, baseCents, discountCents, priceCents: baseCents - discountCents, earlyBird };
};

/**
 * The 3-event pack: one package for three of the organiser's events, paid in
 * one checkout, at `priceAud` for the three instead of three times the
 * single price. Early bird still applies per event on that event's share of
 * the pack price, so a pack is never dearer than booking the events one by one.
 */
export const BUNDLE = {
  size: 3,
  priceAud: { spotlight: 119 },
};

/** The pack price for a package in cents, or null. */
export const bundleCents = (packageKey) => {
  const aud = BUNDLE.priceAud[packageKey];
  return aud == null ? null : Math.round(aud * 100);
};

/**
 * The price of one package across BUNDLE.size events, in cents. `startDates`
 * are the events' first days, in order. The pack price is split as evenly as
 * whole cents allow (the remainder on the first events), then each event's
 * early bird comes off its own share. Every event's line carries its single
 * list price (`baseCents`) and what it actually costs (`priceCents`), so the
 * purchase rows add up to the charge. null for an unknown package or the
 * wrong number of events.
 */
export const featuredBundleQuote = (packageKey, startDates, today) => {
  const pkg = featuredPackage(packageKey);
  const packCents = bundleCents(packageKey);
  if (!pkg || packCents == null || !Array.isArray(startDates) || startDates.length !== BUNDLE.size) return null;
  const baseCents = Math.round(pkg.priceAud * 100);
  const share = Math.floor(packCents / BUNDLE.size);
  const remainder = packCents - share * BUNDLE.size;
  const lines = startDates.map((startDate, i) => {
    const shareCents = share + (i < remainder ? 1 : 0);
    const earlyBird = isEarlyBird(startDate, today);
    const earlyBirdCents = earlyBird ? Math.ceil((shareCents * EARLY_BIRD.pct) / 100) : 0;
    const priceCents = shareCents - earlyBirdCents;
    return { baseCents, shareCents, earlyBirdCents, priceCents, discountCents: baseCents - priceCents, earlyBird };
  });
  const listCents = baseCents * BUNDLE.size;
  const priceCents = lines.reduce((sum, l) => sum + l.priceCents, 0);
  return {
    pkg,
    lines,
    listCents,
    packCents,
    priceCents,
    savingCents: listCents - priceCents,
    earlyBird: lines.some((l) => l.earlyBird),
  };
};

/** "$49" / "$39.20" */
export const formatAud = (cents) => {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
};

/**
 * Can this event be featured right now? Submitted (pending review) or live,
 * not yet started, and not already featured. `paidPackages` are the packages
 * already paid for this event — one featuring per event.
 */
export const featureEligibility = (event, today, { paid = false } = {}) => {
  if (!event) return { ok: false, reason: 'Event not found.' };
  if (!['approved', 'pending_review'].includes(event.status)) {
    return { ok: false, reason: 'Submit your event for review before featuring it.' };
  }
  const days = daysUntilEvent(event.start_date, today);
  if (days == null) return { ok: false, reason: 'Add your event\'s date before featuring it.' };
  if (days < 0) return { ok: false, reason: 'This event has already started.' };
  // Calendar Spotlight switched on by the organiser's Ultimate membership
  // (events.membership_featured, set by the membership spotlight triggers).
  if (event.membership_featured && !paid) {
    return { ok: false, reason: 'Calendar Spotlight is already included with your Ultimate membership. Instagram and event reviews are under Promote.' };
  }
  if (paid || event.is_featured) return { ok: false, reason: 'This event is already featured.' };
  return { ok: true, reason: null };
};

/**
 * Can this extra be bought for this event right now? Submitted (pending
 * review) or live, dated and not yet started, and not already bought.
 * Whether the event is featured — by payment, an admin or the organiser's
 * Ultimate membership — makes no difference: extras are separate.
 * `bought` is the extras already paid for this event.
 */
export const extraEligibility = (event, extraKey, today, { bought = [] } = {}) => {
  const extra = eventExtra(extraKey);
  if (!extra) return { ok: false, reason: 'Choose an extra.' };
  if (!event) return { ok: false, reason: 'Event not found.' };
  if (!['approved', 'pending_review'].includes(event.status)) {
    return { ok: false, reason: 'Submit your event for review before adding extras.' };
  }
  const days = daysUntilEvent(event.start_date, today);
  if (days == null) return { ok: false, reason: 'Add your event\'s date before adding extras.' };
  if (days < 0) return { ok: false, reason: 'This event has already started.' };
  if (bought.includes(extra.key)) return { ok: false, reason: `${extra.name} is already booked for this event.` };
  return { ok: true, reason: null };
};

/** True when at least one extra could still be bought for the event. */
export const canBuyExtras = (event, today, { bought = [] } = {}) =>
  EVENT_EXTRAS.some((x) => extraEligibility(event, x.key, today, { bought }).ok);
