// Title, description and FAQ for the card-shop city pages (/card-shops/<city>).
//
// Shared by the SPA (pages/stores/CardShopsCityPage.jsx) and the bot
// prerender (api/prerender.js) so the page Google indexes and the page a
// visitor sees say the same thing. Dependency-free.
//
// These pages are CardPop's biggest source of search impressions ("card shops
// melbourne", "card shops near me"), so the snippet has to earn the click:
// the title leads with the real number of listed stores and the month, which
// is what a list result is judged on. The count comes straight from the
// directory query — never round it up or claim stores we don't list.

// Below this many stores a count reads as thin ("2 Card Shops"), so the
// title falls back to the plain wording.
export const MIN_COUNT_IN_TITLE = 3;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 2026" for `date`, in Australian (Sydney) time. */
export function directoryMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: 'numeric' })
    .formatToParts(date);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const year = parts.find((p) => p.type === 'year')?.value;
  return `${MONTHS[month - 1]} ${year}`;
}

/** The page <title>. */
export function cardShopCityTitle(cityLabel, storeCount, date = new Date()) {
  const n = Number(storeCount) || 0;
  if (n >= MIN_COUNT_IN_TITLE) {
    return `${n} Card Shops in ${cityLabel} (${directoryMonth(date)}) — Pokémon, TCG & Sports Cards`;
  }
  return `Card Shops in ${cityLabel} — Pokémon, TCG & Sports Card Stores | CardPop`;
}

/**
 * The meta description. States the store count only (the page loads a
 * capped handful of events, so an event count would understate).
 */
export function cardShopCityDescription(cityLabel, state, storeCount) {
  const n = Number(storeCount) || 0;
  const shops = n >= MIN_COUNT_IN_TITLE
    ? `${n} trading card shops in ${cityLabel}, ${state}`
    : `Trading card shops in ${cityLabel}, ${state}`;
  return `${shops}: local stores for Pokémon, sports cards, One Piece and other TCGs, with suburbs and websites — plus upcoming card shows near ${cityLabel}.`;
}

/** The FAQ shown on the page and emitted as FAQPage JSON-LD. */
export function cardShopCityFaqs(cityLabel, state) {
  return [
    {
      q: `Where can I buy Pokémon or sports cards in ${cityLabel}?`,
      a: `The stores listed on this page stock trading cards in and around ${cityLabel}. Many also run trade nights and tournaments — check their websites for hours and stock. You can also buy from verified Australian sellers online via the CardPop marketplace.`,
    },
    {
      q: `Are there card shows near ${cityLabel}?`,
      a: `Upcoming card shows and collector events for ${state} are listed on this page as they're announced, with full details on the CardPop events calendar.`,
    },
    {
      q: 'How do I get a store added to this page?',
      a: 'Store owners (or regulars!) can submit a store for free using the "Add your store" form. Submissions are reviewed before going live to keep the directory accurate.',
    },
  ];
}

/** FAQPage JSON-LD for `faqs`. */
export function faqPageLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
