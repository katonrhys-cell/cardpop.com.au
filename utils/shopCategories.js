// Single source of truth for the shop's accessory categories (the "Shop"
// mega-dropdown, the /shop landing tiles, the /shop/category/<slug> pages and
// the admin product form's category picker all read from here, so the menu, the
// pages and the editable data never drift apart).
//
// Each leaf `name` is exactly what gets stored in shop_products.category, so the
// category pages match products with a simple ILIKE on that name. Adding a new
// category is a one-line edit here — the menu, page and admin picker pick it up
// automatically.
import { Shield, Archive, Frame, Truck, Award } from 'lucide-react';

export const SHOP_CATEGORY_GROUPS = [
  {
    label: 'Protection',
    slug: 'protection',
    Icon: Shield,
    gradient: 'from-blue-500 to-indigo-600',
    blurb: 'Sleeves, holders and loaders that keep every card safe.',
    items: [
      { name: 'Penny Sleeves',       slug: 'penny-sleeves',       desc: 'Soft inner sleeves for everyday storage' },
      { name: 'Premium Sleeves',     slug: 'premium-sleeves',     desc: 'Matte and gloss deck-style sleeves' },
      { name: 'Perfect Fit Sleeves', slug: 'perfect-fit-sleeves', desc: 'Snug inner sleeves for double-sleeving' },
      { name: 'Top Loaders',         slug: 'top-loaders',         desc: 'Rigid PVC loaders in bulk packs' },
      { name: 'Magnetic Holders',    slug: 'magnetic-holders',    desc: 'One-touch magnetic cases by point size' },
      { name: 'Card Savers',         slug: 'card-savers',         desc: 'Semi-rigid holders for grading submission' },
    ],
  },
  {
    label: 'Storage',
    slug: 'storage',
    Icon: Archive,
    gradient: 'from-amber-500 to-orange-500',
    blurb: 'Boxes, binders and pages to organise a growing collection.',
    items: [
      { name: 'Storage Boxes', slug: 'storage-boxes', desc: 'Cardboard and plastic bulk card boxes' },
      { name: 'Binders',       slug: 'binders',       desc: 'Zip and premium collector binders' },
      { name: 'Pages',         slug: 'pages',         desc: '9-pocket and specialty binder pages' },
      { name: 'Dividers',      slug: 'dividers',      desc: 'Tabbed dividers for sorting boxes' },
    ],
  },
  {
    label: 'Display',
    slug: 'display',
    Icon: Frame,
    gradient: 'from-violet-500 to-purple-600',
    blurb: 'Show off your best cards at home or at the shop.',
    items: [
      { name: 'Acrylic Stands', slug: 'acrylic-stands', desc: 'Desktop stands for raw and graded cards' },
      { name: 'Display Cases',  slug: 'display-cases',  desc: 'UV acrylic cases and slab displays' },
      { name: 'Wall Mounts',    slug: 'wall-mounts',    desc: 'Wall-mounted card display holders' },
      { name: 'Floating Frames', slug: 'floating-frames', desc: 'Frameless floating card frames' },
    ],
  },
  {
    label: 'Shipping',
    slug: 'shipping',
    Icon: Truck,
    gradient: 'from-emerald-500 to-teal-600',
    blurb: 'Everything you need to post cards safely.',
    items: [
      { name: 'Team Bags',              slug: 'team-bags',              desc: 'Resealable outer bags for sleeved cards' },
      { name: 'Bubble Mailers',         slug: 'bubble-mailers',         desc: 'Padded mailers in assorted sizes' },
      { name: 'Cardboard Mailers',      slug: 'cardboard-mailers',      desc: 'Rigid mailers for graded slabs' },
      { name: 'Packing Tape',           slug: 'packing-tape',           desc: 'Clear tape for secure packaging' },
      { name: 'Graded Card Protectors', slug: 'graded-card-protectors', desc: 'Protective sleeves for graded slabs' },
    ],
  },
  {
    label: 'Grading',
    slug: 'grading-supplies',
    Icon: Award,
    gradient: 'from-rose-500 to-pink-600',
    blurb: 'Prep kits and tools to get cards submission-ready.',
    items: [
      { name: 'Submission Kits',  slug: 'submission-kits',  desc: 'Complete CardPop grading prep kits' },
      { name: 'Cleaning Cloths',  slug: 'cleaning-cloths',  desc: 'Anti-static cloths for surface prep' },
      { name: 'Gloves',           slug: 'gloves',           desc: 'Cotton and nitrile handling gloves' },
      { name: 'Microfiber Cloths', slug: 'microfiber-cloths', desc: 'Lint-free microfiber polishing cloths' },
      { name: 'Centering Tools',  slug: 'centering-tools',  desc: 'Gauges and tools to measure centering' },
    ],
  },
];

// Flat list of every leaf category, each tagged with its parent group.
export const SHOP_CATEGORIES = SHOP_CATEGORY_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    group: group.label,
    groupSlug: group.slug,
    gradient: group.gradient,
    Icon: group.Icon,
  }))
);

// Resolve a /shop/category/<slug> param to its leaf category (or null).
export const findShopCategory = (slug) =>
  SHOP_CATEGORIES.find((c) => c.slug === slug) || null;
