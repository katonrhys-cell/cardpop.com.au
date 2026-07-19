import { createClient } from '@supabase/supabase-js';
import { COLLECTION_SEO } from '../data/collectionSeo.js';
import { BLOG_CATEGORIES } from '../data/blogCategories.js';
import { BUYING_GUIDES } from '../data/buyingGuides.js';

const SUPABASE_URL = 'https://odoglvswwymyjuwlonkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

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
const SITE_UPDATED = '2026-06-30';

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

const STATIC_PAGES = [
  { loc: '/',                      lastmod: SITE_UPDATED,       freq: 'daily',   pri: '1.0' },
  { loc: '/marketplace',           lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.9' },
  // /search is intentionally excluded — internal search-results pages offer no
  // unique indexable content and are disallowed in robots.txt.
  { loc: '/shop',                  lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.9' },
  { loc: '/shop/sealed-boxes',     lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/shop/singles',          lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
  { loc: '/analytics',             lastmod: SITE_UPDATED,       freq: 'daily',   pri: '0.8' },
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
    // "temporary processing error". Race the DB work against a shorter budget
    // and fall back to an empty result set so we always emit valid XML (at
    // least the static pages) with a 200 well within the cap.
    const DB_BUDGET_MS = 7000;
    const dbData = await Promise.race([
      Promise.allSettled([
        supabase
          .from('blog_articles')
          .select('slug, updated_at, published_at, created_at')
          .eq('is_published', true)
          .not('slug', 'is', null)
          .order('published_at', { ascending: false })
          .limit(200),
        supabase
          .from('listings')
          .select('id, slug, title, updated_at, created_at, vault_item:vault_items(card_name)')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('profiles')
          .select('id, store_slug, updated_at')
          .eq('is_sole_trader', true)
          .eq('is_public', true)
          .limit(500),
        supabase
          .from('shop_products')
          .select('id, title, updated_at, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('events')
          .select('id, slug, updated_at, created_at')
          .eq('status', 'approved')
          .gte('start_date', EVENTS_SINCE)
          .order('start_date', { ascending: true })
          .limit(500),
        supabase
          .from('tracked_cards')
          .select('slug, category, updated_at, card_price_snapshots(snapshot_date)')
          .eq('active', true)
          .order('snapshot_date', { referencedTable: 'card_price_snapshots', ascending: false })
          .limit(1, { referencedTable: 'card_price_snapshots' })
          .limit(500),
        supabase
          .from('local_game_stores')
          .select('city, updated_at')
          .eq('status', 'approved')
          .limit(500),
      ]),
      new Promise((resolve) => setTimeout(() => resolve(null), DB_BUDGET_MS)),
    ]);

    // Promise.allSettled means one slow/failing table degrades that section
    // only, not the whole sitemap. On timeout dbData is null → static-only.
    const rows = (i) =>
      (dbData?.[i]?.status === 'fulfilled' ? dbData[i].value.data : null) ?? [];
    const articles = rows(0);
    const listings = rows(1);
    const dealers = rows(2);
    const products = rows(3);
    const events = rows(4);
    const trackedCards = rows(5);
    const directoryStores = rows(6);

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

    if (products.length > 0) {
      parts.push('', `  <!-- Shop products (${products.length}) -->`);
      for (const product of products) {
        const lastmod = (product.updated_at || product.created_at || TODAY).split('T')[0];
        const urlSlug = slugify(product.title || 'product') || 'product';
        parts.push(xmlUrl(`${BASE_URL}/product/shop/${product.id}/${urlSlug}`, lastmod, 'weekly', '0.7'));
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
        const urlSlug = listing.slug || slugify(listing.title || listing.vault_item?.card_name) || 'listing';
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
