// Single source of truth for the shop's accessory categories (the "Shop"
// mega-dropdown, the /shop landing tiles, the /shop/category/<slug> pages and
// the admin product form's category picker all read from here, so the menu, the
// pages and the editable data never drift apart).
//
// Each leaf `name` is exactly what gets stored in shop_products.category, so the
// category pages match products with a simple ILIKE on that name. Adding a new
// category is a one-line edit here — the menu, page and admin picker pick it up
// automatically.
import {
  Frame,
  Layers, Sparkles, Layers2, CreditCard, Magnet, ShieldCheck,
  Box, BookMarked, Files, SeparatorHorizontal,
  PanelTop, Package2, Image,
  ShoppingBag, Mail, PackageOpen, Scissors,
  PackageCheck, Eraser, Hand, Sparkle, Ruler,
} from 'lucide-react';
// Purpose-built, card-themed category glyphs — drawn to match the marketplace
// (Browse Collections) icons so the two menus read as one family instead of the
// generic lucide Shield/Frame/Truck the parent groups used to show.
import {
  CardShieldIcon, CardStorageBoxIcon, CardStandIcon, ShippingParcelIcon, GradedSlabIcon,
} from '@/components/CategoryIcons.jsx';

// Each leaf item carries its own `Icon` so the "Shop" mega-menu can show a
// coloured badge beside every entry (matching the "Browse Collections" menu),
// while the badge colour stays the parent group's gradient.
//
// `blurb` is the full sentence the /shop landing and collection pages show;
// `navDesc` is the trimmed one-liner the Shop mega-menu puts under each parent
// category, so the menu reads like every other dropdown (label + short
// narrative) without wrapping onto a second line.
export const SHOP_CATEGORY_GROUPS = [
  {
    label: 'Protection',
    slug: 'protection',
    Icon: CardShieldIcon,
    gradient: 'from-blue-500 to-indigo-600',
    blurb: 'Sleeves, holders and loaders that keep every card safe.',
    navDesc: 'Sleeves, holders and loaders',
    items: [
      { name: 'Penny Sleeves',       slug: 'penny-sleeves',       Icon: Layers,      desc: 'Soft inner sleeves for everyday storage' },
      { name: 'Premium Sleeves',     slug: 'premium-sleeves',     Icon: Sparkles,    desc: 'Matte and gloss deck-style sleeves' },
      { name: 'Perfect Fit Sleeves', slug: 'perfect-fit-sleeves', Icon: Layers2,     desc: 'Snug inner sleeves for double-sleeving' },
      { name: 'Top Loaders',         slug: 'top-loaders',         Icon: CreditCard,  desc: 'Rigid PVC loaders in bulk packs' },
      { name: 'Magnetic Holders',    slug: 'magnetic-holders',    Icon: Magnet,      desc: 'One-touch magnetic cases by point size' },
      { name: 'Card Savers',         slug: 'card-savers',         Icon: ShieldCheck, desc: 'Semi-rigid holders for grading submission' },
    ],
  },
  {
    label: 'Storage',
    slug: 'storage',
    Icon: CardStorageBoxIcon,
    gradient: 'from-amber-500 to-orange-500',
    blurb: 'Boxes, binders and pages to organise a growing collection.',
    navDesc: 'Boxes, binders and pages',
    items: [
      { name: 'Storage Boxes', slug: 'storage-boxes', Icon: Box,                 desc: 'Cardboard and plastic bulk card boxes' },
      { name: 'Binders',       slug: 'binders',       Icon: BookMarked,          desc: 'Zip and premium collector binders' },
      { name: 'Pages',         slug: 'pages',         Icon: Files,               desc: '9-pocket and specialty binder pages' },
      { name: 'Dividers',      slug: 'dividers',      Icon: SeparatorHorizontal, desc: 'Tabbed dividers for sorting boxes' },
    ],
  },
  {
    label: 'Display',
    slug: 'display',
    Icon: CardStandIcon,
    gradient: 'from-violet-500 to-purple-600',
    blurb: 'Show off your best cards at home or at the shop.',
    navDesc: 'Stands, cases and frames',
    items: [
      { name: 'Acrylic Stands', slug: 'acrylic-stands', Icon: PanelTop, desc: 'Desktop stands for raw and graded cards' },
      { name: 'Display Cases',  slug: 'display-cases',  Icon: Package2, desc: 'UV acrylic cases and slab displays' },
      { name: 'Wall Mounts',    slug: 'wall-mounts',    Icon: Frame,    desc: 'Wall-mounted card display holders' },
      { name: 'Floating Frames', slug: 'floating-frames', Icon: Image,  desc: 'Frameless floating card frames' },
    ],
  },
  {
    label: 'Shipping',
    slug: 'shipping',
    Icon: ShippingParcelIcon,
    gradient: 'from-emerald-500 to-teal-600',
    blurb: 'Everything you need to post cards safely.',
    navDesc: 'Mailers, bags and tape',
    items: [
      { name: 'Team Bags',              slug: 'team-bags',              Icon: ShoppingBag, desc: 'Resealable outer bags for sleeved cards' },
      { name: 'Bubble Mailers',         slug: 'bubble-mailers',         Icon: Mail,        desc: 'Padded mailers in assorted sizes' },
      { name: 'Cardboard Mailers',      slug: 'cardboard-mailers',      Icon: PackageOpen, desc: 'Rigid mailers for graded slabs' },
      { name: 'Packing Tape',           slug: 'packing-tape',           Icon: Scissors,    desc: 'Clear tape for secure packaging' },
      { name: 'Graded Card Protectors', slug: 'graded-card-protectors', Icon: ShieldCheck, desc: 'Protective sleeves for graded slabs' },
    ],
  },
  {
    label: 'Grading',
    slug: 'grading',
    Icon: GradedSlabIcon,
    gradient: 'from-rose-500 to-pink-600',
    blurb: 'Prep kits and tools to get cards submission-ready.',
    navDesc: 'Prep kits and cleaning tools',
    items: [
      { name: 'Submission Kits',  slug: 'submission-kits',  Icon: PackageCheck, desc: 'Complete CardPop grading prep kits' },
      { name: 'Cleaning Cloths',  slug: 'cleaning-cloths',  Icon: Eraser,       desc: 'Anti-static cloths for surface prep' },
      { name: 'Gloves',           slug: 'gloves',           Icon: Hand,         desc: 'Cotton and nitrile handling gloves' },
      { name: 'Microfiber Cloths', slug: 'microfiber-cloths', Icon: Sparkle,    desc: 'Lint-free microfiber polishing cloths' },
      { name: 'Centering Tools',  slug: 'centering-tools',  Icon: Ruler,        desc: 'Gauges and tools to measure centering' },
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
    blurb: group.blurb,
    // Keep the leaf's own icon (the ...item spread sets it as `Icon`) available
    // under `LeafIcon` before we overwrite `Icon` with the parent group's icon,
    // so consumers that want the specific category icon (e.g. the category page
    // hero) can still reach it while the shared `Icon` stays the group icon.
    LeafIcon: item.Icon,
    Icon: group.Icon,
  }))
);

// Resolve a /shop/category/<slug> param to its leaf category (or null).
export const findShopCategory = (slug) =>
  SHOP_CATEGORIES.find((c) => c.slug === slug) || null;
