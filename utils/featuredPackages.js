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
