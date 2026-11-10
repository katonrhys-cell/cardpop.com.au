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
 * Featured badge on its card and page — plus Instagram promotion done by hand.
 * No newsletter mention until the newsletter runs. Never put a price or an audience figure in this file —
 * live numbers come from the nightly GA4 / Search Console sync, shown only
 * above their floors (utils/siteTraffic.js).
 */

export const LIST_EVENT_PATH = '/list-your-event';
export const SUBMIT_EVENT_PATH = '/account/events';
export const ORGANISER_EMAIL = 'admin@cardpop.com.au';

const mailto = (subject) =>
  `mailto:${ORGANISER_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const MEMBER_OFFER_MAILTO = mailto('Member ticket offer for my event');
export const FEATURED_MAILTO = mailto('Featured placement for my event');

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
    price: 'Ask us',
    summary: 'Your show goes to the top of the CardPop events calendar, and we promote it in the weeks before it runs.',
    points: [
      'A spot in the "Featured events" section at the top of the events calendar',
      'First in its month on the calendar, with a Featured badge',
      'A Featured badge on your event\'s own page',
      'A post and story on CardPop\'s Instagram',
      'A clicks and reveals report after the show',
    ],
    cta: { label: 'Feature Now', href: FEATURED_MAILTO, external: true },
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
    a: 'Nothing. Listing a card show, tournament, trade night or store event on CardPop is free. So is adding a member ticket offer. Only featured placement is paid, and we quote it per event.',
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
