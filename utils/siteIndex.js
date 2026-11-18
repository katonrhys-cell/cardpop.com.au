// The Site Index page (/sitemap, linked from the footer): what goes in each
// section and how its links are built. Pure and dependency-light so the rules
// are tested without rendering (tests/frontend/siteIndex.test.js).
//
// The page used to pour three unlabelled lists into one run of links — the
// main pages, the first 100 public vault cards (sold and showcase-only cards
// included, in no order) and 100 active listings — so a listed card appeared
// twice and old cards looked as if they were for sale. Now: headed sections,
// only cards that are listed for sale right now, each once, and the sections
// that were missing (events, articles, price guides, players, card shops).
import { slugify } from '../lib/slugify.js';
import { SHOP_COLLECTION_SEO } from '../data/shopCollectionSeo.js';
import { BLOG_CATEGORIES } from '../data/blogCategories.js';
import { GRADING_SCALE_SLUGS } from '../data/gradingScales.js';

export const SITE_INDEX_LIMITS = Object.freeze({ listings: 60, events: 40, articles: 30, players: 60, stores: 500 });

const PRICE_HUBS = [
  { label: 'Pokémon card prices', path: '/prices/pokemon' },
  { label: 'Basketball card prices', path: '/prices/basketball' },
  { label: 'One Piece card prices', path: '/prices/one-piece' },
  { label: 'AFL card prices', path: '/prices/afl' },
  { label: 'NRL card prices', path: '/prices/nrl' },
];

// Sections that need no data — rendered at once, before any query answers.
export const STATIC_SECTIONS = Object.freeze([
  {
    key: 'main',
    title: 'Main pages',
    links: [
      { label: 'Home', path: '/' },
      { label: 'Marketplace — cards for sale', path: '/marketplace' },
      { label: 'Collections', path: '/collections' },
      { label: 'Shop — card supplies', path: '/shop' },
      { label: 'Events calendar', path: '/events' },
      { label: 'Card shop directory', path: '/card-shops' },
      { label: 'Community', path: '/community' },
      { label: 'Blog — The Parallel Report', path: '/blog' },
      { label: 'Pricing & plans', path: '/pricing' },
    ],
  },
  {
    key: 'supplies',
    title: 'Card supplies',
    links: [
      ...Object.values(SHOP_COLLECTION_SEO).map((group) => ({ label: group.name, path: `/shop/${group.slug}` })),
      { label: 'Palms Off Gaming binders', path: '/shop/binders' },
    ],
  },
  {
    key: 'prices',
    title: 'Prices & market',
    links: [
      { label: 'Card prices (AUD)', path: '/prices' },
      ...PRICE_HUBS,
      { label: 'Market analytics', path: '/analytics' },
      { label: 'New release buying guides', path: '/analytics/buying-guides' },
      { label: 'Australian markets', path: '/australian-markets' },
    ],
  },
  {
    key: 'grading',
    title: 'Grading',
    links: [
      { label: 'Grading hub', path: '/grading' },
      { label: 'What is grading?', path: '/grading/what-is-grading' },
      { label: 'Grading scales', path: '/grading/scales' },
      ...GRADING_SCALE_SLUGS.map((slug) => ({ label: `${slug.toUpperCase()} grading scale`, path: `/grading/scales/${slug}` })),
      { label: 'Compare grading companies', path: '/grading/companies' },
      { label: 'Submission partners', path: '/grading/submission-partners' },
      { label: 'Grade estimator', path: '/grading/estimator' },
      { label: 'Grading ROI calculator', path: '/grading/roi-calculator' },
    ],
  },
  {
    key: 'articles-by-topic',
    title: 'Articles by topic',
    links: BLOG_CATEGORIES.map((category) => ({ label: category.label, path: `/blog/category/${category.slug}` })),
  },
  {
    key: 'help',
    title: 'Help & policies',
    links: [
      { label: 'About CardPop', path: '/about' },
      { label: 'Contact', path: '/contact' },
      { label: 'FAQ & help', path: '/faq' },
      { label: 'Safe buying', path: '/safe-buying' },
      { label: 'Shipping', path: '/shipping' },
      { label: 'Returns & refunds', path: '/returns' },
      { label: 'Trust & safety', path: '/trust-safety' },
      { label: 'Photography standard', path: '/photography-standard' },
      { label: 'List your event', path: '/list-your-event' },
      { label: 'Terms of service', path: '/terms' },
      { label: 'Privacy policy', path: '/privacy-policy' },
      { label: 'Accessibility', path: '/accessibility' },
    ],
  },
]);

