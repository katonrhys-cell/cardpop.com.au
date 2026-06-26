import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://odoglvswwymyjuwlonkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

const BASE_URL = 'https://cardpop.com.au';
const TODAY = new Date().toISOString().split('T')[0];

const xmlUrl = (loc, lastmod, changefreq, priority) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const STATIC_PAGES = [
  { loc: '/',                      lastmod: TODAY,       freq: 'daily',   pri: '1.0' },
  { loc: '/marketplace',           lastmod: TODAY,       freq: 'daily',   pri: '0.9' },
  { loc: '/browse',                lastmod: TODAY,       freq: 'daily',   pri: '0.9' },
  { loc: '/search',                lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/shop',                  lastmod: TODAY,       freq: 'daily',   pri: '0.9' },
  { loc: '/shop/sealed-boxes',     lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/shop/singles',          lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/analytics',             lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/australian-markets',    lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/insider-trading',       lastmod: TODAY,       freq: 'weekly',  pri: '0.7' },
  { loc: '/grading',               lastmod: TODAY,       freq: 'weekly',  pri: '0.8' },
  { loc: '/grading/what-is-grading', lastmod: TODAY,    freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/scales',        lastmod: TODAY,       freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/companies',     lastmod: TODAY,       freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/local-graders', lastmod: TODAY,       freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/submission-partners', lastmod: TODAY, freq: 'monthly',  pri: '0.7' },
  { loc: '/grading/estimator',     lastmod: TODAY,       freq: 'weekly',   pri: '0.8' },
  { loc: '/grading/roi-calculator', lastmod: TODAY,      freq: 'weekly',   pri: '0.8' },
  { loc: '/community',             lastmod: TODAY,       freq: 'daily',   pri: '0.7' },
  { loc: '/events',                lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/events/card-shows',     lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/events/trade-events',   lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/events/community-events', lastmod: TODAY,     freq: 'daily',   pri: '0.8' },
  { loc: '/events/store-events',   lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/community/local-traders', lastmod: TODAY,     freq: 'daily',   pri: '0.7' },
  { loc: '/blog',                  lastmod: TODAY,       freq: 'weekly',  pri: '0.8' },
  { loc: '/about',                 lastmod: '2026-05-31', freq: 'monthly', pri: '0.6' },
  { loc: '/contact',               lastmod: '2026-05-31', freq: 'monthly', pri: '0.6' },
  { loc: '/faq',                   lastmod: '2026-05-31', freq: 'monthly', pri: '0.6' },
  { loc: '/privacy-policy',        lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/terms',                 lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/returns',               lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/shipping',              lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/trust-safety',          lastmod: '2026-05-31', freq: 'yearly',  pri: '0.4' },
  { loc: '/accessibility',         lastmod: '2026-05-31', freq: 'yearly',  pri: '0.3' },
];


export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const [articlesRes, listingsRes, dealersRes, productsRes, eventsRes] = await Promise.all([
      supabase
        .from('blog_articles')
        .select('slug, updated_at, published_at, created_at')
        .eq('is_published', true)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .limit(200),
      supabase
        .from('listings')
        .select('id, slug, updated_at, created_at')
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
        .eq('is_published', true)
        .gt('start_date', TODAY)
        .order('start_date', { ascending: true })
        .limit(500),
    ]);

    const articles = articlesRes.data ?? [];
    const listings = listingsRes.data ?? [];
    const dealers = dealersRes.data ?? [];
    const products = productsRes.data ?? [];
    const events = eventsRes.data ?? [];

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
        parts.push(xmlUrl(`${BASE_URL}/events/${event.id}`, lastmod, 'weekly', '0.6'));
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

    if (listings.length > 0) {
      parts.push('', `  <!-- Marketplace listings (${listings.length}) -->`);
      for (const listing of listings) {
        const lastmod = (listing.updated_at || listing.created_at || TODAY).split('T')[0];
        const urlSlug = listing.slug || 'listing';
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
