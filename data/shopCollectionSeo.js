// Pure-data SEO copy for the /shop/:groupSlug supply collection pages
// (Protection, Storage, Display, Shipping, Grading).
//
// This is the single source of truth for the SEO strings — the frontend config
// (data/shopCollectionConfigs.js) imports it and layers the hero visuals on top,
// and the Vercel serverless functions (api/prerender.js, api/sitemap.js) import
// it directly. Keeping it JSX-free means the server never has to pull in the
// icon components, and there's no title/description/intro to keep in sync across
// two files (unlike the older collectionConfigs/collectionSeo split).
//
// `subs` mirrors the leaf categories in utils/shopCategories.js so the
// prerendered HTML can emit real internal links to each /shop/category/<slug>
// page. If you add or rename a leaf category there, mirror it here.

export const SHOP_COLLECTION_SEO = {
  protection: {
    slug: 'protection',
    name: 'Card Protection',
    group: 'Protection',
    title: 'Card Protection Supplies Australia — Sleeves, Toploaders & Holders | CardPop',
    description:
      'Shop trading card protection supplies in Australia — penny sleeves, premium matte sleeves, perfect fit sleeves, top loaders, magnetic one-touch holders, semi-rigid card savers and graded slab protectors. Fast tracked shipping, priced in AUD.',
    intro:
      'Protecting your cards is the first rule of the hobby, and it starts the moment a card leaves the pack. CardPop stocks the full protection chain trusted by Australian collectors — soft penny sleeves for everyday bulk, matte and gloss premium sleeves for decks, perfect-fit inners for double-sleeving, rigid top loaders, one-touch magnetic holders sized by point thickness, semi-rigid card savers ready for grading submission, and protective sleeves for PSA, BGS and CGC slabs. Whether you\'re safeguarding a chase alt-art or shipping a graded slab, the right sleeve or holder keeps corners sharp and surfaces flawless. Every order ships fast and tracked from within Australia, priced in AUD.',
    subs: [
      { name: 'Penny Sleeves', slug: 'penny-sleeves' },
      { name: 'Premium Sleeves', slug: 'premium-sleeves' },
      { name: 'Perfect Fit Sleeves', slug: 'perfect-fit-sleeves' },
      { name: 'Top Loaders', slug: 'top-loaders' },
      { name: 'Magnetic Holders', slug: 'magnetic-holders' },
      { name: 'Card Savers', slug: 'card-savers' },
      { name: 'Graded Card Protectors', slug: 'graded-card-protectors' },
    ],
  },
  storage: {
    slug: 'storage',
    name: 'Card Storage',
    group: 'Storage',
    title: 'Card Storage Supplies Australia — Boxes, Binders & Pages | CardPop',
    description:
      'Shop trading card storage in Australia — bulk storage boxes, zip and premium collector binders, 9-pocket and specialty pages, and tabbed dividers. Fast tracked shipping, priced in AUD.',
    intro:
      'A growing collection needs somewhere safe and organised to live. CardPop\'s storage range covers everything from cardboard and plastic bulk boxes for your commons and duplicates, to zip-up and premium collector binders that show off your set builds, side-loading 9-pocket and specialty pages, and tabbed dividers to keep long boxes searchable. Good storage protects value as much as it protects cards — no bent corners, no fading, no lost singles. Shop trusted brands with fast, tracked Australian shipping, all priced in AUD.',
    subs: [
      { name: 'Storage Boxes', slug: 'storage-boxes' },
      { name: 'Binders', slug: 'binders' },
      { name: 'Pages', slug: 'pages' },
      { name: 'Dividers', slug: 'dividers' },
      { name: 'Deck Boxes', slug: 'deck-boxes' },
      { name: 'Graded Card Cases', slug: 'graded-card-cases' },
    ],
  },
  display: {
    slug: 'display',
    name: 'Card Display',
    group: 'Display',
    title: 'Card Display Supplies Australia — Stands, Cases & Frames | CardPop',
    description:
      'Shop trading card display supplies in Australia — acrylic card stands, UV display cases, wall mounts and floating frames for raw and graded cards. Fast tracked shipping, priced in AUD.',
    intro:
      'The best cards deserve to be seen. CardPop\'s display range helps you show off your grails at home, at the desk, or on the shop counter — desktop acrylic stands for raw and graded cards, UV-filtering display cases and slab holders, wall-mounted holders, and frameless floating frames that make a card look like it\'s floating on the wall. Display pieces are built to protect while they present, keeping cards safe from dust and UV. Every item ships fast and tracked across Australia, priced in AUD.',
    subs: [
      { name: 'Acrylic Stands', slug: 'acrylic-stands' },
      { name: 'Display Cases', slug: 'display-cases' },
      { name: 'Wall Mounts', slug: 'wall-mounts' },
      { name: 'Floating Frames', slug: 'floating-frames' },
      { name: 'Playmats', slug: 'playmats' },
    ],
  },
  shipping: {
    slug: 'shipping',
    name: 'Card Shipping',
    group: 'Shipping',
    title: 'Card Shipping Supplies Australia — Mailers, Team Bags & Tape | CardPop',
    description:
      'Shop trading card shipping supplies in Australia — team bags, padded bubble mailers, rigid cardboard mailers, packing tape, tag sleeves and tamper seals. Post cards safely with tracked AUD shipping.',
    intro:
      'Selling and trading means posting, and posting means packing cards so they arrive exactly as they left. CardPop stocks the essentials for safe, professional shipping — resealable team bags for sleeved cards, padded bubble mailers in every size, rigid cardboard mailers built for graded slabs, clear packing tape, and tamper-evident seals. Ship like a pro, avoid damaged-in-transit disputes, and keep your feedback spotless. All supplies ship fast and tracked from within Australia, priced in AUD.',
    subs: [
      { name: 'Team Bags', slug: 'team-bags' },
      { name: 'Bubble Mailers', slug: 'bubble-mailers' },
      { name: 'Cardboard Mailers', slug: 'cardboard-mailers' },
      { name: 'Packing Tape', slug: 'packing-tape' },
      { name: 'Tag Sleeves', slug: 'tag-sleeves' },
      { name: 'Tamper Seals', slug: 'tamper-seals' },
    ],
  },
  grading: {
    slug: 'grading',
    name: 'Card Grading',
    group: 'Grading',
    title: 'Card Grading Supplies Australia — Submission Kits & Prep Tools | CardPop',
    description:
      'Shop trading card grading supplies in Australia — submission kits, anti-static cleaning cloths, handling gloves, microfiber cloths and centering tools. Get cards submission-ready with tracked AUD shipping.',
    intro:
      'Getting a card submission-ready is where grades are won and lost. CardPop\'s grading range gives you everything the prep bench needs — complete CardPop submission kits, anti-static cleaning cloths for safe surface prep, cotton and nitrile handling gloves to keep fingerprints off, lint-free microfiber polishing cloths, and centering gauges to check a card before you pay to grade it. Prep with care and give every submission its best shot at that PSA 10. All grading supplies ship fast and tracked across Australia, priced in AUD.',
    subs: [
      { name: 'Submission Kits', slug: 'submission-kits' },
      { name: 'Cleaning Cloths', slug: 'cleaning-cloths' },
      { name: 'Gloves', slug: 'gloves' },
      { name: 'Microfiber Cloths', slug: 'microfiber-cloths' },
      { name: 'Centering Tools', slug: 'centering-tools' },
    ],
  },
};

// Mirror of resolveCollectionSlug — maps a URL slug (or a friendly alias like
// "grading") onto the canonical shop-collection group slug. Kept dependency-free
// so both the SPA and the serverless prerender can share it.
const SHOP_COLLECTION_ALIASES = {
  'grading-supplies': 'grading',
  'grading-gear': 'grading',
  protect: 'protection',
};

export const resolveShopCollectionSlug = (rawSlug) => {
  if (!rawSlug) return null;
  const s = String(rawSlug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (SHOP_COLLECTION_SEO[s]) return s;
  if (SHOP_COLLECTION_ALIASES[s]) return SHOP_COLLECTION_ALIASES[s];
  return null;
};

export const SHOP_COLLECTION_SLUGS = Object.keys(SHOP_COLLECTION_SEO);
