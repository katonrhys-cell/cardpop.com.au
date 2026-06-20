import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://odoglvswwymyjuwlonkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

const BASE_URL = 'https://cardpop.com.au';
const TODAY = new Date().toISOString().split('T')[0];

const xmlUrl = (loc, lastmod, changefreq, priority) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const STATIC_PAGES = [
  { loc: '/',                      lastmod: TODAY,       freq: 'daily',   pri: '1.0' },
  { loc: '/marketplace',           lastmod: TODAY,       freq: 'daily',   pri: '0.9' },
  { loc: '/browse',                lastmod: TODAY,       freq: 'daily',   pri: '0.9' },
  { loc: '/search',                lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/shop',                  lastmod: TODAY,       freq: 'daily',   pri: '0.9' },
  { loc: '/shop/sealed-boxes',     lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/shop/singles',          lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/markets',               lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/australian-markets',    lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
  { loc: '/insider-trading',       lastmod: TODAY,       freq: 'weekly',  pri: '0.7' },
  { loc: '/grading',               lastmod: TODAY,       freq: 'weekly',  pri: '0.8' },
  { loc: '/community',             lastmod: TODAY,       freq: 'daily',   pri: '0.7' },
  { loc: '/community/events',      lastmod: TODAY,       freq: 'daily',   pri: '0.8' },
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

const EVENT_SLUGS = [
  'supanova-comic-con-sydney-2026',
  'big-boyz-card-show-seven-hills-june-2026',
  'tcxpo-trading-card-expo-oran-park-june-2026',
  'perth-card-fest-claremont-july-2026',
  'hobby-con-au-glebe-july-2026',
  'big-boyz-card-show-seven-hills-july-2026',
  'collector-con-penrith-july-2026',
  'tcxpo-trading-card-expo-oran-park-august-2026',
  'cardverse-adelaide-trading-card-show-august-2026',
  'trading-card-show-australia-adelaide-2026',
  'card-fest-melbourne-reservoir-august-2026',
  'oz-national-trading-card-show-melbourne-2026',
  'brisbane-trading-card-show-october-2026',
  'sa-card-show-adelaide-october-2026',
  'treasurecon-perth-december-2026',
  'tcxpo-trading-card-expo-oran-park-december-2026',
  'melbourne-comic-toy-fair-scoresby-july-2026',
  'gundam-card-game-melbourne-regional-championship-2026',
  'cardcon-melbourne-2026',
  'collector-con-newcastle-august-2026',
  'cardcon-mega-sydney-olympic-park-2026',
  'the-tcg-expo-malvern-october-2026',
  'big-boyz-card-show-wollongong-november-2026',
  'hobby-hangout-xl-brisbane-2026',
  'hobby-hangout-xl-sydney-2026',
  'hobby-hangout-xl-melbourne-2027',
];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const [articlesRes, listingsRes, dealersRes] = await Promise.all([
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
    ]);

    const articles = articlesRes.data ?? [];
    const listings = listingsRes.data ?? [];
    const dealers = dealersRes.data ?? [];

    const parts = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '',
      '  <!-- Core & static pages -->',
    ];

    for (const p of STATIC_PAGES) {
      parts.push(xmlUrl(`${BASE_URL}${p.loc}`, p.lastmod, p.freq, p.pri));
    }

    parts.push('', '  <!-- Event pages -->');
    for (const slug of EVENT_SLUGS) {
      parts.push(xmlUrl(`${BASE_URL}/community/events/${slug}`, '2026-06-11', 'weekly', '0.6'));
    }

    if (dealers.length > 0) {
      parts.push('', `  <!-- Sole-trader dealer stores (${dealers.length}) -->`);
      for (const dealer of dealers) {
        const lastmod = (dealer.updated_at || TODAY).split('T')[0];
        parts.push(xmlUrl(`${BASE_URL}/dealer/${dealer.store_slug || dealer.id}`, lastmod, 'weekly', '0.6'));
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
        parts.push(xmlUrl(`${BASE_URL}/product/marketplace/${listing.id}/${urlSlug}`, lastmod, 'weekly', '0.6'));
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
      ...EVENT_SLUGS.map(slug => xmlUrl(`${BASE_URL}/community/events/${slug}`, '2026-06-11', 'weekly', '0.6')),
      '</urlset>',
    ];
    return res.status(200).send(fallbackParts.join('\n'));
  }
}
