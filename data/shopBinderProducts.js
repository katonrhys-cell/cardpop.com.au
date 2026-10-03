/**
 * Palms Off Gaming binder catalogue — the static half of each product page.
 *
 * Mirrors data/shopCollectionSeo.js: prices, stock and status live in the
 * `shop_products` table (editable in /admin/products), while the copy, specs,
 * gallery order and colour list live here so the SPA, api/prerender.js and
 * api/sitemap.js all render the same words without a round trip. Keep this file
 * dependency-free — the serverless functions import it directly.
 *
 * Each entry is keyed by `slug`, which is both shop_products.slug and the last
 * segment of the canonical URL:
 *
 *   /shop/binders/<slug>
 *
 * Stage 1 (this file) is one page per product line, photographed in its hero
 * colour. Every line also ships in the colours listed under `colours` — those
 * become their own products, and their own pages, in a later pass. The image
 * paths are the real object names in the `palms off gaming products` Supabase
 * Storage bucket; the folder and file naming there is inconsistent between
 * lines (colour folders are sometimes "Black", sometimes "TOP-04-BLK", once
 * "Black STEALTH 12 - STL-12-BLK 3D Renders"), which is exactly why the paths
 * are listed verbatim rather than rebuilt from a pattern.
 */

import { BINDER_PRODUCT_COPY } from './shopBinderProductCopy.js';
import { colourHex } from '../utils/colourSwatch.js';
import { binderCapacity, binderCapacityText } from '../utils/binderCapacity.js';

// The bucket name contains spaces, so every path segment has to be encoded.
// encodeURIComponent would eat the "/" separators, hence the per-segment map.
export const BINDER_IMAGE_BUCKET = 'palms off gaming products';
const SUPABASE_PUBLIC_BASE = 'https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public';

