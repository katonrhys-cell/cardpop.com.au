import { createClient } from '@supabase/supabase-js';

// Google Merchant Center product feed for the CardPop shop catalogue.
//
// Merchant Center pulls this URL on a schedule (a "scheduled fetch" feed), so
// there's no API auth, OAuth, or per-product push to maintain — the endpoint
// just renders every active `shop_products` row into the Google Shopping
// product spec (RSS 2.0 + the `g:` namespace). Point Merchant Center at
// https://cardpop.com.au/merchant-feed.xml (see docs/google-merchant.md).
//
// This mirrors api/sitemap.js in shape: anon Supabase client, a DB time budget
// that falls back to an empty-but-valid document so Google never sees a 5xx,
// and the same product URL/slug construction the sitemap and prerender use.

const SUPABASE_URL = 'https://odoglvswwymyjuwlonkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

const BASE_URL = 'https://cardpop.com.au';

// Google product feeds are XML — every text value must be escaped so a stray
// & or < in a title/description can't produce invalid XML and make Merchant
// Center reject the entire feed.
const xmlEscape = (str = '') => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

// Mirror of lib/slugify.js — kept inline so the serverless function has no
// dependency on the frontend bundle. Matches the slug the sitemap/prerender
// build so feed links resolve to the same canonical product page.
const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

// Collapse product HTML/whitespace to a plain-text description. Google accepts
// up to 5000 chars and shows only plain text, so tags are stripped.
const toText = (html = '', max = 5000) => {
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

// Optional image CDN in front of Supabase Storage (see docs/image-cdn.md).
// Mirrors utils/imageUrl.js / api/prerender.js but reads the server-side env
// var. Google fetches each image once and caches it on its own servers, so
// routing through the CDN keeps that crawl off the metered Supabase quota.
const IMAGE_CDN_ORIGIN = (() => {
  const host = process.env.IMAGE_CDN_HOST || process.env.VITE_IMAGE_CDN_HOST;
  if (!host) return null;
  const trimmed = host.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
})();

const SUPABASE_STORAGE_URL_RE =
  /^https?:\/\/[^/]+\.supabase\.(co|in)(\/storage\/v1\/(?:object|render\/image)\/public\/.+)$/;

const toCdnUrl = (url) => {
  if (!IMAGE_CDN_ORIGIN || typeof url !== 'string') return url ?? null;
  const match = url.match(SUPABASE_STORAGE_URL_RE);
  return match ? `${IMAGE_CDN_ORIGIN}${match[2]}` : url;
};

// Shop images are stored as absolute Supabase public URLs (ShopProductForm
// uploads to the `media` bucket and stores getPublicUrl output). Absolute URLs
// pass through (CDN-rewritten); a bare path is made absolute against the site.
const imageLink = (pathOrUrl) => {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  if (/^https?:\/\//.test(pathOrUrl)) return toCdnUrl(pathOrUrl);
  return `${BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

// Google product taxonomy. Card singles/sealed map to the Collectible Trading
// Cards node; everything else (binders, sleeves, supplies) is left unset so
// Google auto-classifies it rather than us mislabelling it.
const GOOGLE_CATEGORY_CARDS =
  'Arts & Entertainment > Hobbies & Creative Arts > Collectibles > Collectible Trading Cards';

const googleCategory = (product) => {
  const type = String(product.product_type || '').toLowerCase();
  const category = String(product.category || '').toLowerCase();
  if (type === 'single' || type === 'sealed' || /card/.test(category)) {
    return GOOGLE_CATEGORY_CARDS;
  }
  return null;
};

// Build the <item> for one product, or null if it can't form a valid offer.
// Google disapproves items missing a title, price, or image, so we skip those
// rather than emit entries that would fail review.
function buildItem(product) {
  const title = (product.title || '').trim();
  const price = Number(product.price_aud);
  const image = imageLink(
    (Array.isArray(product.images) && product.images[0]) || product.image_url,
  );

  if (!title || !(price > 0) || !image) return null;

  const slug = slugify(title) || 'product';
  const link = `${BASE_URL}/product/shop/${product.id}/${slug}`;
  const inStock = product.stock_quantity == null || product.stock_quantity > 0;
  const description = toText(
    product.description
      || `${title}${product.category ? ` — ${product.category}` : ''} available from the CardPop official store. Fast shipping across Australia.`,
  );
  const category = googleCategory(product);

  const fields = [
    `      <g:id>${xmlEscape(product.id)}</g:id>`,
    `      <title>${xmlEscape(title)}</title>`,
    `      <description>${xmlEscape(description)}</description>`,
    `      <link>${xmlEscape(link)}</link>`,
    `      <g:image_link>${xmlEscape(image)}</g:image_link>`,
    `      <g:availability>${inStock ? 'in_stock' : 'out_of_stock'}</g:availability>`,
    `      <g:price>${price.toFixed(2)} AUD</g:price>`,
    `      <g:condition>new</g:condition>`,
    // Shop products carry no GTIN/MPN/brand in the DB, so we declare no unique
    // product identifiers rather than assert a brand Google would then expect a
    // GTIN for. Adding real brand+GTIN per product later improves eligibility.
    `      <g:identifier_exists>no</g:identifier_exists>`,
  ];

  if (category) {
    fields.push(`      <g:google_product_category>${xmlEscape(category)}</g:google_product_category>`);
  }
  if (product.category) {
    fields.push(`      <g:product_type>${xmlEscape(product.category)}</g:product_type>`);
  }
  // Extra photos (up to Google's cap of 10) improve the listing.
  if (Array.isArray(product.images)) {
    for (const extra of product.images.slice(1, 11)) {
      const url = imageLink(extra);
      if (url && url !== image) {
        fields.push(`      <g:additional_image_link>${xmlEscape(url)}</g:additional_image_link>`);
      }
    }
  }

  return `    <item>\n${fields.join('\n')}\n    </item>`;
}

function renderFeed(items) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    '    <title>CardPop Shop</title>',
    `    <link>${BASE_URL}/shop</link>`,
    '    <description>Official CardPop sealed products, singles and accessories.</description>',
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Cache at the edge for an hour; Merchant Center typically fetches at most
  // daily, so a stale-while-revalidate window keeps the function cheap.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    // The function is capped at 10s (vercel.json). Race the DB read against a
    // shorter budget and fall back to an empty feed so we always emit valid XML
    // with a 200 well within the cap, rather than a 504 Google reports as a
    // fetch error.
    const DB_BUDGET_MS = 7000;
    const dbData = await Promise.race([
      supabase
        .from('shop_products')
        .select('id, title, description, price_aud, stock_quantity, category, product_type, images, image_url')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1000),
      new Promise((resolve) => setTimeout(() => resolve(null), DB_BUDGET_MS)),
    ]);

    const products = dbData?.data ?? [];
    const items = products.map(buildItem).filter(Boolean);

    return res.status(200).send(renderFeed(items));
  } catch (err) {
    console.error('Merchant feed generation error:', err);
    return res.status(200).send(renderFeed([]));
  }
}
