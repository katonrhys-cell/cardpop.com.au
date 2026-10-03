import { createClient } from '@supabase/supabase-js';
import { COLLECTION_SEO } from '../data/collectionSeo.js';
import { SHOP_COLLECTION_SEO } from '../data/shopCollectionSeo.js';
import { BLOG_CATEGORIES } from '../data/blogCategories.js';
import { BUYING_GUIDES } from '../data/buyingGuides.js';
import { PAID_TIERS } from '../config/plans.js';
import { BINDER_SLUGS } from '../data/shopBinderProducts.js';
import { PALMS_OFF_PRODUCTS } from '../data/palmsOffCatalogue.js';
import { shopProductBasePath, legacyShopProductPath } from '../utils/shopProductUrl.js';
import { PUBLIC_SHOP_STATUSES } from '../utils/shopStock.js';
import { shopCategoryLeaves, productInShopCategory } from '../utils/shopCategoryPages.js';

const SUPABASE_URL = 'https://vrfsaazuqjxotnieqlkd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lHlLkeTfwzhWQ80Zz6pL6g_jc7Y8p33';

const BASE_URL = 'https://cardpop.com.au';
const TODAY = new Date().toISOString().split('T')[0];
// Keep recently-finished events in the sitemap for a short window. Their pages
// still pull search traffic (recaps, "was there a card show in <city>") for a
// few weeks after the date, so dropping them the instant they end wastes the
// indexing work. Older events fall out to avoid a growing pile of stale URLs.
const EVENTS_SINCE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];
// Stable <lastmod> for structural/static pages. Stamping TODAY on every request
// (even when nothing changed) trains crawlers to distrust the sitemap's dates,
// which hurts recrawl scheduling. Bump this only when the static pages actually
// change; DB-driven URLs below keep their real updated_at timestamps.
const SITE_UPDATED = '2026-10-02';