/** Absolute public URL for a storage path in the Palms Off Gaming bucket. */
export const binderImageUrl = (storagePath) => {
  if (!storagePath) return null;
  const encoded = `${BINDER_IMAGE_BUCKET}/${storagePath}`.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_PUBLIC_BASE}/${encoded}`;
};

const colours = (...names) => names.map((name) => ({ name, hex: colourHex(name) }));

// Shared spec rows. Every Collector's Series binder is built the same way, so
// the differences between products are the pocket count and the loading edge —
// not the construction. Kept as a function so each product can append its own.
const collectorsSeriesBuild = [
  { label: 'Cover', value: 'Textured PU leather over a padded board' },
  { label: 'Closure', value: 'Full-perimeter metal zip' },
  { label: 'Inner cover', value: 'Polyester felt lining' },
  { label: 'Pocket material', value: 'Acid-free and PVC-free, archival safe' },
];

const BINDER_ROWS = [
  // ── Collector's Series zip binders (side-loading, raw cards) ───────────────
  {
    slug: 'palms-off-gaming-collectors-series-4-pocket-zip-binder',
    sku: 'ZB-04',
    title: "Palms Off Gaming Collector's Series 4-Pocket Zip Binder",
    shortTitle: "Collector's Series 4-Pocket Zip Binder",
    range: "Collector's Series",
    pocketsPerPage: 4,
    holds: 'raw cards',
    heroColour: 'Black',
    colours: colours('Black', 'Blue', 'Green', 'Pink', 'Purple', 'Red', 'Turquoise', 'Yellow'),
    imageFolder: 'BINDERS/Collectors series 4 pocket/Black',
    imageFiles: [
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_pkg1.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_front.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_profile.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_spread.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_interior.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_pockets.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_zipper.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_logo.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_pkg2.png',
      'ZB-04-BLK_collectors-series-4-pocket-zip-binder-black_pkg3.png',
    ],
    metaTitle: "Palms Off Gaming Collector's Series 4-Pocket Zip Binder | CardPop",
    metaDescription:
      "The 4-pocket Collector's Series zip binder from Palms Off Gaming — side-loading archival pockets, a padded PU leather cover and a full metal zip. Eight colours, shipped Australia-wide.",
    intro:
      "Four pockets to a page is the layout collectors reach for when the cards themselves are the point. Oversized art, full-art trainers, jumbo promos and thick-stock inserts all sit comfortably in a 4-pocket page, with enough margin around each card that nothing crowds the artwork. This is the Palms Off Gaming Collector's Series build: a padded textured-PU cover, a metal zip that runs the full perimeter, and side-loading pockets that hold cards in place even when the binder is upside down.",
    highlights: [
      'Four side-loading pockets per page — cards go in from the side, not the top, so nothing slides out when the binder is tipped or carried',
      'Full-perimeter metal zip keeps the pages sealed in transit',
      'Padded textured PU leather cover with a polyester felt inner lining',
      'Acid-free, PVC-free archival pockets that will not haze or leach into card surfaces',
      'Sized for standard trading cards — Pokémon, One Piece, Magic, Yu-Gi-Oh and sports',
      'Available in eight colours',
    ],
    faqs: [
      {
        q: 'Will a sleeved card fit in a 4-pocket page?',
        a: 'Yes. The pockets are cut to take a standard-size card in a penny sleeve or a perfect-fit sleeve. A card in a thick premium sleeve will also fit, though the binder will sit fuller when every pocket is loaded.',
      },
      {
        q: 'What is the difference between side-loading and top-loading pockets?',
        a: 'Side-loading pockets open on the inner edge of the page, facing the spine. Because the opening points inward, gravity works against a card falling out rather than with it. Top-loading pages open upward, which is faster to fill but far easier to spill.',
      },
      {
        q: 'Is this binder safe for long-term storage?',
        a: 'The pockets are acid-free and PVC-free, which is the property that matters for long-term contact with a card face. PVC pockets can break down over years and leave a residue on the card surface; these will not.',
      },
      {
        q: 'Should I choose 4, 9 or 12 pockets?',
        a: 'Four pockets suits display and oversized cards, nine is the classic layout most collections are sorted in, and twelve fits the most cards per page for bulk or set-building. All three share the same cover, zip and pocket construction.',
      },
    ],
  },
  {
    slug: 'palms-off-gaming-collectors-series-9-pocket-zip-binder',
    sku: 'ZB-09',
    title: "Palms Off Gaming Collector's Series 9-Pocket Zip Binder",
    shortTitle: "Collector's Series 9-Pocket Zip Binder",
    range: "Collector's Series",
    pocketsPerPage: 9,
    holds: 'raw cards',
    heroColour: 'Black',
    colours: colours('Black', 'Blue', 'Green', 'Pink', 'Purple', 'Red', 'Turquoise', 'Yellow'),
    imageFolder: 'BINDERS/Collectors series 9 pocket/Black',
    imageFiles: [
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_pkg1.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_front.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_profile.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_spread.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_interior.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_pockets.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_zipper.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_logo.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_pkg2.png',
      'ZB-09-BLK_collectors-series-9-pocket-zip-binder-black_pkg3.png',
    ],
    metaTitle: "Palms Off Gaming Collector's Series 9-Pocket Zip Binder | CardPop",
    metaDescription:
      "The 9-pocket Collector's Series zip binder from Palms Off Gaming — side-loading archival pockets, padded PU leather and a full metal zip. Eight colours, shipped Australia-wide.",
    intro:
      "Nine pockets is the layout almost every trading card collection is organised in — three by three, set order, one page per row of a master set. The Palms Off Gaming Collector's Series takes that familiar layout and builds it properly: side-loading pockets so cards stay put, a metal zip around the full perimeter, and a padded textured-PU cover that survives being carried to locals every week.",
    highlights: [
      'Nine side-loading pockets per page — the standard layout for set-building and master sets',
      'Full-perimeter metal zip keeps the pages sealed in transit',
      'Padded textured PU leather cover with a polyester felt inner lining',
      'Acid-free, PVC-free archival pockets that will not haze or leach into card surfaces',
      'Sized for standard trading cards — Pokémon, One Piece, Magic, Yu-Gi-Oh and sports',
      'Available in eight colours',
    ],
    faqs: [
      {
        q: 'Is a 9-pocket binder the right choice for a master set?',
        a: 'For most collections, yes. Nine pockets to a page means a page reflects a clean slice of set order, which makes gaps obvious at a glance — the single most useful property when you are chasing a set to completion.',
      },
      {
        q: 'Will sleeved cards fit?',
        a: 'Yes. The pockets take a standard-size card in a penny sleeve or perfect-fit sleeve comfortably. Double-sleeved cards will fit but will fill the binder faster.',
      },
      {
        q: 'How is this different from a cheap ring binder?',
        a: 'Ring binders press a metal ring against the pages, which over time dents the cards nearest the spine and lets pages tear free. A zip binder has fixed, bound pages and no rings to catch — and the zip means the whole thing can be carried without the contents shifting.',
      },
      {
        q: 'Does the zip scratch the cards?',
        a: 'No. The zip runs around the outside edge of the cover, well clear of the pocket area, and the inner cover is lined with polyester felt.',
      },
    ],
  },
  {
    slug: 'palms-off-gaming-collectors-series-12-pocket-zip-binder',
    sku: 'ZB-12',
    title: "Palms Off Gaming Collector's Series 12-Pocket Zip Binder",
    shortTitle: "Collector's Series 12-Pocket Zip Binder",
    range: "Collector's Series",
    pocketsPerPage: 12,
    holds: 'raw cards',
    heroColour: 'Black',
    colours: colours('Black', 'Blue', 'Green', 'Pink', 'Purple', 'Red', 'Turquoise', 'Yellow'),
    imageFolder: 'BINDERS/Collectors series 12 pocket/Black',
    imageFiles: [
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_pkg1.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_front.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_profile.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_spread.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_interior.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_pockets.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_zipper.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_logo.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_pkg2.png',
      'ZB-12-BLK_collectors-series-12-pocket-zip-binder-black_pkg3.png',
    ],
    metaTitle: "Palms Off Gaming Collector's Series 12-Pocket Zip Binder | CardPop",
    metaDescription:
      "The 12-pocket Collector's Series zip binder from Palms Off Gaming — the highest-capacity layout in the range, with side-loading archival pockets and a full metal zip. Eight colours.",
    intro:
      "Twelve pockets to a page is the highest-density layout Palms Off Gaming builds, and it exists for the collector whose problem is volume. Bulk rares, trade stock, a set you are sorting before it goes into long-term storage — a 12-pocket page holds a third more than a 9-pocket one, in the same footprint of binder. The construction is unchanged from the rest of the Collector's Series: side-loading pockets, a full metal zip and a padded textured-PU cover.",
    highlights: [
      'Twelve side-loading pockets per page — the highest capacity layout in the Collector\'s Series',
      'Full-perimeter metal zip keeps the pages sealed in transit',
      'Padded textured PU leather cover with a polyester felt inner lining',
      'Acid-free, PVC-free archival pockets that will not haze or leach into card surfaces',
      'Sized for standard trading cards — Pokémon, One Piece, Magic, Yu-Gi-Oh and sports',
      'Available in eight colours',
    ],
    faqs: [
      {
        q: 'Who is a 12-pocket binder for?',
        a: 'Anyone moving volume. Traders carrying stock to events, players sorting bulk, and collectors consolidating a set before it goes into storage all get more out of twelve pockets than nine.',
      },
      {
        q: 'Are the pockets smaller than a 9-pocket page?',
        a: 'The pockets still take a standard-size card — the page is denser because there is less margin around each card, not because the pockets are cut smaller.',
      },
      {
        q: 'Will the binder still zip closed when every pocket is full?',
        a: 'Yes. The binder is built around a full page count of loaded pockets, and the zip runs the full perimeter so the load is spread rather than concentrated at a clasp.',
      },
      {
        q: 'Can I mix this with 9-pocket pages?',
        a: 'No — the pages in a zip binder are bound in, which is what stops them tearing loose. If you want to mix page layouts, the Collector\'s Series Ring Binder takes interchangeable pages instead.',
      },
    ],
  },

  // ── Collector's Series top loader zip binders (graded/loaded cards) ────────
  {
    slug: 'palms-off-gaming-collectors-series-4-pocket-top-loader-zip-binder',
    sku: 'TOP-04',
    title: "Palms Off Gaming Collector's Series 4-Pocket Top Loader Zip Binder",
    shortTitle: "Collector's Series 4-Pocket Top Loader Zip Binder",
    range: "Collector's Series",
    pocketsPerPage: 4,
    holds: 'cards in top loaders',
    heroColour: 'Black',
    colours: colours('Black', 'Blue', 'Green', 'Pink', 'Purple', 'Red', 'Turquoise', 'Yellow'),
    imageFolder: 'BINDERS/Collectors series 4 Pocket Top Loader Binder/TOP-04-BLK',
    imageFiles: [
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_pkg1.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_front.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_profile.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_spread.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_interior.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_pockets.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_zipper.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_logo.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_pkg2.png',
      'TOP-04-BLK_collectors-series-4-pocket-top-loader-zip-binder-black_pkg3.png',
    ],
    metaTitle: "Palms Off Gaming Collector's Series 4-Pocket Top Loader Zip Binder | CardPop",
    metaDescription:
      'A zip binder with pockets cut for 35pt top loaders, four to a page — store cards already in loaders without taking them out. Eight colours, shipped Australia-wide from CardPop.',
    intro:
      "Most binders force a choice: leave a card in its top loader and have nowhere to file it, or pull it out of the loader to fit a page. This binder removes the choice. The pockets are cut to take a standard 35pt top loader whole, four to a page, so the card never leaves the protection it is already in. It is the natural home for a trade binder, for cards waiting on a grading submission, or for anything valuable enough that you would rather not handle it twice.",
    highlights: [
      'Pockets sized for standard 35pt top loaders — four per page',
      'Cards stay inside their loaders, so they are never handled to be filed',
      'Full-perimeter metal zip keeps the pages sealed in transit',
      'Padded textured PU leather cover with a polyester felt inner lining',
      'Ideal for trade binders, grading queues and high-value singles',
      'Available in eight colours',
    ],
    faqs: [
      {
        q: 'What size top loader does this fit?',
        a: 'Standard 35pt top loaders, the common 3" x 4" size that fits an unsleeved or penny-sleeved standard card. Thicker-point loaders for jersey or patch cards will not fit.',
      },
      {
        q: 'Can I put loose cards in it?',
        a: 'You can, but they will sit loose in a pocket built for a rigid loader. If most of your collection is raw, the standard Collector\'s Series 4-pocket zip binder is the better fit.',
      },
      {
        q: 'Is this a good binder for taking to events?',
        a: 'It is one of the better options. A card in a top loader inside a zipped binder has two layers of protection and no way to slide out, which is exactly what you want when a binder is being passed across a table.',
      },
      {
        q: 'Does it fit graded slabs?',
        a: 'No. Graded slabs are far thicker than a top loader — they need a dedicated graded card case or a slab display rather than a binder page.',
      },
    ],
  },
  {
    slug: 'palms-off-gaming-collectors-series-9-pocket-top-loader-zip-binder',
    sku: 'TOP-09',
    title: "Palms Off Gaming Collector's Series 9-Pocket Top Loader Zip Binder",
    shortTitle: "Collector's Series 9-Pocket Top Loader Zip Binder",
    range: "Collector's Series",
    pocketsPerPage: 9,
    holds: 'cards in top loaders',
    heroColour: 'Black',
    colours: colours('Black', 'Blue', 'Green', 'Pink', 'Purple', 'Red', 'Turquoise', 'Yellow'),
    imageFolder: 'BINDERS/Collectors series Top Loader Binder 9 Pocket/Black',
    imageFiles: [
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_pkg1.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_front.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_profile.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_spread.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_interior.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_pockets.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_zipper.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_logo.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_pkg2.png',
      'TOP-09-BLK_collectors-series-9-pocket-top-loader-zip-binder-black_pkg3.png',
    ],
    metaTitle: "Palms Off Gaming Collector's Series 9-Pocket Top Loader Zip Binder | CardPop",
    metaDescription:
      'Nine 35pt top loaders to a page in a zipped, archival-safe binder — the highest-capacity way to store loaded cards without unloading them. Eight colours, shipped Australia-wide.',
    intro:
      "The nine-pocket version of the top loader binder is the one traders end up carrying. Nine loaders to a page means a full trade binder fits in a single volume rather than three, and because every card stays inside its loader, a binder that gets opened and flipped through a dozen times at an event is not putting wear on the cards themselves. Same Collector's Series construction as the rest of the range, metal zip and padded PU cover, with velvet-lined inside covers.",
    highlights: [
      'Pockets sized for standard 35pt top loaders — nine per page',
      'The highest-capacity loaded-card layout Palms Off Gaming makes',
      'Cards stay inside their loaders, so they are never handled to be filed',
      'Full-perimeter metal zip keeps the pages sealed in transit',
      'Padded textured PU leather cover with velvet-lined inside covers',
      'Available in eight colours',
    ],
    faqs: [
      {
        q: 'How is this different from the 9-pocket Collector\'s Series zip binder?',
        a: 'The pockets. This binder\'s pockets are cut to take a rigid 35pt top loader; the standard binder\'s pockets are cut for a bare or sleeved card. They look similar from the outside and are not interchangeable in use.',
      },
      {
        q: 'What size top loader does this fit?',
        a: 'Standard 35pt top loaders — the common 3" x 4" size. Thicker-point loaders made for jersey, patch or relic cards will not seat properly.',
      },
      {
        q: 'Is this the right binder for a trade night?',
        a: 'It is the one built for it. Loaders protect against the handling a trade binder gets, the pockets stop anything sliding out when the binder is passed around, and the zip means nothing is lost between the table and the car.',
      },
      {
        q: 'Can I use it for cards waiting on grading?',
        a: 'Yes, and it is a common use. Cards destined for a submission are usually already in loaders or semi-rigids, and this keeps them in order without a second round of handling.',
      },
    ],
  },

  // ── Stealth zip binders ───────────────────────────────────────────────────
  {
    slug: 'palms-off-gaming-stealth-9-pocket-zip-binder',
    sku: 'STL-09',
    title: 'Palms Off Gaming Stealth 9-Pocket Zip Binder',
    shortTitle: 'Stealth 9-Pocket Zip Binder',
    range: 'Stealth',
    pocketsPerPage: 9,
    holds: 'raw cards',
    heroColour: 'Black',
    colours: colours('Black', 'Blue', 'Pink', 'Purple', 'Red', 'Turquoise', 'Yellow'),
    imageFolder: 'BINDERS/Stealth 9 Pocket/Black',
    imageFiles: [
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_pkg1.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_front.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_profile.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_spread.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_interior.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_pockets.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_zipper.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_logo.png',
      'STL-09-BLK_stealth-9-pocket-zip-binder-black_pkg2.png',
    ],
    metaTitle: 'Palms Off Gaming Stealth 9-Pocket Zip Binder | CardPop Australia',
    metaDescription:
      'The Stealth 9-pocket zip binder from Palms Off Gaming — a understated, blacked-out take on the nine-pocket zip binder with side-loading archival pockets. Seven colours.',
    intro:
      "The Stealth range is the Collector's Series with the volume turned down. Same nine-pocket layout, same side-loading pockets and zip closure, but finished so the binder reads as a plain object rather than a piece of collecting gear — which is the point when it is going in a backpack, sitting on a shelf, or being carried somewhere you would rather it did not announce what is inside.",
    highlights: [
      'Nine side-loading pockets per page — cards load from the spine edge, not the top',
      'Understated Stealth finish with minimal external branding',
      'Full-perimeter metal zip keeps the pages sealed in transit',
      'Acid-free, PVC-free archival pockets that will not haze or leach into card surfaces',
      'Sized for standard trading cards — Pokémon, One Piece, Magic, Yu-Gi-Oh and sports',
      'Available in seven colours',
    ],
    faqs: [
      {
        q: 'How does the Stealth binder differ from the Collector\'s Series?',
        a: 'The layout and the pocket construction are the same nine-pocket, side-loading build. Stealth is the quieter finish — less external branding and a flatter, more understated exterior.',
      },
      {
        q: 'Will sleeved cards fit?',
        a: 'Yes. The pockets take a standard-size card in a penny sleeve or perfect-fit sleeve. Double-sleeved cards fit but fill the binder faster.',
      },
      {
        q: 'Are the pockets archival safe?',
        a: 'Yes — acid-free and PVC-free, which is what matters for cards left in contact with a pocket for years rather than weeks.',
      },
    ],
  },
  {
    slug: 'palms-off-gaming-stealth-12-pocket-zip-binder',
    sku: 'STL-12',
    title: 'Palms Off Gaming Stealth 12-Pocket Zip Binder',
    shortTitle: 'Stealth 12-Pocket Zip Binder',
    range: 'Stealth',
    pocketsPerPage: 12,
    holds: 'raw cards',
    heroColour: 'Black',
    colours: colours('Black', 'Blue', 'Pink', 'Purple', 'Red', 'Turquoise', 'Yellow'),
    imageFolder: 'BINDERS/Stealth 12 pocket/Black STEALTH 12 - STL-12-BLK 3D Renders',
    imageFiles: [
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_pkg1.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_front.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_profile.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_spread.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_interior.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_pockets.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_zipper.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_logo.png',
      'STL-12-BLK_stealth-12-pocket-zip-binder-black_pkg2.png',
    ],
    metaTitle: 'Palms Off Gaming Stealth 12-Pocket Zip Binder | CardPop Australia',
    metaDescription:
      'The Stealth 12-pocket zip binder from Palms Off Gaming — maximum capacity in an understated finish, with side-loading archival pockets and a full metal zip. Seven colours.',
    intro:
      'Twelve pockets in the Stealth finish is the highest-capacity, lowest-profile binder Palms Off Gaming makes. It holds a third more per page than a nine-pocket binder and looks like nothing in particular from the outside — a useful combination for bulk storage, trade stock, or any collection that is better off not advertising itself.',
    highlights: [
      'Twelve side-loading pockets per page — the highest capacity layout in the Stealth range',
      'Understated Stealth finish with minimal external branding',
      'Full-perimeter metal zip keeps the pages sealed in transit',
      'Acid-free, PVC-free archival pockets that will not haze or leach into card surfaces',
      'Sized for standard trading cards — Pokémon, One Piece, Magic, Yu-Gi-Oh and sports',
      'Available in seven colours',
    ],
    faqs: [
      {
        q: 'Is a 12-pocket page harder to load than a 9-pocket one?',
        a: 'Slightly — there is less margin around each card, so cards need to be lined up more deliberately. In exchange each page holds a third more.',
      },
      {
        q: 'How does Stealth differ from the Collector\'s Series?',
        a: 'The pocket layout and side-loading construction are shared. Stealth is the understated finish, with less external branding.',
      },
      {
        q: 'What is this binder best used for?',
        a: 'Volume. Bulk rares, trade stock and sets being consolidated before storage all benefit from the extra pockets per page.',
      },
    ],
  },

  // ── Ring binder ───────────────────────────────────────────────────────────
  {
    slug: 'palms-off-gaming-collectors-series-ring-binder',
    sku: 'RB-BLK',
    title: "Palms Off Gaming Collector's Series Ring Binder",
    shortTitle: "Collector's Series Ring Binder",
    range: "Collector's Series",
    pocketsPerPage: null,
    holds: 'interchangeable pages',
    heroColour: 'Black',
    colours: colours('Black'),
    imageFolder: 'BINDERS/Ring Binder & Pages',
    imageFiles: [
      'RB-BLK_collectors-series-ring-binder-black_pkg.png',
      'RB-BLK_collectors-series-ring-binder-black_front.png',
      'RB-BLK_collectors-series-ring-binder-black_profile.png',
      'RB-BLK_collectors-series-ring-binder-black_open1.png',
      'RB-BLK_collectors-series-ring-binder-black_open2.png',
      'RB-BLK_collectors-series-ring-binder-black_empty.png',
    ],
    metaTitle: "Palms Off Gaming Collector's Series Ring Binder | CardPop Australia",
    metaDescription:
      "The Collector's Series ring binder from Palms Off Gaming — takes interchangeable pages, including PSA 4-slot graded card pages, so a collection can be re-ordered rather than re-filed.",
    intro:
      "Every zip binder in the Collector's Series has its pages bound in, which is what keeps them from tearing loose — but it also means the order is fixed. The ring binder is the answer when the collection needs to move around: pages come out, go back in a different order, and can be swapped for a different layout entirely as what you collect changes. It also takes PSA 4-slot pages, which is the only way to file graded cards in a binder rather than a box.",
    highlights: [
      'Takes interchangeable pages — re-order or re-layout a collection without re-filing every card',
      'Compatible with PSA 4-slot graded card pages',
      'Textured PU leather cover to match the rest of the Collector\'s Series',
      'The right choice when a collection is still changing shape',
      'Finished in black',
    ],
    faqs: [
      {
        q: 'Why choose a ring binder over a zip binder?',
        a: 'Flexibility. Pages come out and go back in any order, and you can mix layouts in one binder. A zip binder is more secure in transit but its pages and their order are fixed.',
      },
      {
        q: 'Can it hold graded cards?',
        a: 'Yes, with PSA 4-slot pages — that is the specific reason most people buy a ring binder rather than a zip binder. Standard card pages fit it too.',
      },
      {
        q: 'Do rings damage cards?',
        a: 'They can in a cheap binder, where the rings sit close to the page and press into the cards nearest the spine. Use pages sized for the binder and leave the innermost column for less valuable cards if you are storing long term.',
      },
      {
        q: 'Are pages included?',
        a: 'Check the product listing above — pages are sold separately from the binder unless the listing says otherwise.',
      },
    ],
  },
];

/** Spec rows shown in the product page's spec table. */
export const binderSpecs = (product) => [
  { label: 'Brand', value: 'Palms Off Gaming' },
  { label: 'Range', value: product.range },
  ...(product.pocketsPerPage
    ? [{ label: 'Pockets per page', value: String(product.pocketsPerPage) }]
    : []),
  { label: 'Holds', value: product.holds },
  // Pages + capacity come from utils/binderCapacity.js, the one source shared
  // with the capacity picker and the grid filter.
  ...(product.capacity
    ? [
      { label: 'Pages', value: product.capacity.pages },
      { label: 'Capacity', value: product.capacityText },
    ]
    : []),
  // Range-wide build rows, unless a binder's own verified spec overrides the
  // same label (e.g. TOP-09's velvet-lined inner cover).
  ...(product.range === "Collector's Series" && product.sku !== 'RB-BLK'
    ? collectorsSeriesBuild.filter((row) => !(product.specs || []).some((s) => s.label === row.label))
    : []),
  // Per-binder rows confirmed against a published listing for that exact binder.
  ...(product.specs || []),
  { label: 'Colours available', value: product.colours.map((c) => c.name).join(', ') },
  { label: 'SKU', value: product.sku },
];

/** Ordered, absolute image URLs for a product's gallery. */
export const binderImages = (product) =>
  (product.imageFiles || []).map((file) => binderImageUrl(`${product.imageFolder}/${file}`));

/** Alt text for the nth gallery image — descriptive, not "image 3". */
const VIEW_ALT = {
  front: 'front cover',
  profile: 'side profile showing the zip',
  spread: 'opened flat showing a full page spread',
  interior: 'inside cover and lining',
  pockets: 'close-up of the side-loading pockets',
  zipper: 'close-up of the metal zip pull',
  logo: 'embossed Palms Off Gaming logo',
  open1: 'opened showing the rings and pages',
  open2: 'opened from a second angle',
  empty: 'empty binder with no pages fitted',
  pkg: 'retail packaging',
  pkg1: 'retail packaging',
  pkg2: 'retail packaging, reverse',
  pkg3: 'retail packaging, detail',
};

export const binderImageAlt = (product, file) => {
  const view = String(file).replace(/^.*_([a-z0-9]+)\.png$/i, '$1');
  const detail = VIEW_ALT[view] || 'product photo';
  return `${product.title} in ${product.heroColour} — ${detail}`;
};

// Merge the researched long-form copy (details, verified spec rows) onto the
// rows above, keyed by SKU.
export const BINDER_PRODUCTS = BINDER_ROWS.map((product) => ({
  ...product,
  ...(BINDER_PRODUCT_COPY[product.sku] || {}),
  capacity: binderCapacity(product.sku),
  capacityText: binderCapacityText(product.sku),
}));

const BY_SKU = Object.fromEntries(BINDER_PRODUCTS.map((p) => [p.sku, p]));

/** Catalogue binder for a line SKU, or null. */
export const binderProductBySku = (sku) => BY_SKU[String(sku || '').toUpperCase()] || null;

const BY_SLUG = Object.fromEntries(BINDER_PRODUCTS.map((p) => [p.slug, p]));

/** Resolve a /shop/binders/:slug param onto a product, or null. */
export const resolveBinderProduct = (slug) =>
  (slug ? BY_SLUG[String(slug).toLowerCase()] : null) || null;

export const BINDER_SLUGS = BINDER_PRODUCTS.map((p) => p.slug);
