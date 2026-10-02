// Single source of truth for the shop's accessory categories (the "Shop"
// mega-dropdown, the /shop landing tiles, the /shop/category/<slug> pages and
// the admin product form's category picker all read from here, so the menu, the
// pages and the editable data never drift apart).
//
// Each leaf `name` is exactly what gets stored in shop_products.category, so the
// category pages match products with a simple ILIKE on that name. Admins can
// also add/remove leaf categories without a deploy (Admin → Products →
// Categories): those live in the shop_categories table and are merged over this
// list by mergeShopCategoryGroups() below — components read the merged list via
// hooks/useShopCategoryGroups.js.
import {
  Frame,
  Layers, Sparkles, Layers2, CreditCard, Magnet, ShieldCheck,
  Box, BookMarked, Files, SeparatorHorizontal,
  PanelTop, Package2, Image,
  ShoppingBag, Mail, PackageOpen, Scissors,
  PackageCheck, Eraser, Hand, Sparkle, Ruler,
  Grid2x2, Tag, ShieldAlert, Boxes,
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
      { name: 'Deck Boxes',    slug: 'deck-boxes',    Icon: Boxes,               desc: 'Cases for sleeved, playable decks' },
      { name: 'Graded Card Cases', slug: 'graded-card-cases', Icon: PackageCheck, desc: 'Hard carry cases sized for graded slabs' },
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
      { name: 'Playmats',        slug: 'playmats',        Icon: Grid2x2, desc: 'Rubber-backed mats for play and photography' },
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
      { name: 'Tag Sleeves',            slug: 'tag-sleeves',            Icon: Tag,         desc: 'Sleeves for pricing and inventory tags' },
      { name: 'Tamper Seals',           slug: 'tamper-seals',           Icon: ShieldAlert, desc: 'Serialised tamper-evident seals' },
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
// Keeps the leaf's own icon under `LeafIcon` before `Icon` is overwritten with
// the parent group's, so consumers that want the specific category icon (e.g.
// the category page hero) can still reach it.
export const SHOP_CATEGORIES = flattenShopCategoryGroups(SHOP_CATEGORY_GROUPS);

// Resolve a /shop/category/<slug> param to its leaf category (or null).
export const findShopCategory = (slug) =>
  SHOP_CATEGORIES.find((c) => c.slug === slug) || null;

// ---------------------------------------------------------------------------
// Admin-editable overlay (shop_categories table, Admin → Products →
// Categories). Rows either add a leaf under an existing group or hide one by
// name. Pure so it's testable; hooks/useShopCategoryGroups.js feeds it the rows.

// Same rules as utils/shopProductUrl.js slugify, so a custom category's page
// slug matches the /shop/<category-slug>/… product URLs built from its name.
const slugifyName = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const nameKey = (name) => String(name || '').trim().toLowerCase();

/**
 * Apply shop_categories rows to the built-in groups.
 *
 * @param {object[]} groups  SHOP_CATEGORY_GROUPS (or a test fixture)
 * @param {object[]} rows    { id, section_slug, name, description, hidden }
 * @returns groups with hidden leaves dropped and custom leaves appended; each
 *          custom leaf is flagged `custom: true` and carries its row `id`.
 */
export function mergeShopCategoryGroups(groups, rows = []) {
  const hidden = new Set((rows || []).filter((r) => r.hidden).map((r) => nameKey(r.name)));
  const additions = (rows || []).filter((r) => !r.hidden && nameKey(r.name));
  return groups.map((group) => {
    const items = group.items.filter((item) => !hidden.has(nameKey(item.name)));
    const taken = new Set(items.map((item) => nameKey(item.name)));
    for (const row of additions) {
      if (row.section_slug !== group.slug || taken.has(nameKey(row.name))) continue;
      taken.add(nameKey(row.name));
      const name = String(row.name).trim();
      items.push({ id: row.id, name, slug: slugifyName(name), Icon: Tag, desc: row.description || '', custom: true });
    }
    return { ...group, items };
  });
}

/** Flatten (merged) groups into leaves the same way SHOP_CATEGORIES is built. */
export function flattenShopCategoryGroups(groups) {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      group: group.label,
      groupSlug: group.slug,
      gradient: group.gradient,
      blurb: group.blurb,
      LeafIcon: item.Icon,
      Icon: group.Icon,
    })));
}
