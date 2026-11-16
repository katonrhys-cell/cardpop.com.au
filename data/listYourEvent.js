/**
 * Copy for the organiser landing page, /list-your-event.
 *
 * One source for the SPA page (pages/community/ListYourEventPage.jsx) and the
 * bot prerender (api/prerender.js → STATIC_CONTENT['/list-your-event']), so
 * the two can't drift apart (no cloaking). Dependency-free.
 *
 * Every promise here is something the site already does: free listings are
 * submitted from Account → My Events and reviewed; the member ticket offer is
 * the event form's Member Offer tab (docs/event-ticket-offers.md), whose
 * clicks and reveals are counted per event; featured placement is
 * events.is_featured (admin-set) — utils/eventFeatured.js puts the event in the
 * "Featured events" strip above the calendar, first in its month and with a
 * Featured badge on its card and page. Promotion the team does by hand (an
 * Instagram story, an Instagram post, a full event review) is sold separately
 * as extras, to any organiser, featured or not.
 * No newsletter mention until the newsletter runs. The only prices here are
 * Calendar Spotlight, the extras and the Ultimate membership, read from
 * utils/featuredPackages.js and config/subscription.js (the tables the server
 * charges from) — never type a price into this file. Never put an
 * audience figure here either: live numbers come from the nightly GA4 /
 * Search Console sync, shown only above their floors (utils/siteTraffic.js).
 */

import {
  FEATURED_PACKAGES, EVENT_EXTRAS, EXTRAS_ENQUIRY_EMAIL, EARLY_BIRD, BUNDLE, bundleCents, formatAud,
} from '../utils/featuredPackages.js';
import { TIER_PRICES_AUD } from '../config/subscription.js';

export const LIST_EVENT_PATH = '/list-your-event';
export const SUBMIT_EVENT_PATH = '/account/events';
export const ORGANISER_EMAIL = 'admin@cardpop.com.au';