// Sitemap <loc> values must be XML-escaped. Slugs come straight from the DB, so
// a stray & (or < >) in one slug would otherwise produce invalid XML and make
// Google reject the whole sitemap ("Sitemap could not be read").
const xmlEscape = (str = '') => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const xmlUrl = (loc, lastmod, changefreq, priority) =>
  `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

// PostgREST caps a single response (1,000 rows on Supabase by default), so a
// bare .limit(5000) would quietly stop at 1,000. Page through with .range()
// instead, up to `max` rows. `build` returns a fresh query each call, and every
// paged query orders on a unique tiebreaker so pages can't overlap or skip.
// No new page starts within PAGE_RESERVE_MS of `deadline`: a big table is
// trimmed to the pages that fit rather than losing the whole section.
const PAGE_SIZE = 1000;
const PAGE_RESERVE_MS = 1500;
async function fetchPaged(build, max, deadline = Infinity) {
  const data = [];
  for (let from = 0; from < max; from += PAGE_SIZE) {
    if (from > 0 && Date.now() > deadline - PAGE_RESERVE_MS) break;
    const size = Math.min(PAGE_SIZE, max - from);
    const { data: page, error } = await build().range(from, from + size - 1);
    if (error) {
      // Keep what earlier pages returned; only a first-page failure fails the
      // section (and Promise.allSettled confines that to this section).
      if (data.length > 0) break;
      throw error;
    }
    data.push(...(page || []));
    if (!page || page.length < size) break;
  }
  return { data };
}

// Per-section ceilings. A sitemap file may hold 50,000 URLs; these sum to well
// under that. Raise them (or split into a sitemap index) as the site grows.
const MAX_ROWS = {
  articles: 2000,
  listings: 10000,
  dealers: 2000,
  products: 3000,
  events: 2000,
  trackedCards: 5000,
  stores: 3000,
  sellerProfiles: 10000,
};

const STATIC_PAGES = [
  { loc: '/',                      lastmod: SITE_UPDATED,       freq: 'daily',   pri: '1.0' },
  { loc: '/marketplace',           lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.9' },
  // /search is intentionally excluded — internal search-results pages offer no
  // unique indexable content and are disallowed in robots.txt.
  { loc: '/shop',                  lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.9' },
  { loc: '/shop/sealed-boxes',     lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/shop/singles',          lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  // Shop supply collection pages (Protection, Storage, Display, Shipping,
  // Grading) — config-driven, one per group in data/shopCollectionSeo.js.
  ...Object.keys(SHOP_COLLECTION_SEO).map((slug) => (
    { loc: `/shop/${slug}`,        lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.8' }
  )),
  // Palms Off Gaming binders: the brand hub plus one page per product. These
  // are static, config-driven URLs (data/shopBinderProducts.js), not DB rows,
  // so they belong here rather than in the shop_products block below.
  { loc: '/shop/binders',          lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.8' },
  ...BINDER_SLUGS.map((slug) => (
    { loc: `/shop/binders/${slug}`, lastmod: SITE_UPDATED,      freq: 'weekly',  pri: '0.7' }
  )),
  // Palms Off Gaming product pages, one per line, inside the normal
  // product-type taxonomy. Config-driven (data/palmsOffCatalogue.js), not DB
  // rows, so they belong here rather than in the shop_products block below.
  ...PALMS_OFF_PRODUCTS.map((p) => (
    { loc: `/shop/${p.categorySlug}/${p.slug}`, lastmod: SITE_UPDATED, freq: 'weekly', pri: '0.7' }
  )),
  { loc: '/analytics',             lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/scan',                  lastmod: SITE_UPDATED,       freq: 'monthly', pri: '0.8' },
  // /prices pages legitimately change every day (fresh price snapshots), so
  // TODAY is an honest lastmod here, unlike the structural pages above.
  { loc: '/prices',                lastmod: TODAY,              freq: 'daily',   pri: '0.9' },
  { loc: '/prices/pokemon',        lastmod: TODAY,              freq: 'daily',   pri: '0.8' },
  { loc: '/prices/basketball',     lastmod: TODAY,              freq: 'daily',   pri: '0.8' },
  { loc: '/prices/one-piece',      lastmod: TODAY,              freq: 'daily',   pri: '0.8' },
  { loc: '/prices/afl',            lastmod: TODAY,              freq: 'daily',   pri: '0.8' },
  { loc: '/prices/nrl',            lastmod: TODAY,              freq: 'daily',   pri: '0.8' },
  { loc: '/analytics/buying-guides', lastmod: SITE_UPDATED,     freq: 'weekly',  pri: '0.7' },
  { loc: '/australian-markets',    lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/insider-trading',       lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.7' },
  { loc: '/grading',               lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.8' },
  { loc: '/grading/what-is-grading', lastmod: SITE_UPDATED,    freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/scales',        lastmod: SITE_UPDATED,       freq: 'monthly',  pri: '0.7' },
  // Per-company grading scale pages (COMPANY_DATA in GradingScalePage.jsx).
  // /grading/guide/:scale is an alias of the same page — only the canonical
  // /grading/scales/:scale URLs are advertised.
  ...['psa', 'bgs', 'cgc', 'ace'].map((scale) => (
    { loc: `/grading/scales/${scale}`, lastmod: SITE_UPDATED,   freq: 'monthly',  pri: '0.6' }
  )),
  { loc: '/grading/companies',     lastmod: SITE_UPDATED,       freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/local-graders', lastmod: SITE_UPDATED,       freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/submission-partners', lastmod: SITE_UPDATED, freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/estimator',     lastmod: SITE_UPDATED,       freq: 'weekly',   pri: '0.8' },
  { loc: '/grading/roi-calculator', lastmod: SITE_UPDATED,      freq: 'weekly',   pri: '0.8' },
  { loc: '/community',             lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.7' },
  { loc: '/events',                lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/events/card-shows',     lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/events/trade-events',   lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/events/community-events', lastmod: SITE_UPDATED,     freq: 'daily',   pri: '0.8' },
  { loc: '/events/store-events',   lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/community/local-traders', lastmod: SITE_UPDATED,     freq: 'daily',   pri: '0.7' },
  { loc: '/community/whatnot',     lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.5' },
  { loc: '/community/building-your-business', lastmod: SITE_UPDATED, freq: 'monthly', pri: '0.6' },
  { loc: '/community/forum',       lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.6' },
  { loc: '/community/leaderboard', lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.5' },
  { loc: '/community/profiles',    lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.5' },
  { loc: '/community/map',         lastmod: SITE_UPDATED,       freq: 'monthly', pri: '0.5' },
  { loc: '/blog',                  lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.8' },
  // Blog category hubs — prerendered for bots and linked from the site header.
  ...BLOG_CATEGORIES.map((c) => (
    { loc: `/blog/category/${c.slug}`, lastmod: SITE_UPDATED,   freq: 'weekly',  pri: '0.6' }
  )),
  // New-release buying guides (Analytics section). Each guide's own `updated`
  // date is an honest lastmod — refreshing a guide's chase figures bumps it.
  ...BUYING_GUIDES.map((g) => (
    { loc: `/analytics/buying-guides/${g.slug}`, lastmod: g.updated || SITE_UPDATED, freq: 'weekly', pri: '0.6' }
  )),
  { loc: '/launch',                lastmod: '2026-07-05', freq: 'monthly', pri: '0.6' },
  { loc: '/about',                 lastmod: '2026-05-31', freq: 'monthly', pri: '0.6' },
  { loc: '/partners',              lastmod: SITE_UPDATED, freq: 'monthly', pri: '0.6' },
  { loc: '/pricing',               lastmod: SITE_UPDATED, freq: 'monthly', pri: '0.6' },
  { loc: '/photography-standard',  lastmod: SITE_UPDATED, freq: 'monthly', pri: '0.5' },
  { loc: '/contact',               lastmod: '2026-05-31', freq: 'monthly', pri: '0.6' },
  { loc: '/faq',                   lastmod: '2026-05-31', freq: 'monthly', pri: '0.6' },
  { loc: '/conviction-rating',     lastmod: '2026-07-12', freq: 'monthly', pri: '0.5' },
  { loc: '/privacy-policy',        lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/terms',                 lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/returns',               lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/shipping',              lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/trust-safety',          lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/safe-buying',           lastmod: '2026-07-15', freq: 'monthly', pri: '0.7' },
  { loc: '/accessibility',         lastmod: '2026-05-31', freq: 'yearly',  pri: '0.3' },
  // Collection landing pages (config-driven, one per TCG/sport in
  // data/collectionSeo.js) — evergreen category pages worth indexing.
  { loc: '/collections',           lastmod: SITE_UPDATED,       freq: 'weekly',  pri: '0.8' },
  ...Object.keys(COLLECTION_SEO).map((slug) => (
    { loc: `/collections/${slug}`, lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' }
  )),
];


export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    // The Vercel function is capped at 10s (see vercel.json). If Supabase is
    // slow the function would otherwise 504, which Google reports as a
    // "temporary processing error". Each section races its own copy of a
    // shorter budget, so one slow table drops (or, for paged tables, trims)
    // only that section and we always emit valid XML with a 200 well within
    // the cap.
    const DB_BUDGET_MS = 7000;
    const deadline = Date.now() + DB_BUDGET_MS;
    const fetchAll = (build, max) => fetchPaged(build, max, deadline);
    let budgetTimer;
    const budget = new Promise((_, reject) => {
      budgetTimer = setTimeout(() => reject(new Error('sitemap section timed out')), DB_BUDGET_MS);
    });
    budget.catch(() => {}); // Rejection is consumed per section below.
    const withinBudget = (query) => Promise.race([query, budget]);
    const dbData = await Promise.allSettled([
      fetchAll(() => supabase
        .from('blog_articles')
        .select('id, slug, updated_at, published_at, created_at')
        .eq('is_published', true)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .order('id'), MAX_ROWS.articles),
      // seller_id also feeds the public-seller content gate below.
      fetchAll(() => supabase
        .from('listings')
        .select('id, slug, seller_id, updated_at, created_at, vault_item:vault_items(card_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .order('id'), MAX_ROWS.listings),
      fetchAll(() => supabase
        .from('profiles')
        .select('id, store_slug, updated_at')
        .eq('is_sole_trader', true)
        .eq('is_public', true)
        // Store pages are a paid-membership perk — only advertise stores
        // that renderDealer() will actually serve.
        .in('subscription_tier', PAID_TIERS)
        .order('id'), MAX_ROWS.dealers),
      fetchAll(() => supabase
        .from('shop_products')
        .select('id, title, slug, category, colour, family_sku, updated_at, created_at')
        .in('status', PUBLIC_SHOP_STATUSES)
        .order('created_at', { ascending: false })
        .order('id'), MAX_ROWS.products),
      fetchAll(() => supabase
        .from('events')
        .select('id, slug, updated_at, created_at')
        .eq('status', 'approved')
        .gte('start_date', EVENTS_SINCE)
        .order('start_date', { ascending: true })
        .order('id'), MAX_ROWS.events),
      fetchAll(() => supabase
        .from('tracked_cards')
        .select('id, slug, category, updated_at, card_price_snapshots(snapshot_date)')
        .eq('active', true)
        .order('snapshot_date', { referencedTable: 'card_price_snapshots', ascending: false })
        .limit(1, { referencedTable: 'card_price_snapshots' })
        .order('id'), MAX_ROWS.trackedCards),
      fetchAll(() => supabase
        .from('local_game_stores')
        .select('id, city, updated_at')
        .eq('status', 'approved')
        .order('id'), MAX_ROWS.stores),
      // Public seller profiles (/seller/:id) — prerendered for crawlers but
      // previously absent from the sitemap. PAID sole traders are excluded
      // here: their canonical is the /dealer store page (already listed
      // above), so /seller/:id for them is a declared alternate, not a URL
      // to advertise. A Hobby ('free') sole trader has no live store page,
      // so their /seller page stays canonical and IS advertised — mirroring
      // renderSeller()'s hasStore logic.
      fetchAll(() => supabase
        .from('profiles')
        .select('id, updated_at, reviews_count')
        .not('is_public', 'is', false)
        .or('is_sole_trader.not.is.true,subscription_tier.eq.free')
        .order('updated_at', { ascending: false })
        .order('id'), MAX_ROWS.sellerProfiles),
      // Admin-edited shop categories (Admin → Products → Categories), merged
      // over the built-in leaves for the /shop/category/<slug> pages.
      supabase
        .from('shop_categories')
        .select('section_slug, name, description, hidden'),
    ].map(withinBudget));
    clearTimeout(budgetTimer);

    // Promise.allSettled means one slow/failing table degrades that section
    // only, not the whole sitemap.
    const rows = (i) =>
      (dbData?.[i]?.status === 'fulfilled' ? dbData[i].value.data : null) ?? [];
    const articles = rows(0);
    const listings = rows(1);
    const dealers = rows(2);
    const products = rows(3);
    const events = rows(4);
    const trackedCards = rows(5);
    const directoryStores = rows(6);
    const sellerProfiles = rows(7);
    const shopCategoryRows = rows(8);
    // Set of seller ids with at least one active listing — cheap membership
    // test for the content gate below.
    const activeSellerIds = new Set(listings.map((r) => r.seller_id).filter(Boolean));
    // A public, non-dealer profile earns a sitemap entry when it has active
    // listings to show or a review history (aggregateRating) — either way the
    // prerendered /seller page carries real, indexable content.
    const publicSellers = sellerProfiles.filter(
      (p) => activeSellerIds.has(p.id) || Number(p.reviews_count) > 0,
    );

    const parts = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '',
      '  <!-- Core & static pages -->',
    ];

    for (const p of STATIC_PAGES) {
      parts.push(xmlUrl(`${BASE_URL}${p.loc}`, p.lastmod, p.freq, p.pri));
    }

    if (events.length > 0) {
      parts.push('', `  <!-- Event pages (${events.length}) -->`);
      for (const event of events) {
        const lastmod = (event.updated_at || event.created_at || TODAY).split('T')[0];
        parts.push(xmlUrl(`${BASE_URL}/events/${event.slug || event.id}`, lastmod, 'weekly', '0.6'));
      }
    }

    if (dealers.length > 0) {
      parts.push('', `  <!-- Sole-trader dealer stores (${dealers.length}) -->`);
      for (const dealer of dealers) {
        const lastmod = (dealer.updated_at || TODAY).split('T')[0];
        parts.push(xmlUrl(`${BASE_URL}/dealer/${dealer.store_slug || dealer.id}`, lastmod, 'weekly', '0.6'));
      }
    }

    if (publicSellers.length > 0) {
      parts.push('', `  <!-- Public seller profiles (${publicSellers.length}) -->`);
      for (const seller of publicSellers) {
        const lastmod = (seller.updated_at || TODAY).split('T')[0];
        parts.push(xmlUrl(`${BASE_URL}/seller/${seller.id}`, lastmod, 'weekly', '0.5'));
      }
    }

    // One URL per product page at its canonical /shop/<category>/<slug>
    // (utils/shopProductUrl.js). Colour siblings share their line's page, and
    // catalogue pages are already listed in STATIC_PAGES, so dedupe.
    const listed = new Set(STATIC_PAGES.map((p) => p.loc));
    const shopUrls = [];
    for (const product of products) {
      const path = shopProductBasePath(product) || legacyShopProductPath(product);
      if (listed.has(path)) continue;
      listed.add(path);
      shopUrls.push({ path, lastmod: (product.updated_at || product.created_at || TODAY).split('T')[0] });
    }
    if (shopUrls.length > 0) {
      parts.push('', `  <!-- Shop products (${shopUrls.length}) -->`);
      for (const { path, lastmod } of shopUrls) {
        parts.push(xmlUrl(`${BASE_URL}${path}`, lastmod, 'weekly', '0.7'));
      }
    }

    // Shop leaf category pages (/shop/category/<slug>), built-in plus any the
    // admin added, minus any they hid. Only categories with at least one
    // public product are advertised — an empty grid is thin content.
    const categoryUrls = [];
    for (const leaf of shopCategoryLeaves(shopCategoryRows)) {
      const path = `/shop/category/${leaf.slug}`;
      if (listed.has(path)) continue;
      let lastmod = '';
      for (const product of products) {
        if (!productInShopCategory(product, leaf.name)) continue;
        const updated = (product.updated_at || product.created_at || TODAY).split('T')[0];
        if (updated > lastmod) lastmod = updated;
      }
      if (!lastmod) continue;
      listed.add(path);
      categoryUrls.push({ path, lastmod });
    }
    if (categoryUrls.length > 0) {
      parts.push('', `  <!-- Shop categories (${categoryUrls.length}) -->`);
      for (const { path, lastmod } of categoryUrls) {
        parts.push(xmlUrl(`${BASE_URL}${path}`, lastmod, 'weekly', '0.7'));
      }
    }

    if (articles.length > 0) {
      parts.push('', `  <!-- Blog articles (${articles.length}) -->`);
      for (const article of articles) {
        const lastmod = (article.updated_at || article.published_at || article.created_at || TODAY).split('T')[0];
        parts.push(xmlUrl(`${BASE_URL}/blog/${article.slug}`, lastmod, 'weekly', '0.7'));
      }
    }

    if (directoryStores.length > 0) {
      // Store directory: hub + one page per city that actually has approved
      // stores (empty city pages would be thin/soft-404 territory).
      const cityLastmod = {};
      for (const store of directoryStores) {
        const updated = (store.updated_at || '').split('T')[0];
        if (!cityLastmod[store.city] || updated > cityLastmod[store.city]) {
          cityLastmod[store.city] = updated || TODAY;
        }
      }
      const cities = Object.keys(cityLastmod);
      parts.push('', `  <!-- Store directory (${cities.length} cities) -->`);
      const newestUpdate = Object.values(cityLastmod).sort().pop() || TODAY;
      parts.push(xmlUrl(`${BASE_URL}/card-shops`, newestUpdate, 'weekly', '0.8'));
      for (const city of cities) {
        parts.push(xmlUrl(`${BASE_URL}/card-shops/${city}`, cityLastmod[city], 'weekly', '0.7'));
      }
    }

    if (trackedCards.length > 0) {
      parts.push('', `  <!-- Card price pages (${trackedCards.length}) -->`);
      for (const card of trackedCards) {
        const snapshotDate = card.card_price_snapshots?.[0]?.snapshot_date;
        const lastmod = snapshotDate || (card.updated_at || TODAY).split('T')[0];
        parts.push(xmlUrl(`${BASE_URL}/prices/${card.category}/${card.slug}`, lastmod, 'daily', '0.7'));
      }
    }

    if (listings.length > 0) {
      parts.push('', `  <!-- Marketplace listings (${listings.length}) -->`);
      for (const listing of listings) {
        const lastmod = (listing.updated_at || listing.created_at || TODAY).split('T')[0];
        // Descriptive, keyword-rich slug from the card name — matches the client
        // and prerender canonicals so the sitemap doesn't advertise a weaker URL.
        const urlSlug = listing.slug || slugify(listing.vault_item?.card_name) || 'listing';
        parts.push(xmlUrl(`${BASE_URL}/marketplace/${listing.id}/${urlSlug}`, lastmod, 'weekly', '0.6'));
      }
    }

    parts.push('', '</urlset>');
    return res.status(200).send(parts.join('\n'));
  } catch (err) {
    console.error('Sitemap generation error:', err);
    const fallbackParts = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...STATIC_PAGES.map(p => xmlUrl(`${BASE_URL}${p.loc}`, p.lastmod, p.freq, p.pri)),
      '</urlset>',
    ];
    return res.status(200).send(fallbackParts.join('\n'));
  }
}