const text = (value) => String(value ?? '').trim();

/** "Victor Wembanyama — 2023 Prizm #136": enough to tell two copies of a player apart. */
export function listingLabel(listing) {
  const card = listing?.vault_item || {};
  const name = text(card.card_name) || 'Trading card';
  const setName = text(card.set_name);
  // Many set names already carry their year ("1993-94 Fleer Ultra").
  const year = setName.startsWith(text(card.year)) ? '' : text(card.year);
  const set = [year, setName].filter(Boolean).join(' ');
  const number = text(card.card_number) ? `#${text(card.card_number).replace(/^#/, '')}` : '';
  const detail = [set, number].filter(Boolean).join(' ');
  return detail ? `${name} — ${detail}` : name;
}

/** The listing page's canonical path (same slug rule as the page and the sitemap). */
export const listingPath = (listing) =>
  `/marketplace/${listing.id}/${listing.slug || slugify(listing.vault_item?.card_name || '') || 'listing'}`;

/** "Sat 6 Dec 2026" from a YYYY-MM-DD date, without shifting it across time zones. */
export function eventDateLabel(date) {
  const day = text(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .format(parsed).replace(',', '');
}

/** "gold-coast" → "Gold Coast". */
export const cityLabel = (city) => text(city).split(/[-\s]+/).filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

// One link per path and per label: two identical copies of a card read as a
// mistake in an index, and the "all cards" link below the list covers the rest.
function unique(links) {
  const paths = new Set();
  const labels = new Set();
  return links.filter((link) => {
    const label = link.label.toLowerCase();
    if (!link.path || paths.has(link.path) || labels.has(label)) return false;
    paths.add(link.path);
    labels.add(label);
    return true;
  });
}

/**
 * The data-driven sections, in page order. A section with nothing in it is
 * left out rather than shown empty.
 */
export function buildDynamicSections({ listings = [], events = [], articles = [], players = [], stores = [] } = {}) {
  const sections = [
    {
      key: 'listings',
      title: 'Cards for sale now',
      links: unique(listings.filter((l) => l?.id).map((l) => ({ label: listingLabel(l), path: listingPath(l) }))),
      more: { label: 'Browse every card for sale', path: '/marketplace' },
    },
    {
      key: 'events',
      title: 'Upcoming events',
      links: unique(events.filter((e) => e?.id && text(e.title)).map((e) => ({
        label: text(e.title),
        path: `/events/${e.slug || e.id}`,
        note: [eventDateLabel(e.start_date), text(e.state).toUpperCase()].filter(Boolean).join(' · '),
      }))),
      more: { label: 'See the full events calendar', path: '/events' },
    },
    {
      key: 'stores',
      title: 'Card shops by city',
      links: unique([...new Set(stores.map((s) => text(s?.city)).filter(Boolean))]
        .map((city) => ({ label: `Card shops in ${cityLabel(city)}`, path: `/card-shops/${encodeURIComponent(city)}`, sort: cityLabel(city) }))
        .sort((a, b) => a.sort.localeCompare(b.sort))),
      more: { label: 'Open the card shop directory', path: '/card-shops' },
    },
    {
      key: 'articles',
      title: 'Latest articles',
      links: unique(articles.filter((a) => text(a?.slug) && text(a.title))
        .map((a) => ({ label: text(a.title), path: `/blog/${a.slug}` }))),
      more: { label: 'Read every article', path: '/blog' },
    },
    {
      key: 'players',
      title: 'Players',
      links: unique(players.filter((p) => text(p?.slug) && text(p.name))
        .map((p) => ({ label: text(p.name), path: `/players/${p.slug}` }))),
      more: { label: 'See all players', path: '/players' },
    },
  ];
  return sections.filter((section) => section.links.length > 0);
}
