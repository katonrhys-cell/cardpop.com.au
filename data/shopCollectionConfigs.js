/**
 * Per-group configuration for the /shop/:groupSlug supply collection pages.
 *
 * Mirrors data/collectionConfigs.js (which drives the marketplace
 * /collections/:slug pages) but for the shop's accessory groups. Each entry is
 * assembled from three sources so nothing is duplicated:
 *   • utils/shopCategories.js  — the group's Icon, gradient and leaf items
 *   • data/shopCollectionSeo.js — the SEO title/description/intro copy (also
 *                                 imported by the serverless prerender/sitemap)
 *   • the VISUALS map below     — hero theme + accent colour
 *
 * ShopCollectionPage reads the merged config; the DB category matching uses the
 * group label + every leaf item name so the browse grid pulls the whole group.
 */
import { SHOP_CATEGORY_GROUPS } from '@/utils/shopCategories.js';
import { SHOP_COLLECTION_SEO } from '@/data/shopCollectionSeo.js';

// Hero theme + accent per group slug. Gradients are 3-stop so the hero reads
// richer than the flat 2-stop badge gradient used in the menus.
const VISUALS = {
  protection: {
    tagline: 'Keep Every Card Mint & Protected',
    heroGradient: 'from-blue-500 via-indigo-500 to-indigo-700',
    heroTextDark: false,
    accentHex: '#4F46E5',
  },
  storage: {
    tagline: 'Organise & Store Your Collection',
    heroGradient: 'from-amber-400 via-orange-400 to-orange-600',
    heroTextDark: false,
    accentHex: '#EA580C',
  },
  display: {
    tagline: 'Show Off Your Best Cards',
    heroGradient: 'from-violet-500 via-purple-500 to-purple-700',
    heroTextDark: false,
    accentHex: '#9333EA',
  },
  shipping: {
    tagline: 'Post Cards Safely, Every Time',
    heroGradient: 'from-emerald-500 via-teal-500 to-teal-700',
    heroTextDark: false,
    accentHex: '#0D9488',
  },
  grading: {
    tagline: 'Get Your Cards Submission-Ready',
    heroGradient: 'from-rose-500 via-pink-500 to-pink-700',
    heroTextDark: false,
    accentHex: '#DB2777',
  },
};

// Assemble one config per group, keyed by slug.
export const SHOP_COLLECTION_CONFIGS = Object.fromEntries(
  SHOP_CATEGORY_GROUPS.map((group) => {
    const seo = SHOP_COLLECTION_SEO[group.slug] || {};
    const visuals = VISUALS[group.slug] || {};
    return [group.slug, {
      slug: group.slug,
      label: group.label,
      name: seo.name || group.label,
      Icon: group.Icon,
      gradient: group.gradient,
      blurb: group.blurb,
      items: group.items,
      seoTitle: seo.title,
      seoDescription: seo.description,
      seoIntro: seo.intro,
      ...visuals,
    }];
  })
);

// Resolve a /shop/:groupSlug param (or a friendly alias) onto a config, or null.
const ALIASES = { 'grading-supplies': 'grading', protect: 'protection' };
export const resolveShopCollection = (rawSlug) => {
  if (!rawSlug) return null;
  const s = String(rawSlug).toLowerCase();
  if (SHOP_COLLECTION_CONFIGS[s]) return SHOP_COLLECTION_CONFIGS[s];
  if (ALIASES[s] && SHOP_COLLECTION_CONFIGS[ALIASES[s]]) return SHOP_COLLECTION_CONFIGS[ALIASES[s]];
  return null;
};