const mailto = (subject) =>
  `mailto:${ORGANISER_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const MEMBER_OFFER_MAILTO = mailto('Member ticket offer for my event');
export const FEATURED_MAILTO = mailto('Featured placement for my event');

const cheapestFeature = Math.min(...FEATURED_PACKAGES.map((p) => p.priceAud * 100));
export const FEATURED_FROM_PRICE = `From ${formatAud(cheapestFeature)}`;

/** Featured Placement (one package), for the /list-your-event packages section. */
export const LIST_EVENT_FEATURED_PACKAGES = FEATURED_PACKAGES.map((p) => ({
  key: p.key,
  name: p.name,
  price: formatAud(p.priceAud * 100),
  packPrice: formatAud(bundleCents(p.key)),
  highlight: Boolean(p.highlight),
  points: p.points,
}));

/** The promotion extras, for the /list-your-event extras section. */
export const LIST_EVENT_EXTRAS = EVENT_EXTRAS.map((x) => ({
  key: x.key,
  name: x.name,
  price: formatAud(x.priceAud * 100),
  highlight: Boolean(x.highlight),
  points: x.points,
  terms: x.terms,
}));

export const EXTRAS_NOTE =
  'Extras are promotion the CardPop team does for your show. They are separate from featured placement and from membership: add one to any event, on any plan. Prices include GST and are per event.';

export const EXTRAS_ENQUIRY_NOTE =
  `Want something that isn't listed here? Email ${EXTRAS_ENQUIRY_EMAIL} and we'll talk it through.`;

export const EXTRAS_ENQUIRY_MAILTO = `mailto:${EXTRAS_ENQUIRY_EMAIL}?subject=${encodeURIComponent('Promotion for my event')}`;

/** Featuring every show a year costs less on the Ultimate membership. */
export const FEATURED_MEMBERSHIP_NOTE =
  `Run several shows a year? The Ultimate membership (${formatAud(TIER_PRICES_AUD.ultimate * 100)} a year) features every event you run, so you never pay per event.`;

/** The 3-event pack, in one sentence: "Spotlight $119, …" for three events. */
export const FEATURED_BUNDLE_NOTE =
  `Running ${BUNDLE.size} or more shows? Feature any ${BUNDLE.size} of them in one payment with the ${BUNDLE.size}-event pack: ${
    FEATURED_PACKAGES.map((p) => `${p.name} ${formatAud(bundleCents(p.key))}`).join(', ')
  } for all ${BUNDLE.size}, with early bird still taken off any show ${EARLY_BIRD.minDays / 7}+ weeks away.`;

export const FEATURED_EARLY_BIRD_NOTE =
  `Book ${EARLY_BIRD.minDays / 7} or more weeks before your show and Calendar Spotlight is ${EARLY_BIRD.pct}% off. Prices include GST and are per event.`;

export const LIST_EVENT_SEO = {
  title: 'List Your Card Show Free | CardPop Australia™ for Event Organisers',
  description:
    'Running a card show, tournament or trade night in Australia? List it on CardPop free, give members a ticket discount through your own referral link, and see how many collectors clicked.',
};

export const LIST_EVENT_HERO = {
  eyebrow: 'For event organisers',
  h1: 'Put your card show in front of Australian collectors.',
  intro:
    'List your event on CardPop for free. Add a member ticket discount and your referral link, and we send collectors straight to your tickets, then tell you how many went.',
};

export const LIST_EVENT_TIERS = [
  {
    key: 'listing',
    name: 'Event listing',
    price: 'Free',
    summary: 'Your show on the CardPop events calendar, the local map and its own page.',
    points: [
      'Dates, venue, ticket prices, photos, videos and your logo',
      'Links to your website, socials and trader applications',
      'Shown to Google with full event details',
      'Reviewed by a person, usually within a few days',
      'A "Listed on CardPop" badge for your own website',
    ],
    cta: { label: 'Submit your event', href: SUBMIT_EVENT_PATH },
  },
  {
    key: 'offer',
    name: 'Member ticket offer',
    price: 'Free',
    highlight: true,
    summary: 'A discount code for CardPop members, with "Get Tickets" going through your referral link.',
    points: [
      'Your code is shown only to signed-in members, so it stays off coupon sites',
      '"Get Tickets" opens your Humanitix, Eventbrite or shop referral link',
      'We count ticket clicks and code reveals and send you the numbers',
      'Switch it off at any time, and the counts are kept',
    ],
    cta: { label: 'Send us your code', href: MEMBER_OFFER_MAILTO, external: true },
  },
  {
    key: 'featured',
    name: 'Featured Placement',
    price: FEATURED_FROM_PRICE,
    summary: 'Your show goes to the top of the CardPop events calendar until it ends. Pay online in a minute, or get it on every show with the Ultimate membership.',
    points: [
      'A spot in the "Featured events" section at the top of the events calendar',
      'First in its month on the calendar, with a Featured badge',
      'Included on every event you run with the Ultimate membership',
      `${EARLY_BIRD.pct}% off when you book ${EARLY_BIRD.minDays / 7}+ weeks ahead`,
    ],
    cta: { label: 'Feature Now', href: `${SUBMIT_EVENT_PATH}?feature=1` },
  },
];

export const LIST_EVENT_STEPS = [
  { step: '1. Submit your event', body: 'Sign in and add it from My Events in your account. It takes about five minutes.' },
  { step: '2. We review it', body: 'Every event is checked by a person before it goes live on the calendar.' },
  { step: '3. Add your member offer', body: `Email ${ORGANISER_EMAIL} with your discount code and referral link, and we attach it to your event.` },
  { step: '4. See the numbers', body: 'We count every ticket click and every code reveal, and send you the totals.' },
];

export const LIST_EVENT_FAQS = [
  {
    q: 'What does it cost to list an event?',
    a: `Nothing. Listing a card show, tournament, trade night or store event on CardPop is free. So is adding a member ticket offer. Featured Placement is paid: ${LIST_EVENT_FEATURED_PACKAGES.map((p) => `${p.name} ${p.price}`).join(', ')} per event, including GST, or included on every event with the Ultimate membership. Featuring ${BUNDLE.size} events at once costs less with the ${BUNDLE.size}-event pack. Promotion extras are optional: ${LIST_EVENT_EXTRAS.map((x) => `${x.name} ${x.price}`).join(', ')}.`,
  },
  {
    q: 'How do I feature my event?',
    a: `Submit your event, then press "Feature" next to it in My Events and pay by card. Featuring switches on as soon as the payment goes through and lasts until your show ends. Book ${EARLY_BIRD.minDays / 7} or more weeks before the show and it's ${EARLY_BIRD.pct}% off. With ${BUNDLE.size} or more events waiting, press "Choose ${BUNDLE.size} events" in My Events for the ${BUNDLE.size}-event pack.`,
  },
  {
    q: 'Can CardPop promote my event on Instagram or review it?',
    a: `Yes, as paid extras, separate from featuring: ${LIST_EVENT_EXTRAS.map((x) => `${x.name} ${x.price}`).join(', ')}, including GST. Press "Promote" next to your event in My Events. For the full event review, CardPop attends on the day of the show only and you provide free entry. For anything beyond these, email ${EXTRAS_ENQUIRY_EMAIL}.`,
  },
  {
    q: 'What kinds of events can I list?',
    a: 'Any trading card event in Australia that collectors can attend: card shows and expos, trade nights, tournaments, store events and community meet-ups, for Pokémon, sports cards, Magic, One Piece, Yu-Gi-Oh! and the rest.',
  },
  {
    q: 'Who sees my discount code?',
    a: 'Only signed-in CardPop members, after they press "Reveal ticket code". Visitors who are signed out see your offer line (for example "15% off GA tickets") and a prompt to sign in. The code itself is never sent to their browser.',
  },
  {
    q: 'Does CardPop sell my tickets or take a cut?',
    a: 'No. Tickets are sold on your own site or ticket platform. CardPop shows the offer and sends the click to your referral link. If you want to pay a referral fee per ticket, your platform\'s referral report is the record of sales, and we agree the rate with you directly.',
  },
  {
    q: 'What numbers do I get?',
    a: 'Ticket clicks (how many times "Get Tickets" was pressed while your offer was live) and code reveals (how many members revealed your code). Ticket sales happen on your site, so your referral link is what shows which clicks bought.',
  },
  {
    q: 'Can I change or remove the offer?',
    a: `Yes. Email ${ORGANISER_EMAIL} and we update the code or link, or switch the offer off. Switching it off hides it straight away and keeps the counts.`,
  },
];
