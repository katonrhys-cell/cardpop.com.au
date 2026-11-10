/**
 * Featured Placement packages for event organisers — the paid tier on
 * /list-your-event and the "Feature" button in Account → My Events.
 *
 * One source for the price shown on the page, the price the organiser is
 * charged (src/routes/event-feature.js prices the Stripe session from here,
 * never from the request) and the tests. Dependency-free so the SPA, the
 * prerender and the backend share it.
 *
 * Prices are AUD, GST-inclusive, per event. Paying turns `events.is_featured`
 * on (the webhook, src/services/eventFeatureService.js): the event moves into
 * the "Featured events" strip above the calendar, first in its month, with a
 * Featured badge — utils/eventFeatured.js. Full Feature also sets
 * events.homepage_featured (the homepage Featured events section,
 * components/home/HomepageFeaturedEvents.jsx). Instagram is
 * done by the CardPop team. Never promise anything here the site doesn't do.
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
  {
    key: 'spotlight_instagram',
    name: 'Spotlight + Instagram',
    priceAud: 99,
    highlight: true,
    points: [
      'Everything in Calendar Spotlight',
      'A post and story on CardPop\'s Instagram in the weeks before the show',
    ],
  },
  {
    key: 'full',
    name: 'Full Feature',
    priceAud: 149,
    points: [
      'Everything in Spotlight + Instagram',
      'A second Instagram story in show week',
      'A spot in the Featured events section of the CardPop homepage',
    ],
  },
];

/** Booked at least `minDays` before the first day of the show → `pct` off. */
export const EARLY_BIRD = { pct: 20, minDays: 28 };

export const featuredPackage = (key) => FEATURED_PACKAGES.find((p) => p.key === key) || null;

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
  priceAud: { spotlight: 119, spotlight_instagram: 239, full: 359 },
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
  if (paid || event.is_featured) return { ok: false, reason: 'This event is already featured.' };
  return { ok: true, reason: null };
};
