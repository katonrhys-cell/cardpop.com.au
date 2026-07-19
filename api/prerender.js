import { createClient } from '@supabase/supabase-js';
import { COLLECTION_SEO } from '../data/collectionSeo.js';
import { BLOG_CATEGORIES, BLOG_CATEGORY_MAP } from '../data/blogCategories.js';
import { BUYING_GUIDES, getBuyingGuide, GUIDE_CATEGORY_META, GUIDE_PRICE_CATEGORY } from '../data/buyingGuides.js';

// Dynamic rendering for crawlers / link unfurlers. The site is a client-rendered
// SPA, so bots that don't execute JS would otherwise see an empty shell. Vercel
// rewrites route bot user-agents for these public pages here, where we return
// fully-formed HTML with titles, meta tags and JSON-LD. Humans are unaffected —
// their requests fall through to the SPA (index.html).

const SUPABASE_URL = 'https://odoglvswwymyjuwlonkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

const BASE_URL = 'https://cardpop.com.au';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Escape "<" so a value can never break out of the <script> JSON-LD block.
const ldJson = (items) => {
  const payload = items.length === 1
    ? items[0]
    : { '@context': 'https://schema.org', '@graph': items.map(({ '@context': _c, ...rest }) => rest) };
  return JSON.stringify(payload).replace(/</g, '\\u003c');
};

const absUrl = (u) => (!u ? undefined : (u.startsWith('http') ? u : `${BASE_URL}${u}`));

// Optional image CDN in front of Supabase Storage (see
// docs/image-cdn.md). Mirrors utils/imageUrl.js but reads the
// server-side env var, since this file runs as a Vercel function.
const IMAGE_CDN_ORIGIN = (() => {
  const host = process.env.IMAGE_CDN_HOST || process.env.VITE_IMAGE_CDN_HOST;
  if (!host) return null;
  const trimmed = host.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
})();

const SUPABASE_STORAGE_URL_RE =
  /^https?:\/\/[^/]+\.supabase\.(co|in)(\/storage\/v1\/(?:object|render\/image)\/public\/.+)$/;

const toCdnUrl = (url) => {
  if (!IMAGE_CDN_ORIGIN || typeof url !== 'string') return url ?? undefined;
  const match = url.match(SUPABASE_STORAGE_URL_RE);
  return match ? `${IMAGE_CDN_ORIGIN}${match[2]}` : url;
};

// Storage path or absolute URL → CDN-aware public image URL (og:image etc).
// Built from the constant rather than a Supabase client: getPublicUrl is pure
// string concatenation, and no client exists at module scope here (handlers
// create theirs per-request).
const publicImageUrl = (pathOrUrl) => {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//.test(pathOrUrl)) return toCdnUrl(pathOrUrl);
  return toCdnUrl(`${SUPABASE_URL}/storage/v1/object/public/vault-images/${pathOrUrl}`);
};

// Strip <script>/<style> blocks from admin-authored article HTML before
// embedding it in the prerendered body. Content is trusted (our own CMS), but
// removing executable tags keeps the bot-only document inert and well-formed.
const sanitizeArticleHtml = (html = '') => String(html)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

// Collapse HTML to a plain-text snippet for meta descriptions.
const toText = (html = '', max = 300) => {
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

const isoDate = (d) => (d ? new Date(d).toISOString() : undefined);

// Mirror of lib/slugify.js — kept inline so the serverless function has no
// dependency on the frontend bundle.
const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

// Inject unique anchor ids onto every <h2> in article HTML so crawlers (and
// Google "jump to" deep links) have stable targets. Regex-based to avoid a DOM
// dependency in the serverless function; leaves headings that already have ids.
const addHeadingAnchors = (html = '') => {
  const used = new Set();
  return String(html).replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi, (match, attrs, inner) => {
    if (/\bid\s*=/i.test(attrs)) return match;
    const text = inner
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/&#39;|&rsquo;|&apos;/gi, "'")
      .replace(/\s+/g, ' ').trim();
    if (!text) return match;
    const base = slugify(text) || 'section';
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
};

// Map a trading-card condition / grade to a schema.org OfferItemCondition.
const schemaItemCondition = (c) => {
  const v = String(c || '').toLowerCase();
  if (!v) return undefined;
  if (/(gem|mint|sealed|brand new|\bnm\b|graded)/.test(v) || /\b(8|8\.5|9|9\.5|10)\b/.test(v)) return 'https://schema.org/NewCondition';
  if (/(damaged|poor|heavily played|\bhp\b)/.test(v)) return 'https://schema.org/DamagedCondition';
  return 'https://schema.org/UsedCondition';
};

function htmlDoc({ title, description, canonical, ogImage, ogImageAlt, robots, ogType = 'website', headExtra = '', jsonLdItems = [], bodyHtml = '' }) {
  const imageAlt = ogImageAlt || title;
  const ld = jsonLdItems.length
    ? `<script type="application/ld+json">${ldJson(jsonLdItems)}</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
${robots ? `<meta name="robots" content="${esc(robots)}" />` : ''}
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="${esc(ogType)}" />
<meta property="og:site_name" content="CardPop" />
<meta property="og:url" content="${esc(canonical)}" />
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />` : ''}
${ogImage ? `<meta property="og:image:alt" content="${esc(imageAlt)}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}" />` : ''}
${ogImage ? `<meta name="twitter:image:alt" content="${esc(imageAlt)}" />` : ''}
${headExtra}
${ld}
</head>
<body>
${bodyHtml}
<p><a href="${esc(canonical)}">View on CardPop</a></p>
</body>
</html>`;
}

// Render results are either a plain HTML string (served with 200) or
// { status, html }. Missing/removed content must be a real 404 — the previous
// behaviour of 200 + noindex made Google treat every sold listing, deleted
// article and typo URL as a live-but-excluded page ("Excluded by 'noindex'
// tag" in Search Console) and keep recrawling it, instead of dropping it as
// "Not found (404)".
const notFound = (opts) => ({ status: 404, html: htmlDoc({ robots: 'noindex, follow', ...opts }) });
const sendDoc = (res, doc) =>
  typeof doc === 'string' ? res.status(200).send(doc) : res.status(doc.status || 200).send(doc.html);

async function renderLocalTraders(supabase) {
  const { data } = await supabase
    .from('profiles')
    .select('id, store_slug, business_name, display_name, username, business_tagline, business_logo_url, location_state, location_suburb, rating, reviews_count, is_featured_seller')
    .eq('is_sole_trader', true)
    .eq('is_public', true)
    .order('is_featured_seller', { ascending: false })
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(100);

  const stores = data || [];
  const canonical = `${BASE_URL}/community/local-traders`;
  const title = 'Local Traders | CardPop';
  const description = 'Browse CardPop-endorsed trading card sellers and sole-trader stores across Australia. Verified, trusted collectors and dealers you can buy and trade with confidence.';

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Community', item: `${BASE_URL}/community` },
      { '@type': 'ListItem', position: 3, name: 'Local Traders', item: canonical },
    ],
  };

  const jsonLdItems = [breadcrumb];
  if (stores.length > 0) {
    jsonLdItems.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'CardPop Trader Stores',
      itemListElement: stores.map((s, i) => {
        const name = s.business_name || s.display_name || s.username || 'Store';
        const image = absUrl(s.business_logo_url);
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Store',
            name,
            url: `${BASE_URL}/dealer/${s.store_slug || s.id}`,
            ...(image ? { image } : {}),
            ...(s.reviews_count > 0 && s.rating > 0
              ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(s.rating).toFixed(1), reviewCount: s.reviews_count } }
              : {}),
          },
        };
      }),
    });
  }

  const items = stores.map(s => {
    const name = s.business_name || s.display_name || s.username || 'Store';
    const loc = [s.location_suburb, s.location_state].filter(Boolean).join(', ');
    return `    <li><a href="${BASE_URL}/dealer/${esc(s.store_slug || s.id)}"><strong>${esc(name)}</strong></a>`
      + `${s.business_tagline ? ` — ${esc(s.business_tagline)}` : ''}`
      + `${loc ? ` (${esc(loc)})` : ''}</li>`;
  }).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/community">Community</a> / Local Traders</nav>
  <h1>Local Traders</h1>
  <p>${esc(description)}</p>
  <h2>Trader Stores</h2>
  <ul>
${items}
  </ul>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems, bodyHtml });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function renderDealer(supabase, param) {
  const byUuid = UUID_RE.test(param);
  let dealerQuery = supabase
    .from('profiles')
    .select('id, store_slug, business_name, display_name, username, business_tagline, bio, business_logo_url, avatar_url, location_state, location_suburb, rating, reviews_count, total_sales, is_sole_trader, is_public, created_at');
  dealerQuery = byUuid ? dealerQuery.eq('id', param) : dealerQuery.eq('store_slug', param);
  const { data: dealer } = await dealerQuery.maybeSingle();

  const canonical = `${BASE_URL}/dealer/${dealer?.store_slug || param}`;

  if (!dealer || !dealer.is_sole_trader || dealer.is_public === false) {
    return notFound({
      title: 'Store Unavailable | CardPop',
      description: 'This dealer store could not be found on CardPop.',
      canonical,
      bodyHtml: '<main><h1>Store Unavailable</h1><p>This dealer store is not available.</p></main>',
    });
  }

  const [{ data: listings }, reviewsRes] = await Promise.all([
    supabase
      .from('listings')
      .select('id, slug, price_aud, vault_item:vault_items(card_name, condition, card_image, vault_images(storage_path))')
      .eq('seller_id', dealer.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('reviews').select('rating', { count: 'exact' }).eq('recipient_id', dealer.id),
  ]);

  const reviewCount = reviewsRes.count ?? 0;
  const avgRating = reviewCount > 0
    ? (reviewsRes.data || []).reduce((s, r) => s + (r.rating || 0), 0) / reviewCount
    : (dealer.rating || 0);

  const name = dealer.business_name || dealer.display_name || 'Dealer';
  const image = absUrl(dealer.business_logo_url || dealer.avatar_url);
  const location = [dealer.location_suburb, dealer.location_state].filter(Boolean).join(', ');
  const title = `${name} | CardPop Dealer`;
  const description = dealer.business_tagline || dealer.bio || `${name} — trading card dealer on CardPop Australia.`;

  const store = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name,
    url: canonical,
    ...(description ? { description } : {}),
    ...(image ? { image, logo: image } : {}),
    ...(dealer.location_state
      ? { address: { '@type': 'PostalAddress', addressRegion: dealer.location_state, ...(dealer.location_suburb ? { addressLocality: dealer.location_suburb } : {}), addressCountry: 'AU' } }
      : {}),
    ...(reviewCount > 0 && avgRating > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avgRating.toFixed(1), reviewCount } }
      : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Local Traders', item: `${BASE_URL}/community/local-traders` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  const listingItems = (listings || []).map(l => {
    const cardName = l.vault_item?.card_name || 'Trading Card';
    const slug = l.slug || 'listing';
    return `    <li><a href="${BASE_URL}/marketplace/${esc(l.id)}/${esc(slug)}">${esc(cardName)}</a></li>`;
  }).join('\n');

  // Product + Offer JSON-LD for each listing.
  const productLd = (listings || []).map((l, i) => {
    const cardName = l.vault_item?.card_name || 'Trading Card';
    const url = `${BASE_URL}/marketplace/${l.id}/${l.slug || 'listing'}`;
    const imgPath = l.vault_item?.vault_images?.[0]?.storage_path || l.vault_item?.card_image;
    const img = publicImageUrl(imgPath);
    const product = {
      '@type': 'Product',
      name: cardName,
      url,
      ...(img ? { image: img } : {}),
      ...(l.price_aud > 0
        ? { offers: {
            '@type': 'Offer',
            price: Number(l.price_aud).toFixed(2),
            priceCurrency: 'AUD',
            availability: 'https://schema.org/InStock',
            ...(schemaItemCondition(l.vault_item?.condition) ? { itemCondition: schemaItemCondition(l.vault_item?.condition) } : {}),
            url,
            seller: { '@type': 'Store', name },
          } }
        : {}),
    };
    return { '@type': 'ListItem', position: i + 1, item: product };
  });

  const productItemList = productLd.length > 0
    ? { '@context': 'https://schema.org', '@type': 'ItemList', name: `${name} listings`, numberOfItems: productLd.length, itemListElement: productLd }
    : null;

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/community/local-traders">Local Traders</a> / ${esc(name)}</nav>
  <h1>${esc(name)}</h1>
  ${dealer.business_tagline ? `<p>${esc(dealer.business_tagline)}</p>` : ''}
  ${location ? `<p>${esc(location)}</p>` : ''}
  ${dealer.bio ? `<p>${esc(dealer.bio)}</p>` : ''}
  <p><a href="${BASE_URL}/seller/${esc(dealer.id)}">View full seller profile</a></p>
  <h2>Store Listings (${(listings || []).length})</h2>
  <ul>
${listingItems || '    <li>No active listings at the moment.</li>'}
  </ul>
</main>`;

  return htmlDoc({ title, description, canonical, ogImage: image, jsonLdItems: [store, breadcrumb, ...(productItemList ? [productItemList] : [])], bodyHtml });
}

async function renderBlogArticle(supabase, param) {
  const byUuid = UUID_RE.test(param);
  // select('*') keeps this resilient to schema additions (e.g. the optional
  // `faqs` column) without coupling deploys to migration timing.
  let query = supabase.from('blog_articles').select('*');
  query = byUuid ? query.eq('id', param) : query.eq('slug', param);
  const { data: article } = await query.maybeSingle();

  if (!article || article.is_published === false) {
    return notFound({
      title: 'Article Not Found | CardPop',
      description: 'This article could not be found on CardPop.',
      canonical: `${BASE_URL}/blog/${param}`,
      bodyHtml: '<main><h1>Article Not Found</h1><p>This article is not available.</p></main>',
    });
  }

  // Canonical always points at the clean slug URL (the SPA redirects id/UUID URLs there too).
  const canonical = `${BASE_URL}/blog/${article.slug || article.id}`;
  const title = article.seo_title || `${article.title} | The Parallel Report`;
  const bodyContent = sanitizeArticleHtml(article.content_html || article.content || '');
  const description = article.seo_description || article.excerpt || toText(bodyContent) || `Read ${article.title} on The Parallel Report — CardPop's trading card blog.`;
  const image = absUrl(article.featured_image_url);
  const published = isoDate(article.published_at || article.created_at);
  const modified = isoDate(article.updated_at || article.published_at || article.created_at);
  const author = article.author || 'CardPop Research';
  // blog_articles.category stores the slug; show the human label in metadata.
  const categoryLabel = article.category
    ? (BLOG_CATEGORY_MAP[article.category]?.label || article.category)
    : null;
  const tags = Array.isArray(article.tags) ? article.tags.filter(Boolean) : [];
  const readTime = Number(article.read_time_minutes);
  const wordCount = toText(bodyContent).split(/\s+/).filter(Boolean).length;

  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    ...(image ? { image } : {}),
    author: { '@type': 'Person', name: author, url: `${BASE_URL}/about` },
    publisher: {
      '@type': 'Organization',
      name: 'CardPop',
      url: `${BASE_URL}/about`,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/og-image.jpg` },
    },
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    description,
    ...(categoryLabel ? { articleSection: categoryLabel } : {}),
    ...(tags.length ? { keywords: tags.join(', ') } : {}),
    ...(Number.isFinite(readTime) && readTime > 0 ? { timeRequired: `PT${readTime}M` } : {}),
    ...(wordCount > 0 ? { wordCount } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'The Parallel Report', item: `${BASE_URL}/blog` },
      ...(article.category ? [{ '@type': 'ListItem', position: 3, name: categoryLabel, item: `${BASE_URL}/blog/category/${encodeURIComponent(article.category)}` }] : []),
      { '@type': 'ListItem', position: article.category ? 4 : 3, name: article.title, item: canonical },
    ],
  };

  const faqs = Array.isArray(article.faqs)
    ? article.faqs.filter((f) => f && f.question && f.answer)
    : [];
  const faqPage = faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }
    : null;
  const faqHtml = faqs.length
    ? `<section>
    <h2>Frequently Asked Questions</h2>
    ${faqs.map((f) => `<h3>${esc(f.question)}</h3>\n    <p>${esc(f.answer)}</p>`).join('\n    ')}
  </section>`
    : '';

  const headExtra = [
    `<meta property="article:published_time" content="${esc(published || '')}" />`,
    `<meta property="article:modified_time" content="${esc(modified || '')}" />`,
    `<meta property="article:author" content="${esc(author)}" />`,
    categoryLabel ? `<meta property="article:section" content="${esc(categoryLabel)}" />` : '',
  ].filter(Boolean).join('\n');

  const tagsHtml = tags.length
    ? `<nav aria-label="Topics"><strong>Topics:</strong> ${tags
        .map((t) => `<a href="${BASE_URL}/blog?tag=${encodeURIComponent(t)}">${esc(t)}</a>`)
        .join(' · ')}</nav>`
    : '';

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/blog">The Parallel Report</a> / ${esc(article.title)}</nav>
  <article>
    <h1>${esc(article.title)}</h1>
    <p><em>By ${esc(author)}${published ? ` — ${esc(new Date(published).toISOString().split('T')[0])}` : ''}${article.read_time_minutes ? ` · ${esc(String(article.read_time_minutes))} min read` : ''}</em></p>
    ${article.excerpt ? `<p>${esc(article.excerpt)}</p>` : ''}
    ${image ? `<img src="${esc(image)}" alt="${esc(article.title)}" />` : ''}
    ${addHeadingAnchors(bodyContent) || `<p>${esc(description)}</p>`}
    ${tagsHtml}
  </article>
  ${faqHtml}
</main>`;

  return htmlDoc({ title, description, canonical, ogImage: image, ogType: 'article', headExtra, jsonLdItems: [blogPosting, breadcrumb, ...(faqPage ? [faqPage] : [])], bodyHtml });
}

async function renderListing(supabase, id, slugParam) {
  if (!UUID_RE.test(id)) {
    return notFound({
      title: 'CardPop Marketplace',
      description: 'Buy, sell and trade trading cards on CardPop.',
      canonical: `${BASE_URL}/marketplace`,
      bodyHtml: '<main><h1>CardPop Marketplace</h1></main>',
    });
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, title, description, price, price_aud, price_min_aud, price_max_aud, category, condition, grade, grading_company, status, images, accepts_offers, created_at, updated_at, seller_id, vault_item:vault_items(card_name, set_name, year, condition, grade, grading_company, card_image, vault_images(storage_path)), seller:profiles!seller_id(username, display_name, business_name, store_slug)')
    .eq('id', id)
    .maybeSingle();

  // Derive a descriptive slug from the card name (the ID is the stable key; the
  // slug is decorative but should carry the keyword). Falls back to the DB slug,
  // then the URL param, then a generic word — mirrors the shop-product handler
  // and the client canonical so all three agree.
  const card = listing?.vault_item || {};
  const cardName = listing?.title || card.card_name || 'Trading Card';
  const canonical = `${BASE_URL}/marketplace/${id}/${listing?.slug || slugify(cardName) || slugParam || 'listing'}`;

  if (!listing || listing.status !== 'active') {
    return notFound({
      title: 'Listing Unavailable | CardPop',
      description: 'This marketplace listing is no longer available on CardPop.',
      canonical,
      bodyHtml: '<main><h1>Listing Unavailable</h1><p>This listing is sold or no longer active.</p></main>',
    });
  }
  const imgPath = listing.images?.[0] || card.vault_images?.[0]?.storage_path || card.card_image;
  const image = publicImageUrl(imgPath);
  const price = listing.price_aud ?? listing.price;
  const condition = listing.condition || card.condition;
  const grade = listing.grade || card.grade;
  const gradingCompany = listing.grading_company || card.grading_company;
  const sellerName = listing.seller?.business_name || listing.seller?.display_name || listing.seller?.username || 'CardPop Seller';
  const title = `${cardName} | CardPop Marketplace`;
  const setLine = [card.set_name, card.year].filter(Boolean).join(' · ');
  const description = listing.description
    || `${cardName}${setLine ? ` (${setLine})` : ''}${grade ? ` — ${gradingCompany || ''} ${grade}`.trimEnd() : ''} for sale on CardPop, Australia's trading card marketplace.`;

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: cardName,
    ...(image ? { image } : {}),
    description,
    ...(card.set_name ? { category: card.set_name } : {}),
    ...(grade ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'Grade', value: `${gradingCompany || ''} ${grade}`.trim() }] } : {}),
    ...(price > 0
      ? { offers: {
          '@type': 'Offer',
          price: Number(price).toFixed(2),
          priceCurrency: 'AUD',
          availability: 'https://schema.org/InStock',
          ...(schemaItemCondition(condition) ? { itemCondition: schemaItemCondition(condition) } : {}),
          url: canonical,
          seller: { '@type': 'Organization', name: sellerName },
        } }
      : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Marketplace', item: `${BASE_URL}/marketplace` },
      { '@type': 'ListItem', position: 3, name: cardName, item: canonical },
    ],
  };

  const sellerHref = listing.seller?.store_slug ? `${BASE_URL}/dealer/${esc(listing.seller.store_slug)}` : null;
  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/marketplace">Marketplace</a> / ${esc(cardName)}</nav>
  <h1>${esc(cardName)}</h1>
  ${image ? `<img src="${esc(image)}" alt="${esc(cardName)}" />` : ''}
  ${price > 0
    ? `<p><strong>A$${esc(Number(price).toFixed(2))}</strong>${listing.accepts_offers ? ' (offers accepted)' : ''}</p>`
    : (listing.price_min_aud != null && listing.price_max_aud != null
      ? `<p><strong>Seeking offers: A$${esc(Number(listing.price_min_aud).toFixed(2))} – A$${esc(Number(listing.price_max_aud).toFixed(2))}</strong></p>`
      : '')}
  ${setLine ? `<p>${esc(setLine)}</p>` : ''}
  <ul>
    ${condition ? `<li>Condition: ${esc(condition)}</li>` : ''}
    ${grade ? `<li>Grade: ${esc(`${gradingCompany || ''} ${grade}`.trim())}</li>` : ''}
    <li>Seller: ${sellerHref ? `<a href="${sellerHref}">${esc(sellerName)}</a>` : esc(sellerName)}</li>
  </ul>
  ${listing.description ? `<p>${esc(listing.description)}</p>` : ''}
</main>`;

  return htmlDoc({ title, description, canonical, ogImage: image, jsonLdItems: [product, breadcrumb], bodyHtml });
}

async function renderShopProduct(supabase, id, slugParam) {
  if (!UUID_RE.test(id)) {
    return notFound({
      title: 'CardPop Shop',
      description: 'Shop official CardPop sealed products, singles and accessories.',
      canonical: `${BASE_URL}/shop`,
      bodyHtml: '<main><h1>CardPop Shop</h1></main>',
    });
  }

  const { data: product } = await supabase
    .from('shop_products')
    .select('id, title, description, price_aud, stock_quantity, category, product_type, images, image_url, status, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  const slug = product?.title ? slugify(product.title) : (slugParam || 'product');
  const canonical = `${BASE_URL}/product/shop/${id}/${slug}`;

  if (!product || product.status !== 'active') {
    return notFound({
      title: 'Product Unavailable | CardPop',
      description: 'This product is no longer available in the CardPop shop.',
      canonical,
      bodyHtml: '<main><h1>Product Unavailable</h1><p>This product is sold out or no longer listed.</p></main>',
    });
  }

  const name = product.title || 'Trading Card Product';
  const image = absUrl(product.images?.[0] || product.image_url);
  const price = product.price_aud;
  const inStock = product.stock_quantity == null || product.stock_quantity > 0;
  const description = product.description
    || `${name}${product.category ? ` — ${product.category}` : ''} available from the CardPop official store. Fast shipping across Australia.`;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(image ? { image } : {}),
    description: toText(description, 500),
    ...(product.category ? { category: product.category } : {}),
    brand: { '@type': 'Brand', name: 'CardPop' },
    ...(price > 0
      ? { offers: {
          '@type': 'Offer',
          price: Number(price).toFixed(2),
          priceCurrency: 'AUD',
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          url: canonical,
          seller: { '@type': 'Organization', name: 'CardPop' },
        } }
      : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${BASE_URL}/shop` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/shop">Shop</a> / ${esc(name)}</nav>
  <h1>${esc(name)}</h1>
  ${image ? `<img src="${esc(image)}" alt="${esc(name)}" />` : ''}
  ${price > 0 ? `<p><strong>A$${esc(Number(price).toFixed(2))}</strong> — ${inStock ? 'In stock' : 'Out of stock'}</p>` : ''}
  ${product.category ? `<p>${esc(product.category)}</p>` : ''}
  ${product.description ? `<p>${esc(toText(product.description, 600))}</p>` : ''}
</main>`;

  return htmlDoc({ title: `${name} | CardPop`, description: toText(description, 300), canonical, ogImage: image, jsonLdItems: [productLd, breadcrumb], bodyHtml });
}

// Exact-match landing/category pages. `source` selects the data set; the rest is copy.
const LANDINGS = {
  '/shop': {
    title: 'The Shop | CardPop', h1: 'The Card Shop', breadcrumb: 'Shop', source: 'shop',
    description: 'Shop official CardPop sealed products, singles and accessories. Fast shipping across Australia.',
    intro: 'Curated premium sealed boxes, rare singles, and exclusive drops sourced and verified by our experts.',
  },
  '/shop/sealed-boxes': {
    title: 'Sealed Boxes | CardPop Shop', h1: 'Sealed Boxes', breadcrumb: 'Sealed Boxes', source: 'shop', productType: 'sealed',
    description: 'Shop official sealed booster boxes and products. Fast shipping across Australia.',
    intro: 'Factory-sealed booster boxes and cases, sourced and verified by CardPop.',
  },
  '/shop/singles': {
    title: 'Singles | CardPop Shop', h1: 'Premium Singles', breadcrumb: 'Singles', source: 'shop', productType: 'single',
    description: 'Shop individual trading card singles from the CardPop official store. Find the exact card you need.',
    intro: 'Hand-picked individual cards from the CardPop official store.',
  },
  '/marketplace': {
    title: 'Buy & Sell Trading Cards Online Australia | CardPop Marketplace', h1: 'The Marketplace', breadcrumb: 'Marketplace', source: 'listings',
    description: 'Browse thousands of Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports cards listed by Australian sellers. Filter by game, grade, price and more. Free to list — buy and sell trading cards online in Australia.',
    intro: "Discover cards directly from other collectors' vaults alongside official CardPop listings.",
  },
};

async function renderLanding(supabase, path) {
  const cfg = LANDINGS[path];
  const canonical = `${BASE_URL}${path}`;

  let items = [];
  if (cfg.source === 'shop') {
    let q = supabase.from('shop_products').select('id, title, price_aud, images, image_url').eq('status', 'active');
    if (cfg.productType) q = q.eq('product_type', cfg.productType);
    const { data } = await q.order('created_at', { ascending: false }).limit(50);
    items = (data || []).map(p => ({
      name: p.title || 'Product',
      url: `${BASE_URL}/product/shop/${p.id}/${slugify(p.title || 'product')}`,
      price: p.price_aud,
      image: absUrl(p.images?.[0] || p.image_url),
    }));
  } else {
    const { data } = await supabase
      .from('listings')
      .select('id, slug, title, price_aud, vault_item:vault_items(card_name, card_image, vault_images(storage_path))')
      .eq('status', 'active')
      .neq('listing_type', 'vault')
      .order('created_at', { ascending: false })
      .limit(50);
    items = (data || []).map(l => {
      const imgPath = l.vault_item?.vault_images?.[0]?.storage_path || l.vault_item?.card_image;
      const image = publicImageUrl(imgPath);
      return {
        name: l.title || l.vault_item?.card_name || 'Trading Card',
        url: `${BASE_URL}/marketplace/${l.id}/${l.slug || 'listing'}`,
        price: l.price_aud,
        image,
      };
    });
  }

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cfg.title,
    description: cfg.description,
    url: canonical,
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: cfg.h1,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: cfg.breadcrumb, item: canonical },
    ],
  };

  const itemsHtml = items.map(it =>
    `    <li><a href="${esc(it.url)}">${esc(it.name)}</a>${it.price > 0 ? ` — A$${esc(Number(it.price).toFixed(2))}` : ''}</li>`
  ).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / ${esc(cfg.breadcrumb)}</nav>
  <h1>${esc(cfg.h1)}</h1>
  <p>${esc(cfg.intro)}</p>
  <ul>
${itemsHtml || '    <li>No items available right now.</li>'}
  </ul>
</main>`;

  return htmlDoc({ title: cfg.title, description: cfg.description, canonical, jsonLdItems: [collectionPage, itemList, breadcrumb], bodyHtml });
}

// Event category landing pages. `type` filters by the event_type enum using
// the SAME values the SPA passes (App.jsx defaultType) — when trade/store
// events rendered with type null they showed ALL events, making them exact
// duplicates of /events for crawlers (and different from what humans see).
const EVENT_CATEGORIES = {
  'card-shows':       { type: 'card_show',       h1: 'Trading Card Shows in Australia',       label: 'card shows' },
  'trade-events':     { type: 'trade_event',     h1: 'Trading Card Trade Events',             label: 'trade events' },
  'community-events': { type: 'community_event', h1: 'Trading Card Community Events',          label: 'community events' },
  'store-events':     { type: 'lgs_event',       h1: 'Trading Card Store Events',             label: 'store events' },
};

const eventDateLine = (ev) => {
  const start = ev.start_date;
  const end = ev.end_date && ev.end_date !== ev.start_date ? ev.end_date : null;
  if (!start) return '';
  return end ? `${start} – ${end}` : start;
};

const eventLocationLine = (ev) =>
  [ev.venue_name, ev.suburb, ev.state].filter(Boolean).join(', ');

// schema.org startDate/endDate — combine the date with a time when we have one.
// AEST offset matches lib/eventSeo.js; date-only values are also valid per spec.
const eventIsoDate = (date, time) => {
  if (!date) return undefined;
  return time ? `${date}T${time}+10:00` : date;
};

const EVENT_FIELDS =
  'id, slug, title, description, short_description, image_url, event_type, status, ' +
  'venue_name, address, suburb, state, postcode, start_date, end_date, start_time, end_time, ' +
  'entry_fee_aud, presale_fee_aud, is_free, website_url, ticket_url, youtube_url, organizer_name, seo_title, seo_description, ' +
  'created_at, updated_at';

// YouTube video id from any common URL shape — mirrors lib/eventSeo.js.
const youTubeVideoId = (url) => {
  if (!url) return null;
  const match = String(url).match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
};

// schema.org VideoObject for an event's YouTube video — video rich results.
// Google requires uploadDate; the closest truthful value we hold is when the
// listing was last updated (i.e. when the video link was added).
function buildEventVideoLd(event) {
  const id = youTubeVideoId(event.youtube_url);
  if (!id) return null;
  const name = event.title || 'Trading Card Event';
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${name} — Event Video`,
    description: toText(
      event.short_description || event.description
        || `Video for ${name}, a trading card event listed on CardPop Australia.`,
      500,
    ),
    thumbnailUrl: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    uploadDate: event.updated_at || event.created_at || event.start_date,
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}

// Full schema.org Event for a Supabase event record. Every field Google's
// event rich-result report checks (description, image, eventStatus, offers,
// organizer, performer, endDate) is always present, falling back to site-level
// defaults where the record has no data — Search Console flags each missing
// recommended field as an issue on every event page and landing-list item.
function buildEventLd(event) {
  const canonical = `${BASE_URL}/events/${event.slug || event.id}`;
  const name = event.title || 'Trading Card Event';
  const location = eventLocationLine(event);
  const when = eventDateLine(event);
  const description = toText(
    event.short_description || event.description
      || `${name}${location ? ` at ${location}` : ''}${when ? ` on ${when}` : ''} — a trading card event listed on CardPop Australia.`,
    500,
  );
  const organizerName = event.organizer_name || 'CardPop';
  const startDate = eventIsoDate(event.start_date, event.start_time);
  const endDate = eventIsoDate(event.end_date || event.start_date, event.end_time);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    image: [absUrl(event.image_url) || `${BASE_URL}/og-image.jpg`],
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    url: canonical,
    location: {
      '@type': 'Place',
      name: event.venue_name || location || 'Venue to be announced',
      address: {
        '@type': 'PostalAddress',
        ...(event.address ? { streetAddress: event.address } : {}),
        ...(event.suburb ? { addressLocality: event.suburb } : {}),
        ...(event.state ? { addressRegion: event.state } : {}),
        ...(event.postcode ? { postalCode: event.postcode } : {}),
        addressCountry: 'AU',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: organizerName,
      url: event.website_url || canonical,
    },
    // Card shows have no headline act, so the organising entity stands in as
    // the performing group (schema.org Event recommends a performer).
    performer: { '@type': 'Organization', name: organizerName },
    offers: buildEventOffers(event, canonical, startDate),
  };
}

// One Offer for the general-admission price, plus a second when a separate
// presale/early-bird price is known — or the presale Offer alone when the GA
// price hasn't been published yet (mirrors lib/eventSeo.js).
function buildEventOffers(event, canonical, startDate) {
  const mkOffer = (price, name) => ({
    '@type': 'Offer',
    price,
    priceCurrency: 'AUD',
    availability: 'https://schema.org/InStock',
    url: event.ticket_url || event.website_url || canonical,
    ...(event.created_at || startDate ? { validFrom: event.created_at || startDate } : {}),
    ...(name ? { name } : {}),
  });
  const presaleFee = Number(event.presale_fee_aud) > 0 ? Number(event.presale_fee_aud) : null;
  if (!presaleFee) {
    return mkOffer(event.is_free ? '0' : (Number(event.entry_fee_aud) > 0 ? Number(event.entry_fee_aud).toFixed(2) : '0'));
  }
  const presaleOffer = mkOffer(presaleFee.toFixed(2), 'Presale / early bird');
  const gaKnown = event.is_free || Number(event.entry_fee_aud) > 0;
  if (!gaKnown) return presaleOffer;
  return [mkOffer(event.is_free ? '0' : Number(event.entry_fee_aud).toFixed(2), 'General admission'), presaleOffer];
}

async function renderEventsLanding(supabase, categorySlug) {
  const cfg = categorySlug ? EVENT_CATEGORIES[categorySlug] : null;
  const canonical = categorySlug ? `${BASE_URL}/events/${categorySlug}` : `${BASE_URL}/events`;
  const today = new Date().toISOString().split('T')[0];

  let q = supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('status', 'approved')
    .gte('start_date', today);
  if (cfg?.type) q = q.eq('event_type', cfg.type);
  const { data } = await q.order('start_date', { ascending: true }).limit(100);
  const events = data || [];

  const h1 = cfg ? cfg.h1 : 'Trading Card Events in Australia';
  const title = cfg ? `${cfg.h1} | CardPop` : 'Trading Card Events, Shows & Expos in Australia | CardPop';
  const description = cfg
    ? `Upcoming ${cfg.label} for trading card collectors across Australia. Find dates, venues and details on CardPop.`
    : 'Find upcoming trading card shows, expos, tournaments and community events across Australia. Dates, venues and details for Pokémon, Magic, Yu-Gi-Oh and sports card collectors on CardPop.';

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Events', item: `${BASE_URL}/events` },
  ];
  if (cfg) breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: cfg.h1, item: canonical });
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbItems };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: h1,
    numberOfItems: events.length,
    itemListElement: events.map((ev, i) => {
      const { '@context': _c, ...item } = buildEventLd(ev);
      return { '@type': 'ListItem', position: i + 1, item };
    }),
  };

  const itemsHtml = events.map((ev) => {
    const when = eventDateLine(ev);
    const where = eventLocationLine(ev);
    return `    <li><a href="${BASE_URL}/events/${esc(ev.slug || ev.id)}"><strong>${esc(ev.title || 'Event')}</strong></a>`
      + `${when ? ` — ${esc(when)}` : ''}${where ? ` (${esc(where)})` : ''}</li>`;
  }).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/events">Events</a>${cfg ? ` / ${esc(cfg.h1)}` : ''}</nav>
  <h1>${esc(h1)}</h1>
  <p>${esc(description)}</p>
  <h2>Upcoming Events (${events.length})</h2>
  <ul>
${itemsHtml || '    <li>No upcoming events listed right now — check back soon.</li>'}
  </ul>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems: [breadcrumb, itemList], bodyHtml });
}

async function renderEvent(supabase, param) {
  const byUuid = UUID_RE.test(param);
  let query = supabase.from('events').select(EVENT_FIELDS);
  query = byUuid ? query.eq('id', param) : query.eq('slug', param);
  const { data: event } = await query.maybeSingle();

  if (!event || event.status !== 'approved') {
    return notFound({
      title: 'Event Not Found | CardPop',
      description: 'This event could not be found on CardPop.',
      canonical: `${BASE_URL}/events/${param}`,
      bodyHtml: '<main><h1>Event Not Found</h1><p>This event is not available.</p></main>',
    });
  }

  const canonical = `${BASE_URL}/events/${event.slug || event.id}`;
  const name = event.title || 'Trading Card Event';
  const image = absUrl(event.image_url);
  const location = eventLocationLine(event);
  const when = eventDateLine(event);
  const title = event.seo_title || `${name} | CardPop Events`;
  const description = event.seo_description || event.short_description
    || toText(event.description || '')
    || `${name}${location ? ` at ${location}` : ''}${when ? ` on ${when}` : ''} — a trading card event listed on CardPop Australia.`;

  const eventLd = { ...buildEventLd(event), description: toText(description, 500) };
  const videoLd = buildEventVideoLd(event);
  const videoId = youTubeVideoId(event.youtube_url);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Events', item: `${BASE_URL}/events` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  const feeLine = event.is_free ? 'Free entry' : (event.entry_fee_aud > 0 ? `Entry: A$${Number(event.entry_fee_aud).toFixed(2)}` : '');
  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/events">Events</a> / ${esc(name)}</nav>
  <h1>${esc(name)}</h1>
  ${image ? `<img src="${esc(image)}" alt="${esc(name)}" />` : ''}
  <ul>
    ${when ? `<li>Date: ${esc(when)}</li>` : ''}
    ${location ? `<li>Location: ${esc(location)}</li>` : ''}
    ${event.address ? `<li>Address: ${esc(event.address)}</li>` : ''}
    ${feeLine ? `<li>${esc(feeLine)}</li>` : ''}
    ${event.organizer_name ? `<li>Organiser: ${esc(event.organizer_name)}</li>` : ''}
  </ul>
  ${event.description ? `<p>${esc(toText(event.description, 800))}</p>` : ''}
  ${videoId ? `<p><a href="https://www.youtube.com/watch?v=${esc(videoId)}">Watch the event video</a></p>` : ''}
  ${event.website_url ? `<p><a href="${esc(event.website_url)}" rel="nofollow">Event website</a></p>` : ''}
</main>`;

  return htmlDoc({ title, description, canonical, ogImage: image, ogType: 'website', jsonLdItems: [eventLd, breadcrumb, ...(videoLd ? [videoLd] : [])], bodyHtml });
}

// Ranked local grader lists are shown identically on /grading/local-graders and
// /grading/submission-partners, so define them once and reuse.
const LOCAL_GRADERS_TCG = [
  { text: '1. Card Grading Australia (CGA), Australia-wide — Australia’s original grading service (est. 2012). 100-point internal system presented as a 1–10 scale. Accepts Pokémon, Yu-Gi-Oh, MTG, Dragon Ball and more.' },
  { text: '2. TCG Grading, Australia-wide — Est. 2021 with 100,000+ cards graded. Hand-illustrated custom labels, sub-grades and grader notes via serial lookup. ~40 business day standard turnaround.' },
  { text: '3. ARK Grading, Melbourne VIC — Science-backed grading with digital microscopes and x-ray fluorescence authentication. 20 business day max turnaround (premium). Australian submissions only.' },
  { text: '4. Alpha Card Grading (ACG), Australia-wide — AI-assisted centering analysis and a dual-reviewer process. Accepts Pokémon, One Piece, Dragon Ball and MTG.' },
  { text: '5. Premier Card Grading (PCG), Australia-wide — Competitive pricing ($25 authentication / $35 standard / $60 express). Accepts MTG, Pokémon, Flesh and Blood, Digimon, Dragon Ball and licensed sports cards.' },
];
const LOCAL_GRADERS_SPORTS = [
  { text: '1. Card Grading Australia (CGA), Australia-wide — Australia’s longest-running grader and a go-to for sports cards. Accepts AFL, NRL, NBA and vintage sports cards with strong local resale weight.' },
  { text: '2. TCG Grading, Australia-wide — The broadest sports acceptance of any local grader: NRL, AFL, NBA, FIFA and F1 alongside TCG. Custom labels and sub-grade lookup.' },
  { text: '3. Premier Card Grading (PCG), Australia-wide — Accepts modern licensed sports cards. Express option ($60, 5 business days) is among the fastest local sports turnarounds.' },
];
const WHY_LOCAL_BULLETS = [
  { text: 'Transparent criteria — published grading standards and sub-grades.' },
  { text: 'Tamper-evident slabs — protection that buyers and sellers trust.' },
  { text: 'Population reports — grade data helps price and market your card.' },
  { text: 'AUD pricing — no currency conversion surprises.' },
  { text: 'Community reputation — check Discord, r/pokemoncards and OzCardTrader for real feedback.' },
];
const WHY_LOCAL_PARA = 'Submitting to PSA or BGS directly from Australia adds real cost — international postage, insurance, customs duties and GST on return can add $30–$80+ AUD per parcel before grading fees. Local graders invoice in AUD, return cards in weeks not months, and their slabs carry growing recognition in the Australian secondary market.';
const LOCAL_DISCLAIMER = 'CardPop is not affiliated with any grading service or submission partner listed above. Rankings are editorial, based on publicly available information and community feedback. Always verify current pricing and turnaround times directly with the provider before submitting.';

// ---------------------------------------------------------------------------
// Static / mostly-static content pages.
//
// The SPA renders these entirely client-side, so non-JS crawlers see an empty
// shell — a prime cause of "Discovered – currently not indexed". Each entry
// below mirrors the human-visible copy of the corresponding React page so the
// bot-only document is equivalent to what users see (no cloaking). Keep these
// in sync when the underlying pages' copy changes.
// ---------------------------------------------------------------------------
const STATIC_CONTENT = {
  '/grading': {
    title: "Grading Hub | CardPop — Australia's Card Grading Resource",
    description: "Australia's go-to trading card grading resource. Compare PSA, BGS, CGC and ACE Grading, understand condition scales, and learn how to maximise the value of your collection.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }],
    h1: 'The Grading Handbook',
    intro: "An Australian collector's guide, from your very first raw card to a sealed, graded slab. Six chapters take you from curious beginner to confident submitter.",
    sections: [
      { h2: 'The chapters', items: [
        { text: '1. What is Card Grading? — start your journey', href: '/grading/what-is-grading' },
        { text: '2. Grading Scales Explained — learn the language', href: '/grading/scales' },
        { text: '3. Grading ROI Calculator — decide if it’s worth it', href: '/grading/roi-calculator' },
        { text: '4. Grade Estimator — preview your grade', href: '/grading/estimator' },
        { text: '5. Grading Companies — choose your grader', href: '/grading/companies' },
        { text: '6. Submit Locally with Trusted Graders — submit your cards', href: '/grading/submission-partners' },
      ] },
      { h2: 'Field notes for Australian collectors', items: [
        { text: 'Factor in the full cost — international grading (PSA, BGS, CGC) involves shipping, insurance, customs duties and GST on return; budget roughly $30–$60 AUD extra per parcel on top of grading fees.' },
        { text: 'Economy tiers save money — for less valuable cards, a bulk or economy submission still improves resale prices for a fraction of express costs.' },
        { text: 'Protect cards before submitting — use penny sleeves and toploaders every time, and double-sleeve for international post. One scratch in transit can drop a PSA 10 to a 9.' },
        { text: 'Check the pop report first — a high-population PSA 10 adds little premium over raw, while a low-pop 10 on a sought-after card can multiply its value.' },
      ] },
    ],
    faqs: [
      { q: 'Is card grading worth it in Australia?', a: 'For high-value cards — key vintage Pokémon, sports rookies, low-population chase cards — grading can increase resale value 2–10×. For common cards under $50, grading costs often exceed the value gain. The sweet spot is cards worth $80+ AUD raw.' },
      { q: 'Which grading company is best for Australian collectors?', a: 'For local convenience, ARK Grading is a Melbourne-based Australian service with AUD pricing, no customs and fast turnarounds. For cards destined for global resale, PSA has the highest market recognition and typically commands the largest price premiums.' },
      { q: 'How long does grading take from Australia?', a: 'Local Australian services offer fast turnarounds. For international services (PSA, BGS, CGC), allow 2–6 months door-to-door at economy tiers once you factor in shipping both ways, customs and grading queue times.' },
      { q: 'What cards should I grade?', a: 'Focus on cards that are rare, in near-perfect condition and have strong secondary-market demand. Key Pokémon, sports rookies and low-population vintage cards are the best candidates.' },
      { q: 'Can I grade cards at home?', a: 'You can self-assess using our grading scale guide to estimate a likely grade, but only submissions to professional third-party graders produce encapsulated, authenticated slabs that the market values.' },
    ],
    links: [{ text: 'Browse the Marketplace', href: '/marketplace' }],
  },

  '/grading/what-is-grading': {
    title: 'What is Card Grading? | CardPop Grading Hub',
    description: 'Discover what professional card grading is, how the authentication and encapsulation process works, and why Australian collectors are grading more cards than ever.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }, { name: 'What is Card Grading?', path: '/grading/what-is-grading' }],
    h1: 'What is Card Grading?',
    intro: 'Trading card grading is the process of submitting a raw (ungraded) card to an independent, third-party authentication company to verify its authenticity and evaluate its physical condition.',
    sections: [
      { h2: 'The grading process', items: [
        { text: 'Authentication — experts ensure the card is not counterfeit, altered or trimmed.' },
        { text: 'Evaluation — the card is graded on a 1–10 scale based on four attributes: centering, corners, edges and surface.' },
        { text: 'Encapsulation — the card is sealed in a tamper-evident slab with a label showing its details, grade and a unique certification number.' },
      ] },
      { h2: 'Why grade your cards?', items: [
        { text: 'Value protection & increase — high-grade cards consistently sell for significant premiums over raw copies.' },
        { text: 'Preservation — durable, UV-resistant slabs protect against handling damage, moisture and wear.' },
        { text: 'Authenticity guarantee — encapsulation removes doubt that a card is fake or altered.' },
        { text: 'Liquidity — a documented condition rating lets collectors trade online with confidence.' },
      ] },
      { h2: 'The four grading pillars', items: [
        { text: 'Centering — the ratio of borders on opposite sides. A PSA 10 typically needs 55/45 or better on the front.' },
        { text: 'Corners — examined under magnification; any fraying, wear or rounding reduces the grade.' },
        { text: 'Edges — checked for nicks, chips or roughness from handling, packs or storage.' },
        { text: 'Surface — scratches, print lines, stains, creases and indentations are checked front and back under light.' },
      ] },
      { h2: 'How to submit your cards (Australia)', items: [
        { text: 'Choose a grading company — a local Australian service for AUD pricing and no customs, or PSA for the most globally recognised resale value.' },
        { text: 'Assess your cards first — self-grade using our Grading Scales page, and only submit cards you believe will achieve a 7 or higher.' },
        { text: 'Package cards correctly — penny sleeve, toploader, team bag; add a rigid layer in a bubble mailer for international posts, and insure the parcel.' },
        { text: 'Fill out a submission form — most graders require an online form first; declare the value accurately for customs and insurance.' },
        { text: 'Wait for your slabs — track via the grader’s portal; allow local turnarounds of weeks or international economy of 60–150 days plus shipping.' },
        { text: 'List on CardPop Marketplace — once slabs arrive, list with the grade and cert number; graded cards sell faster and for more.' },
      ] },
    ],
    links: [{ text: 'View Grading Scales', href: '/grading/scales' }, { text: 'Compare Companies', href: '/grading/companies' }, { text: 'Back to Grading Hub', href: '/grading' }],
  },

  '/grading/scales': {
    title: 'Trading Card Grading Scales 1–10 | CardPop Grading Hub',
    description: "Understand the PSA, BGS, CGC and ACE trading card grading scales from 1 to 10. Learn exactly what each grade means and how condition affects your card's resale value in Australia.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }, { name: 'Grading Scales', path: '/grading/scales' }],
    h1: 'Grading Scales',
    intro: "While most authenticators use a 1 to 10 scale, the exact definitions and tolerances for a 'Gem Mint' card differ slightly between companies — PSA, BGS (with subgrades), CGC and ACE.",
    sections: [
      { h2: 'The universal 1–10 scale', items: [
        { text: '10 — Gem Mint / Pristine: virtually flawless, with perfect or near-perfect centering, sharp focus, clean edges and intact corners under magnification.' },
        { text: '9 — Mint: superb condition with only one very minor flaw, such as a slight printing imperfection or slightly off-white borders.' },
        { text: '8 — Near Mint–Mint: appears Mint at a glance but reveals minor flaws on close inspection, like slight corner wear or centering issues.' },
        { text: '7 — Near Mint: slight surface wear or a minor printing defect; corners may show slight fraying but focus remains sharp.' },
        { text: '5–6 — Excellent to EX-MT: visible surface wear, minor scratching or loss of gloss, with clear but moderate edge and corner wear.' },
        { text: '1–4 — Poor to Very Good: heavily handled, with creasing, severe corner wear, scuffing or staining, though the core image remains visible.' },
      ] },
      { h2: 'Tips for maximising your grade', items: [
        { text: 'Handle cards by the edges only — fingerprints and skin oils cause visible surface damage.' },
        { text: 'Use penny sleeves immediately after pulling — even pack-fresh cards pick up micro-scratches.' },
        { text: 'Store vertically in a hard case — avoid pressure or bending that causes edge and corner wear.' },
        { text: 'Check centering before submitting — it is the most common reason PSA 10s become PSA 9s.' },
        { text: 'Clean only with a soft microfibre cloth — never paper towels or tissues.' },
      ] },
    ],
    links: [{ text: 'Compare Grading Companies', href: '/grading/companies' }, { text: 'Back to Grading Hub', href: '/grading' }],
  },

  '/grading/companies': {
    title: 'Grading Companies Australia — PSA, BGS, CGC, ACE | CardPop Grading Hub',
    description: 'Compare the best trading card grading companies for Australian collectors. PSA, BGS, CGC, and ACE Grading — turnaround times, AUD pricing, and which service is right for you.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }, { name: 'Grading Companies', path: '/grading/companies' }],
    h1: 'Grading Companies',
    intro: 'Compare the top third-party grading services like PSA, BGS, CGC and ACE. Learn their histories, scales and specialised features, and find the Australian submission partners who handle shipping and customs for you.',
    sections: [
      { h2: 'Beckett (BGS) submission partners', paras: ['Beckett provides four sub-scores (centering, corners, edges, surface) alongside an overall grade, and is especially popular for high-value sports and premium TCG chases. These Australian partners handle packaging, international shipping and customs on your behalf.'], items: [
        { text: 'Cherry Collectables — Australia’s exclusive Beckett submission partner, with Melbourne drop-off or mail-in.' },
        { text: 'Graded Cards Australia — authorised BGS partner; cards appear in the official BGS Population Report. Accepts AFL, NBA and Pokémon.' },
        { text: 'SLABD — fully insured Beckett submission handling all international shipping and customs.' },
        { text: 'Slabbys — BGS submission with four tiers from Base ($45) to Priority ($500), sub-grades included, fully tracked and insured.' },
        { text: 'The Card Spot — monthly BGS batch submissions dispatched the first week of each month.' },
      ] },
      { h2: 'PSA submission partners', paras: ['PSA is the world’s most recognised grading company and typically commands the highest resale premiums, especially for US-market sales. These authorised Australian dealers handle shipping, insurance, customs and tracking so you deal in AUD only.'], items: [
        { text: 'The Hobby — Australia’s first PSA Certified Dealer in the Southern Hemisphere (since 2016). Grades TCG and sports including AFL and Pokémon.' },
        { text: 'Slabbys — full-service PSA & Beckett submission with 7-stage tracking, fully insured, 12 PSA tiers from Value Bulk ($48).' },
        { text: 'SLABD — Australian-based, fully insured PSA and BGS submission with clear tiered pricing.' },
        { text: 'Cherry Collectables — PSA submission with Melbourne drop-off or mail-in; accepts TCG and AFL/sports.' },
        { text: 'Mana Market — Gold Coast-based PSA Registered Dealer, ideal for Queensland collectors, with in-store drop-off.' },
      ] },
      { h2: 'Quick comparison', items: [
        { text: 'PSA — best for Pokémon and sports; 20–150 days; from about $25 USD.' },
        { text: 'BGS — best for all TCG and vintage; 15–90 days; from about $22 USD.' },
        { text: 'CGC — best for all TCG; 10–60 days; from about $15 USD.' },
        { text: 'ARK — best for AU collectors; local turnaround; AUD pricing.' },
      ] },
    ],
    links: [{ text: 'Submit Locally with Trusted Graders', href: '/grading/submission-partners' }, { text: 'Back to Grading Hub', href: '/grading' }],
  },

  '/grading/local-graders': {
    title: 'Local Card Graders Australia — TCG & Sports Cards Ranked | CardPop',
    description: 'Ranked Australian card grading services for TCG and sports cards. AUD pricing, no customs, faster turnarounds than PSA or Beckett. Compare CGA, TCG Grading, ARK Grading, ACG, and PCG.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }, { name: 'Local Graders', path: '/grading/local-graders' }],
    h1: 'Submit Locally with Trusted Graders',
    intro: 'Ranked Australian grading services for TCG and sports cards — AUD pricing, no customs, and faster returns than international submissions.',
    sections: [
      { h2: 'Australian local graders — TCG', paras: ['These companies grade and encapsulate entirely within Australia. Ranked for TCG cards (Pokémon, MTG, Yu-Gi-Oh, Dragon Ball, One Piece and more).'], items: LOCAL_GRADERS_TCG },
      { h2: 'Australian local graders — sports cards', paras: ['Ranked for sports cards — AFL, NRL, NBA, cricket, FIFA and F1 — where domestic buyer recognition often matters more than international PSA premiums.'], items: LOCAL_GRADERS_SPORTS },
      { h2: 'Why grade locally in Australia?', paras: [WHY_LOCAL_PARA], items: WHY_LOCAL_BULLETS },
      { h2: 'Disclaimer', paras: [LOCAL_DISCLAIMER] },
    ],
    links: [{ text: 'How to submit your cards', href: '/grading/submission-partners' }, { text: 'Back to Grading Hub', href: '/grading' }],
  },

  '/grading/submission-partners': {
    title: 'Submission Partners — Australian Card Grading Services | CardPop',
    description: 'Trusted Australian card grading submission partners for TCG and sports cards. AUD pricing, no customs, faster turnarounds than PSA or Beckett. Compare CGA, TCG Grading, ARK Grading, ACG, and PCG.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }, { name: 'Submission Partners', path: '/grading/submission-partners' }],
    h1: 'Submission Partners',
    intro: 'Trusted Australian grading services for TCG and sports cards — AUD pricing, no customs hassle, and faster returns than international submissions.',
    sections: [
      { h2: 'How to submit', items: [
        { text: 'Choose your grader — pick a partner below based on card type, turnaround and budget, and check their site for current pricing and submission windows.' },
        { text: 'Prepare your cards — sleeve each card in a penny sleeve then a toploader or semi-rigid holder; handle by the edges only and never submit cards loose.' },
        { text: 'Ship securely — use a rigid outer box with bubble wrap, mark "Do Not Bend", insure for the estimated value and keep your tracking number.' },
        { text: 'Receive your slabs — most local partners return graded cards within 2–8 weeks; check for slab damage on arrival before listing or storing.' },
      ] },
      { h2: 'Australian partners — TCG', items: LOCAL_GRADERS_TCG },
      { h2: 'Australian partners — sports cards', items: LOCAL_GRADERS_SPORTS },
      { h2: 'Why submit locally in Australia?', paras: [WHY_LOCAL_PARA], items: WHY_LOCAL_BULLETS },
      { h2: 'Disclaimer', paras: [LOCAL_DISCLAIMER] },
    ],
    links: [{ text: 'Compare Grading Companies', href: '/grading/companies' }, { text: 'Back to Grading Hub', href: '/grading' }],
  },

  '/grading/estimator': {
    title: "Card Grade Estimator | CardPop — AI Grading Guide for Australian Collectors",
    description: 'Upload photos of your trading card and get AI-powered preliminary grade estimates across PSA, BGS, CGC, ACE, and SGC. A guide only — always consult a professional grader.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }, { name: 'Grade Estimator', path: '/grading/estimator' }],
    h1: 'Grade Estimator',
    intro: 'Upload photos of your trading card and receive AI-generated preliminary grade estimates across five major grading services. A guide to help you self-assess before professional submission.',
    sections: [
      { h2: 'Preliminary estimate only', paras: ['This tool provides AI-generated grade estimates as a preliminary guide only. Results may vary significantly from professional grades. Always examine your card physically and consult a qualified grading professional before submitting. CardPop Australia accepts no liability for actual grades returned or any financial outcome.'] },
      { h2: 'How it works', items: [
        { text: 'Upload photos — clear, well-lit images of the card front and (optionally) back.' },
        { text: 'AI analysis — the tool examines centering, corners, edges and surface against each company’s standards.' },
        { text: 'Review estimates — receive preliminary grades across PSA, BGS, CGC, ACE and SGC alongside a condition breakdown.' },
      ] },
      { h2: 'Grading services covered', items: [
        { text: 'PSA — Professional Sports Authenticator.' },
        { text: 'BGS — Beckett Grading Services.' },
        { text: 'CGC — Certified Guaranty Company.' },
        { text: 'ACE — ACE Grading (Australia).' },
        { text: 'SGC — Sportscard Guaranty Corporation.' },
      ] },
    ],
    links: [{ text: 'Grading Scales', href: '/grading/scales' }, { text: 'Compare Companies', href: '/grading/companies' }, { text: 'Local Graders (AU)', href: '/grading/local-graders' }],
  },

  '/grading/roi-calculator': {
    title: 'Grading ROI Calculator | CardPop — Is It Worth Grading?',
    description: 'Calculate the probability-weighted return on investment before grading your trading cards. Factor in live eBay prices, PSA/BGS/ACE fees, shipping, and gem-mint rates.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Grading', path: '/grading' }, { name: 'ROI Calculator', path: '/grading/roi-calculator' }],
    h1: 'Grading ROI Calculator',
    intro: 'Enter a card, plug in your costs, and get a probability-weighted expected return — powered by live eBay AU sold data.',
    sections: [
      { h2: 'How it works', paras: ['Expected net profit = (Grade-10 price × gem rate %) + (Grade-9 price × nine rate %) − (raw cost + grading fee + shipping). Prices are pulled live from eBay AU listings; adjust the grade-probability sliders to match your card’s known gem rate.'] },
      { h2: 'Finding the best growth areas', items: [
        { text: 'Raw-to-graded spread ≥ 3–4× — if a PSA 10 only sells for 2× the raw price, fees and shipping eat most of the margin.' },
        { text: 'Low population report — a card with only 50 PSA 10s on record is far more valuable than one with 50,000; high populations suppress premiums.' },
        { text: 'Strong secondary-market demand — key rookies, chase alt-arts, vintage holos and low-numbered parallels hold graded premiums best.' },
        { text: 'Card must be raw-gem quality — centering, surface scratches and print defects matter enormously; only grade cards that are visually pristine.' },
      ] },
    ],
    links: [{ text: 'Compare Grading Companies', href: '/grading/companies' }, { text: 'Back to Grading Hub', href: '/grading' }],
  },


  '/launch': {
    title: "CardPop — Australia's Trading Card Marketplace | Launching Late 2026",
    description: "CardPop is launching late 2026: buy, sell and trade Pokémon, Magic and sports cards on Australia's new trading card marketplace. Join the launch list to be first in.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Launch', path: '/launch' }],
    h1: "Australia's new home for trading cards is almost here.",
    intro: 'Buy, sell and trade Pokémon, Magic: The Gathering and sports cards with collectors you can trust — backed by live Australian market prices. Join the launch list to be first in when we open the doors, late 2026.',
    sections: [
      { h2: "What's coming", items: [
        { text: 'Buy, sell & trade — a trusted Australian marketplace for Pokémon, Magic, sports cards and more.' },
        { text: 'Collection vault — track every card you own, with photos, conditions and live values in one place.' },
        { text: 'Live AU market prices — real Australian sold prices and market trends, not overseas guesswork.' },
        { text: 'Community & events — find local card shows, traders and collectors right across Australia.' },
      ] },
    ],
    links: [{ text: 'About CardPop', href: '/about' }],
  },

  '/about': {
    title: "About CardPop™ | Australia's Trading Card Marketplace",
    description: "Learn about CardPop™ Australia — Australia's premier platform for buying, selling and trading Pokemon, Magic and sports cards.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }],
    h1: 'The card show that never closes.',
    intro: 'Every collector remembers the moment the hobby truly clicked. CardPop™ was built to recreate the trust, excitement and community of card shows — online, every day of the year.',
    sections: [
      { h2: 'Our story', paras: [
        'For our founder, the hobby clicked at his first card show. The energy was unlike anything else — collectors swapping stories, making deals with a handshake, helping newcomers, celebrating each other’s pickups and vouching for people without hesitation. It wasn’t just about buying and selling cards; it was about being part of a community built on trust.',
        'Outside those shows, that feeling didn’t always exist online. Collectors were left searching Facebook groups and Discord servers for vouches before every trade, hoping the other person was genuine. For high-value cards, that uncertainty can stop great deals from ever happening. So CardPop™ was built to bring the trust, excitement and community of card shows online. “Collecting deserved better.” — Reece Conway, Founder, CardPop™ Australia, Melbourne, Victoria.',
      ] },
      { h2: 'More than a marketplace', items: [
        { text: 'Market insights — discover pricing data and follow market trends as they move.' },
        { text: 'Grading & resources — learn the hobby through grading guides and educational resources.' },
        { text: 'Collection tracking — track your collection and research cards, all in one place.' },
        { text: 'A real community — connect with a growing community that shares the same passion.' },
      ] },
      { h2: 'What we believe', items: [
        { text: 'The hobby is strongest when collectors trust one another.' },
        { text: 'Knowledge should be shared, not hidden.' },
        { text: 'Every collector deserves a safe, transparent place to buy and sell.' },
        { text: 'Community is more important than transactions.' },
        { text: 'Collecting should be fun, rewarding and welcoming for everyone.' },
      ] },
      { h2: 'Built in Melbourne, built for collectors', paras: [
        'CardPop™ was founded in Melbourne by a collector who wanted the online hobby to feel more like the card shows that inspired it. We’re collectors first, and that philosophy guides every decision we make — helping collectors spend less time worrying about who they can trust, and more time enjoying the hobby they love.',
      ] },
      { h2: 'The card show that never closes', paras: [
        'A trusted place where collectors can buy, sell, learn, discover and connect — every day of the year. Whether you’re searching for your first rookie card, completing a lifelong collection or simply enjoying the journey, we’re grateful you’ve found us. Welcome to CardPop™.',
      ] },
    ],
    links: [{ text: 'Explore the Marketplace', href: '/marketplace' }, { text: 'Join the Community', href: '/community' }],
  },

  '/contact': {
    title: 'Contact Us | CardPop',
    description: "Get in touch with the CardPop team. We're here to help with buying, selling, trading and grading questions.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }],
    h1: 'Contact Us',
    intro: "We're here to help. Send us a message and we'll respond as soon as possible.",
    sections: [
      { h2: 'Get in touch', paras: [
        'Whether you have a question about an order, need help with your vault, or just want to share feedback, our team is ready to assist you.',
      ], items: [
        { text: 'Email support: support@cardpop.com.au' },
        { text: 'Admin: admin@cardpop.com.au' },
        { text: 'Mailing address: PO Box 1024, Ascot Vale, Victoria 3032' },
        { text: 'Business hours: Monday to Friday, 9am – 5pm AEST' },
      ] },
    ],
  },

  '/faq': {
    title: 'FAQ | CardPop™ Australia — Trading Card Marketplace',
    description: "Answers to common questions about buying, selling and trading on CardPop™ — Australia's trusted trading card marketplace. Learn about fees, the Vault, trades, and payments.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }],
    h1: 'Frequently Asked Questions',
    intro: 'Find answers to common questions about buying, selling, and vaulting on CardPop™.',
    faqs: [
      { q: 'How does the CardPop™ Vault work?', a: 'The Vault is our secure storage facility. When you buy a card, you can choose to send it to your Vault instead of your home. This lets you instantly relist the card for sale without paying shipping fees, or hold it securely as an investment.' },
      { q: 'What are the selling fees on CardPop™?', a: 'We charge a flat 8% commission on all successful sales. There are no listing fees. If you sell an item directly from your Vault, the commission is reduced to 6%.' },
      { q: 'How do I get paid when I sell an item on CardPop™?', a: 'Funds from successful sales are added to your CardPop™ Wallet balance. You can use this balance to purchase other items on the platform, or withdraw it to your nominated bank account at any time.' },
      { q: 'Are trades protected on CardPop™?', a: 'Yes. When you agree to a trade, both parties send their items to our authentication center. We verify the condition and authenticity of all items before forwarding them to their final destinations.' },
    ],
  },

  '/safe-buying': {
    title: "Safe Buying — Australia's Safest Place to Buy Trading Cards | CardPop™",
    description: 'Buy Pokémon, Magic and sports cards safely in Australia. CardPop protects every order with secure Stripe payments (PCI-DSS), ID-verified sellers via Stripe Identity, and a 14-day Buyer Protection Guarantee.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Safe Buying', path: '/safe-buying' }],
    h1: 'Why CardPop Is Safe: Buyer Protection & Secure Payments',
    intro: 'Buying trading cards online should never feel like a gamble. CardPop™ is built to be Australia’s safest place to buy Pokémon, Magic: The Gathering, Yu-Gi-Oh! and sports cards — every order is paid securely, backed by buyer protection, and handled by identity-verified members.',
    sections: [
      { h2: 'Every payment is secure', paras: [
        'All purchases are processed by Stripe, a globally certified PCI-DSS Level 1 payment provider. Your card details are entered on Stripe’s encrypted checkout and never touch CardPop’s servers. You can pay with Visa, Mastercard, American Express, PayPal, Afterpay, Apple Pay, Google Pay or Stripe Link, all in Australian dollars — and CardPop memberships can also be billed securely through PayPal.',
      ] },
      { h2: 'Buyer protection on every order', paras: [
        'Every purchase is backed by our 14-day Buyer Protection Guarantee. If your item doesn’t arrive within the expected timeframe, or is significantly not as described, you can request a full refund through our resolution process. You’re never left out of pocket for an order that goes wrong.',
      ] },
      { h2: 'You only trade with verified people', paras: [
        'What makes CardPop safer than open marketplaces and social-media groups is that real, verified people stand behind every account. Sellers confirm their identity with a government-issued ID and a matching selfie through Stripe Identity before they can sell. Verified accounts carry a Verified badge, so you always know who you’re buying from — and fraudsters and throwaway accounts have nowhere to hide.',
      ] },
      { h2: 'Authentication for high-value cards', paras: [
        'For high-value cards and trades, we offer middleman authentication: items ship to our facility where experts verify authenticity and condition before forwarding to the buyer. Both sides transact with total confidence.',
      ] },
      { h2: 'How to buy safely on CardPop', items: [
        { text: 'Buy from verified sellers — look for the Verified badge on seller profiles.' },
        { text: 'Pay through CardPop’s Stripe checkout — never send money off-platform, so your Buyer Protection always applies.' },
        { text: 'Use authentication for big-ticket cards — add middleman authentication for peace of mind on high-value purchases.' },
        { text: 'Keep communication on-platform — it keeps a record and keeps you protected.' },
      ] },
    ],
    faqs: [
      { q: 'Is CardPop a safe place to buy trading cards?', a: 'Yes. Every order is paid through Stripe’s PCI-DSS Level 1 checkout, backed by a 14-day Buyer Protection Guarantee, and sellers are identity-verified through Stripe Identity — so you buy Pokémon, Magic and sports cards from real, verified Australian sellers with a full refund if anything goes wrong.' },
      { q: 'Where is the safest place to buy Pokémon cards in Australia?', a: 'CardPop is built specifically for safe trading-card transactions in Australia: secure Stripe payments in AUD, ID-verified sellers, buyer protection on every order, and optional middleman authentication for high-value cards — protections general marketplaces and social-media groups don’t offer.' },
      { q: 'What if my card never arrives or isn’t as described?', a: 'You’re covered by our 14-day Buyer Protection Guarantee. Open a case through our resolution process and, if the item didn’t arrive or was significantly not as described, you’ll receive a full refund.' },
      { q: 'How do I know the seller is genuine?', a: 'Sellers verify their identity with a government ID and a matching selfie through Stripe Identity before they can sell. Verified accounts carry a Verified badge, so you’re never trading with an anonymous or throwaway account.' },
      { q: 'Are my payment details secure?', a: 'Yes. Payments are processed entirely on Stripe’s encrypted, PCI-DSS-compliant checkout. Your card details are never stored on or transmitted through CardPop’s servers.' },
    ],
    links: [
      { text: 'Read our Trust & Safety policy', href: '/trust-safety' },
      { text: 'Browse the Marketplace', href: '/marketplace' },
      { text: 'Create your verified account', href: '/signup' },
    ],
  },

  '/privacy-policy': {
    title: 'Privacy Policy | CardPop',
    description: "CardPop's privacy policy — how we collect, use and protect your personal information on our Australian trading card marketplace.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Privacy Policy', path: '/privacy-policy' }],
    h1: 'Privacy Policy',
    intro: 'Your trust is our top priority. Learn how we handle your data with transparency, care, and industry-leading security. Effective 14 May 2026.',
    sections: [
      { h2: '1. Introduction', paras: ['CardPop respects your privacy and is committed to protecting personal data. This policy explains how we collect, use, disclose and safeguard information when you use the platform, digital vault, or trading marketplace.'] },
      { h2: '2. Information we collect', paras: ['Personal identification (name, email, address, phone), payment information (card details, billing address and transaction history via our payment partners), browsing data (IP, browser, device identifiers, pages visited), and communication data (records of support and member interactions).'] },
      { h2: '3. How we use your information', paras: ['To deliver the service (manage your account, process orders, facilitate trades and support), improve the platform, send marketing and updates only with consent, prevent fraud, and comply with legal obligations.'] },
      { h2: '4. Data sharing and disclosure', paras: ['We do not sell personal data. We share it only with service providers (such as Stripe for payments and shipping carriers), where legally required, in a business transfer, or with your explicit consent.'] },
      { h2: '5. Data security', paras: ['Sensitive data is encrypted in transit via TLS and protected with role-based access controls. No method of internet transmission or storage is 100% secure.'] },
      { h2: '6. Your privacy rights', paras: ['You have rights to access and correct your data, request deletion (right to be forgotten), opt out of marketing, and request data portability. To exercise these rights, contact privacy@cardpop.com.'] },
      { h2: '7. Cookies and tracking technologies', paras: ['We use essential cookies required for the site to function and analytical cookies to understand interactions. Your browser can refuse cookies, though some functionality may be unavailable if essential cookies are declined.'] },
      { h2: '8. Third-party links and services', paras: ['The service may link to sites not operated by CardPop. We encourage you to review those sites’ privacy policies; we assume no responsibility for third-party content or practices.'] },
      { h2: "9. Children's privacy", paras: ['CardPop does not knowingly collect information from anyone under 18; the platform is intended for adult collectors and traders. Any minor data discovered is removed.'] },
      { h2: '10. International data transfers', paras: ['Your information may be transferred to and maintained on computers outside your jurisdiction. For EEA/UK users we ensure GDPR compliance using standard contractual clauses and compliant infrastructure partners.'] },
      { h2: '11. Data retention', paras: ['We retain personal data only as long as necessary for the stated purposes and to meet legal obligations. Account data is typically deleted within 30 days of a formal deletion request, barring disputes or legal holds.'] },
      { h2: '12. Contact us', paras: ['Privacy: privacy@cardpop.com. Support: support@cardpop.com. We aim to respond within 48–72 business hours.'] },
    ],
  },

  '/terms': {
    title: 'Terms of Service | CardPop™',
    description: "CardPop™'s terms of service — the rules and guidelines for using the platform.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Terms of Service', path: '/terms' }],
    h1: 'Terms of Service',
    intro: 'The rules and guidelines for using the CardPop™ platform. Last updated 10 May 2026.',
    sections: [
      { h2: '1. Acceptance of terms', paras: ['By accessing or using CardPop™, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.'] },
      { h2: '2. User accounts', paras: ['You must be at least 18 years old to create an account. You are responsible for keeping your credentials confidential and for all activity under your account.'] },
      { h2: '3. Marketplace rules', paras: ['Users must provide accurate descriptions and images of listed items. CardPop™ may remove listings that violate policies or appear fraudulent.'] },
      { h2: '4. Fees and payments', paras: ['CardPop™ charges fees for certain services, including sales commissions. All fees are shown before you commit to a transaction, and you agree to pay all applicable fees.'] },
      { h2: '5. Limitation of liability', paras: ['CardPop™ is a marketplace facilitator and is not responsible for the actions of individual users, though it provides protection programs under its Trust & Safety policy.'] },
    ],
  },

  '/returns': {
    title: 'Returns & Refund Policy | CardPop',
    description: "CardPop's full refund policy — fee retention, eligible reasons, timelines, and how to request a refund on a marketplace purchase.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Returns & Refunds', path: '/returns' }],
    h1: 'Returns & Refunds',
    intro: 'How CardPop handles refunds, what fees are retained, and how to request a return.',
    sections: [
      { h2: 'Overview', paras: ['Buyer protection applies to all marketplace purchases. Request a refund within 30 days of purchase through your account. Requests are reviewed within 2 business days; if approved, the refund is issued to your original payment method.'] },
      { h2: 'Platform fee retention on refunds', paras: ['When a refund is issued, 50% of the platform fee is non-refundable (it covers Stripe processing costs CardPop can’t recover). The other 50% of the fee plus the full item price is returned. Example — on a $100 sale with a $3 platform fee: $100.00 item price refunded, $1.50 (50% of the fee) refunded, $1.50 retained, for $101.50 AUD returned. This policy is shown before every purchase.'] },
      { h2: 'Eligible refund reasons', items: [
        { text: 'Item not received within a reasonable timeframe.' },
        { text: 'Item significantly not as described (wrong card or wrong condition grade).' },
        { text: 'Item arrived damaged in transit (photo evidence of packaging required).' },
        { text: 'Item proven counterfeit.' },
        { text: 'Seller cancelled the order after payment.' },
      ] },
      { h2: 'Non-eligible reasons', items: [
        { text: 'Change of mind or buyer’s remorse.' },
        { text: 'Market price fluctuations after purchase.' },
        { text: 'Minor subjective condition discrepancies on raw (ungraded) cards.' },
        { text: 'Requests made more than 30 days after purchase.' },
      ] },
      { h2: 'How to request a refund', paras: ['Go to My Account → Orders, find the order and click Request Refund, select the reason and provide details or photos. CardPop reviews within 2 business days and notifies you by email and in-app. If approved, the refund is issued via Stripe and takes 5–10 business days to appear.'] },
      { h2: 'Seller obligations', paras: ['Sellers must accurately describe item condition and grade. If a refund is approved due to misrepresentation, the seller’s proceeds may be clawed back at CardPop’s discretion; repeat violations may result in account suspension.'] },
      { h2: 'Disputes', paras: ['If buyer and seller can’t resolve an issue directly, contact CardPop support with the order number and evidence. The team mediates and makes a binding decision within 5 business days.'] },
    ],
  },

  '/shipping': {
    title: 'Shipping Information | CardPop',
    description: "Learn about CardPop's shipping policies, rates and delivery times for Australian orders.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Shipping', path: '/shipping' }],
    h1: 'Shipping Information',
    intro: 'Everything you need to know about how we deliver your cards safely.',
    sections: [
      { h2: 'Domestic shipping (Australia)', items: [
        { text: 'Standard Tracked: $8.95 (3–5 business days).' },
        { text: 'Express Tracked: $12.95 (1–2 business days).' },
        { text: 'Signature Required: additional $2.95 (recommended for high-value items).' },
      ] },
      { h2: 'International shipping', paras: ['We currently ship to New Zealand, the USA, Canada and the UK. International rates are calculated at checkout based on weight and destination.'] },
      { h2: 'Packaging standards', paras: ['Single cards are shipped in a penny sleeve, top loader and team bag, secured between rigid cardboard to prevent bending. Graded cards are shipped in protective sleeves with bubble wrap.'] },
      { h2: 'Vault transfers', paras: ['Items purchased and sent directly to your CardPop Vault incur zero shipping fees. You only pay shipping when you request a physical withdrawal from your vault.'] },
    ],
  },

  '/trust-safety': {
    title: 'Trust & Safety | CardPop™',
    description: "CardPop™'s trust and safety policies — how we protect buyers and sellers in the Australian trading card community.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Trust & Safety', path: '/trust-safety' }],
    h1: 'Trust & Safety',
    intro: 'How we protect every buyer and seller in our community.',
    sections: [
      { h2: 'Buyer protection', paras: ['Payments are processed securely through Stripe, and every order is backed by a 14-day Buyer Protection Guarantee. If an item doesn’t arrive in the expected timeframe or is significantly not as described, you can request a full refund through the resolution process.'] },
      { h2: 'Seller protection', paras: ['Sellers are protected against fraudulent chargebacks and false claims, provided they ship to the verified address with tracking and signature confirmation.'] },
      { h2: 'Authentication services', paras: ['For high-value items and trades we offer middleman authentication — items are shipped to CardPop’s facility where experts verify authenticity and condition before forwarding to the buyer.'] },
      { h2: 'Community guidelines', paras: ['We have a zero-tolerance policy for fraud, harassment and market manipulation. Violators are permanently banned from the platform.'] },
    ],
    links: [
      { text: 'How to buy safely on CardPop', href: '/safe-buying' },
      { text: 'Browse the Marketplace', href: '/marketplace' },
    ],
  },

  '/accessibility': {
    title: 'Accessibility | CardPop',
    description: "CardPop's commitment to making our trading card marketplace accessible to everyone.",
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Accessibility', path: '/accessibility' }],
    h1: 'Accessibility Statement',
    intro: 'Our commitment to making CardPop accessible to everyone.',
    sections: [
      { h2: 'Our commitment', paras: ['CardPop is committed to ensuring digital accessibility for people with disabilities. We continually improve the experience and apply relevant accessibility standards.'] },
      { h2: 'Conformance status', paras: ['The WCAG defines requirements to improve accessibility for people with disabilities. CardPop strives to be conformant with WCAG 2.1 level AA.'] },
      { h2: 'Feedback', paras: ['We welcome feedback on accessibility. Report barriers via accessibility@cardpop.com.au. We try to respond within 2 business days.'] },
    ],
  },

  '/community': {
    title: 'Community Hub | CardPop',
    description: 'Connect with Australian trading card collectors. Join discussions, share your collection and trade cards on CardPop.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Community', path: '/community' }],
    h1: "The Collector's Hub",
    intro: 'Discuss market trends, connect with verified collectors, and discover authorized retailers shaping the hobby.',
    sections: [
      { h2: 'List free for 30 days', paras: ['List and sell cards completely free for 30 days, no card required. Join Australia’s fastest-growing trading card community.'] },
      { h2: 'Promote your Whatnot shows', paras: ['Got live pack breaks and auctions? List your shows on CardPop and reach thousands of Australian collectors.'] },
      { h2: 'Recent discussions', paras: ['Join the forum to talk market trends, pulls and deals with collectors across Australia.'] },
      { h2: 'Verified collectors', paras: ['Browse collectors who have built a public presence on CardPop.'] },
      { h2: 'Retailers & suppliers', paras: ['Authorized retailers and suppliers trusted by the CardPop community.'] },
    ],
    links: [
      { text: 'Local Traders', href: '/community/local-traders' },
      { text: 'Whatnot Shows', href: '/community/whatnot' },
      { text: 'Trading Card Events', href: '/events' },
    ],
  },

  '/community/whatnot': {
    title: 'Whatnot Shows | CardPop Community',
    description: 'Find live trading card breaks and auctions from Australian sellers on Whatnot. Watch, bid and win.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Community', path: '/community' }, { name: 'Whatnot Shows', path: '/community/whatnot' }],
    h1: 'Whatnot Shows',
    intro: "Advertise your upcoming Whatnot live shows to the CardPop community. Let collectors know when you're going live.",
    sections: [
      { h2: 'Live shows from Australian sellers', paras: ['Australian trading card sellers list their upcoming Whatnot live shows here \u2014 pack breaks, singles auctions and box openings. Check the schedule and tune in when they go live.'] },
      { h2: 'Promote your show', paras: ['Selling on Whatnot? List your upcoming shows on CardPop for free and reach thousands of Australian collectors before you go live.'] },
    ],
    links: [{ text: 'Community Hub', href: '/community' }, { text: 'Trading Card Events', href: '/events' }, { text: 'Local Traders', href: '/community/local-traders' }],
  },

  '/australian-markets': {
    title: 'Australian Card Markets | CardPop',
    description: 'Explore trading card markets across Australia. Find local card shops, events and trading communities near you.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Australian Markets', path: '/australian-markets' }],
    h1: 'Market Intelligence',
    intro: 'Professional-grade analytics, live sales data, and price trends aggregated from verified Australian marketplaces.',
    sections: [
      { h2: 'Market overview', paras: ['Track total sales volume, total sales value, average price, median price, and the highest and lowest sales across Pokémon, Magic: The Gathering, Yu-Gi-Oh! and NBA collections.'] },
      { h2: 'Price trends & condition breakdown', paras: ['See average daily sale prices across selected collections and a breakdown of sales volume by card condition.'] },
      { h2: 'Live market activity', paras: ['Recent verified sales from eBay Australia, updated across 24H, 7D, 30D, 90D and 1Y timeframes.'] },
      { h2: 'Grading standards', items: [
        { text: 'Mint (PSA 9–10) — flawless condition, perfect centering, sharp corners.' },
        { text: 'Near Mint (PSA 7–8) — minor imperfections visible on close inspection.' },
        { text: 'Excellent (PSA 5–6) — light wear, minor edge whitening or surface scratches.' },
      ] },
    ],
    links: [{ text: 'Grading Hub', href: '/grading' }, { text: 'Browse the Marketplace', href: '/marketplace' }],
  },

  '/insider-trading': {
    title: 'Insider Trading | CardPop',
    description: 'Get insider market intelligence and trading insights for Australian trading card collectors.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Insider Trading', path: '/insider-trading' }],
    h1: 'Insider Trading',
    intro: 'Support CardPop Australia by shopping with our trusted affiliate partners. Get the best deals on premium trading cards and accessories from retailers vetted by the CardPop team.',
    sections: [
      { h2: 'Trusted partner retailers', paras: ['Browse curated affiliate partners offering premium trading cards, sealed product and accessories to Australian collectors.'] },
    ],
    links: [{ text: 'Browse the Marketplace', href: '/marketplace' }, { text: 'The Shop', href: '/shop' }],
  },

  '/analytics': {
    title: 'Card Market Analytics | CardPop',
    description: 'Track trading card market prices and trends for Pokemon, Magic: The Gathering, Yu-Gi-Oh and more in Australia.',
    breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Market Analytics', path: '/analytics' }],
    h1: 'Card Market Analytics',
    intro: 'Research sold prices, track investment trends, and identify market movers across every major trading card collection — all in one place.',
    sections: [
      { h2: 'Research any card', paras: ['Search any card — for example “Charizard VSTAR Brilliant Stars” — to see live eBay Australia active listings, average pricing and 30-day price history in AUD.'] },
      { h2: 'What you can track', items: [
        { text: '90-day high and low prices in AUD.' },
        { text: '7-day and 30-day price changes.' },
        { text: '90-day sales volume and an investment signal.' },
        { text: 'Live eBay AU listings and recent sold listings.' },
      ] },
      { h2: 'Market movers', paras: ['See the day’s biggest advancers and decliners across Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports card collections.'] },
    ],
    links: [{ text: 'Australian Card Markets', href: '/australian-markets' }, { text: 'Browse the Marketplace', href: '/marketplace' }, { text: 'Grading Hub', href: '/grading' }],
  },
};

// Ordered list -> XML/HTML helpers for the static renderer.
const renderItems = (items = []) => items
  .map((it) => `    <li>${it.href ? `<a href="${esc(absUrl(it.href))}">${esc(it.text)}</a>` : esc(it.text)}</li>`)
  .join('\n');

const renderSections = (sections = []) => sections.map((s) => {
  const paras = (s.paras || []).map((p) => `  <p>${esc(p)}</p>`).join('\n');
  const list = s.items && s.items.length ? `  <ul>\n${renderItems(s.items)}\n  </ul>` : '';
  return `  <section>\n  <h2>${esc(s.h2)}</h2>\n${[paras, list].filter(Boolean).join('\n')}\n  </section>`;
}).join('\n');

function renderStaticContent(path) {
  const cfg = STATIC_CONTENT[path];
  const canonical = `${BASE_URL}${path}`;
  const jsonLdItems = [];

  if (cfg.breadcrumb?.length) {
    jsonLdItems.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: cfg.breadcrumb.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: `${BASE_URL}${b.path}` })),
    });
  }
  if (cfg.faqs?.length) {
    jsonLdItems.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: cfg.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }

  const crumbHtml = cfg.breadcrumb?.length
    ? `<nav aria-label="Breadcrumb">${cfg.breadcrumb.map((b, i) => i < cfg.breadcrumb.length - 1 ? `<a href="${BASE_URL}${esc(b.path)}">${esc(b.name)}</a> / ` : esc(b.name)).join('')}</nav>`
    : '';
  const introHtml = cfg.intro ? `<p>${esc(cfg.intro)}</p>` : '';
  const sectionsHtml = cfg.sections?.length ? renderSections(cfg.sections) : '';
  const faqHtml = cfg.faqs?.length
    ? `  <section>\n  <h2>Frequently Asked Questions</h2>\n${cfg.faqs.map((f) => `  <h3>${esc(f.q)}</h3>\n  <p>${esc(f.a)}</p>`).join('\n')}\n  </section>`
    : '';
  const linksHtml = cfg.links?.length
    ? `  <nav aria-label="Related">\n  <ul>\n${renderItems(cfg.links)}\n  </ul>\n  </nav>`
    : '';

  const bodyHtml = `<main>
  ${crumbHtml}
  <h1>${esc(cfg.h1)}</h1>
  ${introHtml}
${[sectionsHtml, faqHtml, linksHtml].filter(Boolean).join('\n')}
</main>`;

  return htmlDoc({ title: cfg.title, description: cfg.description, canonical, jsonLdItems, bodyHtml });
}

// ── Buying Guides (/analytics/buying-guides) ────────────────────────────────
// Static, hand-curated new-release + chase-card content sourced from the shared
// data/buyingGuides.js module (same source the SPA renders from).
function renderBuyingGuidesHub() {
  const canonical = `${BASE_URL}/analytics/buying-guides`;
  const title = 'Trading Card Buying Guides — New Releases & Chase Cards | CardPop';
  const description = 'What to chase in the newest trading card releases. CardPop buying guides break down the latest Pokémon expansions, AFL Teamcoach and Topps sets — and the chase cards worth hunting.';

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Analytics', item: `${BASE_URL}/analytics` },
      { '@type': 'ListItem', position: 3, name: 'Buying Guides', item: canonical },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'CardPop Buying Guides',
    numberOfItems: BUYING_GUIDES.length,
    itemListElement: BUYING_GUIDES.map((g, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${BASE_URL}/analytics/buying-guides/${g.slug}`, name: g.title,
    })),
  };

  const guidesHtml = BUYING_GUIDES.map((g) => {
    const label = GUIDE_CATEGORY_META[g.category]?.label || g.game;
    return `    <li><a href="${BASE_URL}/analytics/buying-guides/${esc(g.slug)}"><strong>${esc(g.shortTitle)}</strong></a> — ${esc(label)}, released ${esc(g.releaseLabel)}. ${esc(g.summary)}</li>`;
  }).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/analytics">Analytics</a> / Buying Guides</nav>
  <h1>Trading Card Buying Guides</h1>
  <p>The newest sets, decoded. CardPop buying guides break down every fresh trading card release — the latest Pokémon expansion, the current AFL Teamcoach range and the newest Topps drop — and call out the chase cards actually worth hunting.</p>
  <ul>
${guidesHtml}
  </ul>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems: [breadcrumb, itemList], bodyHtml });
}

async function renderBuyingGuide(supabase, slug) {
  const guide = getBuyingGuide(slug);
  if (!guide) {
    return notFound({
      title: 'Buying Guide Not Found | CardPop',
      description: 'The buying guide you are looking for could not be found on CardPop.',
      canonical: `${BASE_URL}/analytics/buying-guides/${esc(slug)}`,
      bodyHtml: '<main><h1>Buying Guide Not Found</h1><p>This buying guide does not exist on CardPop.</p></main>',
    });
  }

  // Wire into the /prices dataset: pull tracked cards (with their latest
  // snapshot) for this guide's mapped price category, for the live-price list
  // and any chase card whose priceRef points at a tracked card.
  const priceCategory = GUIDE_PRICE_CATEGORY[guide.category];
  let trackedCards = [];
  if (priceCategory) {
    const { data } = await supabase
      .from('tracked_cards')
      .select('slug, name, set_name, category, card_price_snapshots(snapshot_date, raw_avg, graded_avg)')
      .eq('active', true)
      .eq('category', priceCategory)
      .order('name')
      .order('snapshot_date', { referencedTable: 'card_price_snapshots', ascending: false })
      .limit(1, { referencedTable: 'card_price_snapshots' });
    trackedCards = (data || []).map((c) => ({ ...c, latest: c.card_price_snapshots?.[0] || null }));
  }
  const trackedBySlug = Object.fromEntries(trackedCards.map((c) => [c.slug, c]));
  const livePriceCards = trackedCards.filter((c) => c.latest).slice(0, 8);
  const priceCategoryLabel = priceCategory ? PRICE_CATEGORIES[priceCategory] : null;

  const canonical = `${BASE_URL}/analytics/buying-guides/${guide.slug}`;
  const label = GUIDE_CATEGORY_META[guide.category]?.label || guide.game;
  const title = `${guide.shortTitle} Buying Guide — Chase Cards to Hunt | CardPop`;
  const description = guide.summary;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Analytics', item: `${BASE_URL}/analytics` },
      { '@type': 'ListItem', position: 3, name: 'Buying Guides', item: `${BASE_URL}/analytics/buying-guides` },
      { '@type': 'ListItem', position: 4, name: guide.shortTitle, item: canonical },
    ],
  };
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${guide.title} — Buying Guide & Chase Cards`,
    description: guide.summary,
    datePublished: guide.releaseDate,
    dateModified: guide.updated,
    author: { '@type': 'Organization', name: 'CardPop' },
    publisher: { '@type': 'Organization', name: 'CardPop' },
  };

  const overviewHtml = guide.overview.map((p) => `  <p>${esc(p)}</p>`).join('\n');
  const factsHtml = guide.quickFacts.map((f) => `    <li><strong>${esc(f.label)}:</strong> ${esc(f.value)}</li>`).join('\n');
  const chaseHtml = guide.chaseCards.map((c) => {
    const valueText = /^[$\d]/.test(c.value) ? `${c.value} AUD` : c.value;
    const ref = c.priceRef ? trackedBySlug[c.priceRef] : null;
    let priceLink = '';
    if (ref) {
      const raw = audPrice(ref.latest?.raw_avg);
      const linkText = raw ? `Live market: ${raw} raw` : `Track ${ref.name} prices`;
      priceLink = ` <a href="${BASE_URL}/prices/${esc(ref.category)}/${esc(ref.slug)}">${esc(linkText)}</a>.`;
    }
    return `    <li><strong>${esc(c.name)}</strong> — ${esc(c.subtitle)} (${esc(valueText)}). ${esc(c.blurb)}${priceLink}</li>`;
  }).join('\n');
  const tipsHtml = (guide.collectingTips || []).map((t) => `    <li>${esc(t)}</li>`).join('\n');

  const livePricesHtml = (priceCategoryLabel && livePriceCards.length)
    ? `  <section>\n  <h2>Live ${esc(priceCategoryLabel)} prices</h2>\n  <p>Real AUD market data for tracked ${esc(priceCategoryLabel)} cards, updated daily.</p>\n  <ul>\n${
        livePriceCards.map((c) => {
          const raw = audPrice(c.latest?.raw_avg);
          const graded = audPrice(c.latest?.graded_avg);
          const bits = [raw ? `${raw} raw` : null, graded ? `${graded} graded` : null].filter(Boolean).join(' · ');
          return `    <li><a href="${BASE_URL}/prices/${esc(c.category)}/${esc(c.slug)}">${esc(c.name)}</a>${bits ? ` — ${esc(bits)}` : ''}</li>`;
        }).join('\n')
      }\n  </ul>\n  <p><a href="${BASE_URL}/prices/${esc(priceCategory)}">View all ${esc(priceCategoryLabel)} prices</a></p>\n  </section>`
    : '';

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/analytics">Analytics</a> / <a href="${BASE_URL}/analytics/buying-guides">Buying Guides</a> / ${esc(guide.shortTitle)}</nav>
  <h1>${esc(guide.title)}</h1>
  <p>${esc(guide.tagline)}</p>
  <p>${esc(label)} · Released ${esc(guide.releaseLabel)}</p>
  <section>
  <h2>The set at a glance</h2>
${overviewHtml}
  <ul>
${factsHtml}
  </ul>
  </section>
  <section>
  <h2>The chase cards</h2>
  <p>The most valuable and most-hyped cards in the set — the ones collectors are hunting right now.</p>
  <ul>
${chaseHtml}
  </ul>
  </section>
${livePricesHtml}
${tipsHtml ? `  <section>\n  <h2>Collector tips</h2>\n  <ul>\n${tipsHtml}\n  </ul>\n  </section>` : ''}
  <nav aria-label="Related"><ul>
    <li><a href="${BASE_URL}/marketplace">Browse the marketplace</a></li>
    <li><a href="${BASE_URL}/prices">Check AUD card prices</a></li>
  </ul></nav>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems: [breadcrumb, article], bodyHtml });
}

async function renderBlogIndex(supabase) {
  const canonical = `${BASE_URL}/blog`;
  const title = 'The Parallel Report | CardPop';
  const description = 'The Parallel Report by CardPop — trading card news, market analysis, grading guides and investment insights for Australian Pokémon, MTG and sports card collectors.';

  const { data } = await supabase
    .from('blog_articles')
    .select('slug, id, title, excerpt, author, published_at, created_at, category')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(50);
  const articles = data || [];

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'The Parallel Report', item: canonical },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'The Parallel Report',
    numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE_URL}/blog/${a.slug || a.id}`, name: a.title })),
  };

  const categoriesHtml = BLOG_CATEGORIES.map((c) =>
    `    <li><a href="${BASE_URL}/blog/category/${esc(c.slug)}"><strong>${esc(c.label)}</strong></a> — ${esc(c.desc)}</li>`
  ).join('\n');

  const articlesHtml = articles.map((a) => {
    const date = (a.published_at || a.created_at || '').split('T')[0];
    const author = a.author || 'CardPop Australia';
    return `    <li><a href="${BASE_URL}/blog/${esc(a.slug || a.id)}"><strong>${esc(a.title || 'Untitled')}</strong></a>`
      + `${a.excerpt ? ` — ${esc(toText(a.excerpt, 160))}` : ''} <em>(${esc(author)}${date ? `, ${esc(date)}` : ''})</em></li>`;
  }).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / The Parallel Report</nav>
  <h1>The Parallel Report</h1>
  <p>Insights, news, and deep-dives from the forefront of the collecting world.</p>
  <section>
  <h2>Explore by topic</h2>
  <ul>
${categoriesHtml}
  </ul>
  </section>
  <section>
  <h2>Latest articles (${articles.length})</h2>
  <ul>
${articlesHtml || '    <li>New articles are on the way — check back soon.</li>'}
  </ul>
  </section>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems: [breadcrumb, itemList], bodyHtml });
}

// Blog category pages (/blog/category/:slug). These are linked from the
// site-wide header and the blog index, so bots crawl them constantly — before
// this renderer existed they fell through to the generic noindex fallback and
// showed up in Search Console as "Excluded by 'noindex' tag".
async function renderBlogCategory(supabase, slug) {
  const cfg = BLOG_CATEGORY_MAP[slug];
  if (!cfg) {
    return notFound({
      title: 'Category Not Found | CardPop',
      description: 'This blog category could not be found on CardPop.',
      canonical: `${BASE_URL}/blog`,
      bodyHtml: '<main><h1>Category Not Found</h1><p>This blog category is not available.</p></main>',
    });
  }

  const canonical = `${BASE_URL}/blog/category/${slug}`;
  const title = `${cfg.label} | The Parallel Report — CardPop`;
  const description = `${cfg.desc}. Articles from The Parallel Report by CardPop — trading card analysis, guides and insights for Australian collectors.`;

  // blog_articles.category stores the category slug (see data/blogCategories.js).
  const { data } = await supabase
    .from('blog_articles')
    .select('slug, id, title, excerpt, author, published_at, created_at')
    .eq('is_published', true)
    .eq('category', slug)
    .order('published_at', { ascending: false })
    .limit(100);
  const articles = data || [];

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'The Parallel Report', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: cfg.label, item: canonical },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cfg.label} — The Parallel Report`,
    numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE_URL}/blog/${a.slug || a.id}`, name: a.title })),
  };

  const articlesHtml = articles.map((a) => {
    const date = (a.published_at || a.created_at || '').split('T')[0];
    const author = a.author || 'CardPop Australia';
    return `    <li><a href="${BASE_URL}/blog/${esc(a.slug || a.id)}"><strong>${esc(a.title || 'Untitled')}</strong></a>`
      + `${a.excerpt ? ` — ${esc(toText(a.excerpt, 160))}` : ''} <em>(${esc(author)}${date ? `, ${esc(date)}` : ''})</em></li>`;
  }).join('\n');

  const otherCategoriesHtml = BLOG_CATEGORIES.filter((c) => c.slug !== slug)
    .map((c) => `    <li><a href="${BASE_URL}/blog/category/${esc(c.slug)}">${esc(c.label)}</a> — ${esc(c.desc)}</li>`)
    .join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/blog">The Parallel Report</a> / ${esc(cfg.label)}</nav>
  <h1>${esc(cfg.label)}</h1>
  <p>${esc(description)}</p>
  <section>
  <h2>Articles (${articles.length})</h2>
  <ul>
${articlesHtml || '    <li>New articles are on the way — check back soon.</li>'}
  </ul>
  </section>
  <section>
  <h2>More topics</h2>
  <ul>
${otherCategoriesHtml}
  </ul>
  </section>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems: [breadcrumb, itemList], bodyHtml });
}

// ── Card price pages (/prices) ──────────────────────────────────────────────

const PRICE_CATEGORIES = {
  pokemon: 'Pokémon',
  basketball: 'Basketball (NBA)',
  'one-piece': 'One Piece',
  afl: 'AFL',
  nrl: 'NRL',
};

const audPrice = (value) => {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
};

const priceDate = (isoDate) => new Date(`${isoDate}T00:00:00Z`)
  .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

async function renderPricesHub(supabase, categorySlug) {
  const categoryLabel = categorySlug ? PRICE_CATEGORIES[categorySlug] : null;

  let query = supabase
    .from('tracked_cards')
    .select('slug, name, set_name, card_number, category, card_price_snapshots(snapshot_date, raw_avg, graded_avg)')
    .eq('active', true)
    .order('name')
    .order('snapshot_date', { referencedTable: 'card_price_snapshots', ascending: false })
    .limit(1, { referencedTable: 'card_price_snapshots' });
  if (categorySlug) query = query.eq('category', categorySlug);
  const { data: cards } = await query;

  const canonicalPath = categorySlug ? `/prices/${categorySlug}` : '/prices';
  const title = categoryLabel
    ? `${categoryLabel} Card Prices in AUD | CardPop`
    : 'Trading Card Prices in AUD | CardPop';
  const description = categoryLabel
    ? `Live Australian-dollar market prices for ${categoryLabel} trading cards — raw and graded averages updated daily from live listings.`
    : 'Live Australian-dollar market prices for Pokémon, NBA, One Piece, AFL and NRL trading cards. Raw and graded averages updated daily.';

  const grouped = {};
  for (const card of cards || []) (grouped[card.category] ||= []).push(card);
  const sectionKeys = categorySlug ? [categorySlug] : Object.keys(PRICE_CATEGORIES).filter((k) => grouped[k]?.length);

  const sections = sectionKeys.map((key) => {
    const items = (grouped[key] || []).map((card) => {
      const latest = card.card_price_snapshots?.[0];
      const raw = audPrice(latest?.raw_avg);
      const graded = audPrice(latest?.graded_avg);
      const priceText = [raw && `raw avg ${raw}`, graded && `graded avg ${graded}`].filter(Boolean).join(', ');
      const label = `${card.name}${card.set_name ? ` — ${card.set_name}` : ''}`;
      return `<li><a href="${BASE_URL}/prices/${esc(card.category)}/${esc(card.slug)}">${esc(label)}</a>${priceText ? ` (${esc(priceText)})` : ''}</li>`;
    }).join('\n');
    return `<section><h2>${esc(PRICE_CATEGORIES[key])}</h2><ul>${items}</ul></section>`;
  }).join('\n');

  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: `${BASE_URL}${canonicalPath}`,
  }];

  return htmlDoc({
    title,
    description,
    canonical: `${BASE_URL}${canonicalPath}`,
    ogImage: `${BASE_URL}/og-image.jpg`,
    jsonLdItems: jsonLd,
    bodyHtml: `<main><h1>${esc(categoryLabel ? `${categoryLabel} Card Prices in AUD` : 'Trading Card Prices in AUD')}</h1>
<p>${esc(description)}</p>
${sections}</main>`,
  });
}

async function renderPriceCard(supabase, categorySlug, cardSlug) {
  const { data: card } = await supabase
    .from('tracked_cards')
    .select('id, slug, name, set_name, card_number, category, blurb, image_url')
    .eq('slug', cardSlug)
    .eq('active', true)
    .maybeSingle();

  if (!card || card.category !== categorySlug) {
    return notFound({
      title: 'Card not found | CardPop',
      description: 'This card price page does not exist.',
      canonical: `${BASE_URL}/prices`,
      bodyHtml: '<main><h1>Card not found</h1></main>',
    });
  }

  const { data: snapshots } = await supabase
    .from('card_price_snapshots')
    .select('snapshot_date, raw_avg, raw_min, raw_max, raw_count, graded_avg, graded_min, graded_max, graded_count')
    .eq('card_id', card.id)
    .order('snapshot_date', { ascending: false })
    .limit(1);
  const latest = snapshots?.[0] || null;

  const categoryLabel = PRICE_CATEGORIES[card.category] || card.category;
  const fullName = card.set_name ? `${card.name} — ${card.set_name}` : card.name;
  const canonicalPath = `/prices/${card.category}/${card.slug}`;
  const updatedOn = latest ? priceDate(latest.snapshot_date) : null;

  const title = `${card.name} Price (AUD) — ${card.set_name || categoryLabel} | CardPop`;
  const description = latest?.raw_avg
    ? `${fullName} is listing for around ${audPrice(latest.raw_avg)} raw and ${audPrice(latest.graded_avg)} graded in Australia (updated ${updatedOn}). Live AUD prices, history and where to buy.`
    : `Live Australian-dollar market price for ${fullName}: raw and graded averages, price history, and where to buy and sell in Australia.`;

  const faqs = [
    {
      q: `How much is ${card.name} (${card.set_name || categoryLabel}) worth in Australia?`,
      a: latest?.raw_avg
        ? `As at ${updatedOn}, ungraded copies list for around ${audPrice(latest.raw_avg)} (range ${audPrice(latest.raw_min)}–${audPrice(latest.raw_max)}), while graded copies average about ${audPrice(latest.graded_avg)}. Prices are in Australian dollars and refresh daily.`
        : 'A current AUD price is being calculated from live listings — check back shortly for the latest figure.',
    },
    {
      q: 'Why do these prices differ from US price guides?',
      a: 'US guides quote USD and reflect American supply and demand. CardPop aggregates live listings available to Australian buyers — local listings in AUD plus international listings converted at the current exchange rate — so the figure is what you would actually pay or receive here.',
    },
    {
      q: `Where can I buy or sell ${card.name} in Australia?`,
      a: 'You can buy and sell directly on the CardPop marketplace, with verified Australian sellers and buyer protection.',
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Card Prices', item: `${BASE_URL}/prices` },
        { '@type': 'ListItem', position: 2, name: categoryLabel, item: `${BASE_URL}/prices/${card.category}` },
        { '@type': 'ListItem', position: 3, name: card.name, item: `${BASE_URL}${canonicalPath}` },
      ],
    },
    latest && (latest.raw_avg || latest.graded_avg) ? {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: fullName,
      description: card.blurb || description,
      category: `${categoryLabel} Trading Cards`,
      url: `${BASE_URL}${canonicalPath}`,
      ...(publicImageUrl(card.image_url) ? { image: publicImageUrl(card.image_url) } : {}),
      ...(card.card_number ? { sku: card.card_number, mpn: card.card_number } : {}),
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'AUD',
        lowPrice: latest.raw_min ?? latest.graded_min,
        highPrice: latest.graded_max ?? latest.raw_max,
        offerCount: (latest.raw_count || 0) + (latest.graded_count || 0),
      },
    } : null,
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ].filter(Boolean);

  const statsHtml = latest ? `<ul>
<li>Raw average: ${esc(audPrice(latest.raw_avg) || '—')}${latest.raw_count ? ` (${latest.raw_count} listings)` : ''}</li>
<li>Raw range: ${latest.raw_avg !== null ? `${esc(audPrice(latest.raw_min))} – ${esc(audPrice(latest.raw_max))}` : '—'}</li>
<li>Graded average: ${esc(audPrice(latest.graded_avg) || '—')}${latest.graded_count ? ` (${latest.graded_count} listings)` : ''}</li>
<li>Graded range: ${latest.graded_avg !== null ? `${esc(audPrice(latest.graded_min))} – ${esc(audPrice(latest.graded_max))}` : '—'}</li>
</ul>` : '<p>The first price snapshot for this card is being collected.</p>';

  const faqHtml = faqs.map(({ q, a }) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n');

  return htmlDoc({
    title,
    description,
    canonical: `${BASE_URL}${canonicalPath}`,
    ogImage: `${BASE_URL}/og-image.jpg`,
    ogType: 'product',
    jsonLdItems: jsonLd,
    bodyHtml: `<main>
<nav><a href="${BASE_URL}/prices">Card Prices</a> / <a href="${BASE_URL}/prices/${esc(card.category)}">${esc(categoryLabel)}</a></nav>
<h1>${esc(card.name)} Price (AUD)</h1>
<p>${esc(card.set_name || '')}${card.card_number ? ` · ${esc(card.card_number)}` : ''}${updatedOn ? ` · Updated ${esc(updatedOn)}` : ''}</p>
${statsHtml}
${card.blurb ? `<p>${esc(card.blurb)}</p>` : ''}
<h2>Frequently asked questions</h2>
${faqHtml}
<p>Prices are aggregated daily from live eBay Australia and international listings (converted to AUD), with outliers trimmed. They reflect current asking prices, not completed sales, and are a guide only.</p>
</main>`,
  });
}

// Mirror of resolveCollectionSlug in data/collectionConfigs.js — maps URL slug
// variations (including category aliases) onto the primary collection slug.
const resolveCollection = (rawSlug) => {
  if (!rawSlug) return null;
  const s = String(rawSlug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (COLLECTION_SEO[s]) return s;
  for (const [key, cfg] of Object.entries(COLLECTION_SEO)) {
    if (cfg.aliases?.some((a) => a.toLowerCase() === String(rawSlug).toLowerCase())) return key;
  }
  return null;
};

function renderCollectionsIndex() {
  const canonical = `${BASE_URL}/collections`;
  const title = 'Trading Card Collections | CardPop';
  const description = 'Browse every trading card collection on CardPop Australia — Pokémon, Magic: The Gathering, Yu-Gi-Oh, NBA, AFL, NRL and more, from verified Australian sellers.';

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Collections', item: canonical },
    ],
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'CardPop Collections',
    numberOfItems: Object.keys(COLLECTION_SEO).length,
    itemListElement: Object.entries(COLLECTION_SEO).map(([slug, cfg], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: cfg.name,
      url: `${BASE_URL}/collections/${slug}`,
    })),
  };

  const itemsHtml = Object.entries(COLLECTION_SEO)
    .map(([slug, cfg]) => `    <li><a href="${BASE_URL}/collections/${esc(slug)}"><strong>${esc(cfg.name)}</strong></a> — ${esc(cfg.description || '')}</li>`)
    .join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / Collections</nav>
  <h1>Trading Card Collections</h1>
  <p>${esc(description)}</p>
  <ul>
${itemsHtml}
  </ul>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems: [breadcrumb, itemList], bodyHtml });
}

async function renderCollection(supabase, rawSlug) {
  const slug = resolveCollection(rawSlug);
  if (!slug) {
    return notFound({
      title: 'Collection Not Found | CardPop',
      description: 'This collection could not be found on CardPop.',
      canonical: `${BASE_URL}/collections`,
      bodyHtml: '<main><h1>Collection Not Found</h1><p>This collection is not available.</p></main>',
    });
  }

  const cfg = COLLECTION_SEO[slug];
  // Alias slugs canonicalise to the primary collection URL.
  const canonical = `${BASE_URL}/collections/${slug}`;
  const title = cfg.title || `${cfg.name} | CardPop`;
  const description = cfg.description || `Buy, sell and trade ${cfg.name} trading cards on CardPop Australia.`;

  // Best-effort listing sample for the collection — category values in the DB
  // match the collection name or one of its aliases. An empty result only
  // trims the list; the SEO copy above still renders.
  const categoryValues = [cfg.name, ...(cfg.aliases || [])];
  const { data } = await supabase
    .from('listings')
    .select('id, slug, title, price_aud, category, vault_item:vault_items(card_name)')
    .eq('status', 'active')
    .in('category', categoryValues)
    .order('created_at', { ascending: false })
    .limit(50);
  const listings = data || [];

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Collections', item: `${BASE_URL}/collections` },
      { '@type': 'ListItem', position: 3, name: cfg.name, item: canonical },
    ],
  };

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonical,
  };

  const jsonLdItems = [collectionPage, breadcrumb];
  if (listings.length > 0) {
    jsonLdItems.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${cfg.name} listings`,
      numberOfItems: listings.length,
      itemListElement: listings.map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: l.title || l.vault_item?.card_name || 'Trading Card',
        url: `${BASE_URL}/marketplace/${l.id}/${l.slug || 'listing'}`,
      })),
    });
  }

  const itemsHtml = listings.map((l) => {
    const name = l.title || l.vault_item?.card_name || 'Trading Card';
    return `    <li><a href="${BASE_URL}/marketplace/${esc(l.id)}/${esc(l.slug || 'listing')}">${esc(name)}</a>`
      + `${l.price_aud > 0 ? ` — A$${esc(Number(l.price_aud).toFixed(2))}` : ''}</li>`;
  }).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/collections">Collections</a> / ${esc(cfg.name)}</nav>
  <h1>${esc(cfg.name)} Cards in Australia</h1>
  <p>${esc(description)}</p>
  ${cfg.intro ? `<p>${esc(cfg.intro)}</p>` : ''}
  <h2>Latest ${esc(cfg.name)} Listings (${listings.length})</h2>
  <ul>
${itemsHtml || '    <li>No active listings right now — check back soon or browse the marketplace.</li>'}
  </ul>
  <p><a href="${BASE_URL}/marketplace">Browse the full marketplace</a></p>
</main>`;

  return htmlDoc({ title, description, canonical, jsonLdItems, bodyHtml });
}

async function renderSeller(supabase, param) {
  const canonicalSelf = `${BASE_URL}/seller/${param}`;
  if (!UUID_RE.test(param)) {
    return notFound({
      title: 'Seller Profile | CardPop',
      description: 'View seller profiles on CardPop.',
      canonical: canonicalSelf,
      bodyHtml: '<main><h1>Seller Profile</h1></main>',
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, store_slug, business_name, display_name, username, bio, business_tagline, avatar_url, business_logo_url, location_state, location_suburb, rating, reviews_count, is_sole_trader, is_public')
    .eq('id', param)
    .maybeSingle();

  if (!profile || profile.is_public === false) {
    return notFound({
      title: 'Seller Not Found | CardPop',
      description: 'This seller profile could not be found on CardPop.',
      canonical: canonicalSelf,
      bodyHtml: '<main><h1>Seller Not Found</h1><p>This profile is not available.</p></main>',
    });
  }

  const name = profile.display_name || profile.business_name || profile.username || 'CardPop Seller';
  // Sole traders have a dedicated /dealer store page (in the sitemap and
  // prerendered) with substantially the same content — that page is canonical,
  // so /seller/:id for them is a declared alternate rather than a duplicate.
  const canonical = profile.is_sole_trader
    ? `${BASE_URL}/dealer/${profile.store_slug || profile.id}`
    : canonicalSelf;
  const image = absUrl(profile.avatar_url || profile.business_logo_url);
  const location = [profile.location_suburb, profile.location_state].filter(Boolean).join(', ');
  const title = `${name} | CardPop Seller Profile`;
  const description = profile.business_tagline || profile.bio
    || `${name} — trading card seller on CardPop, Australia's trading card marketplace.`;

  const { data: listingData } = await supabase
    .from('listings')
    .select('id, slug, title, price_aud, vault_item:vault_items(card_name)')
    .eq('seller_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);
  const listings = listingData || [];

  const person = {
    '@context': 'https://schema.org',
    '@type': profile.business_name ? 'Organization' : 'Person',
    name,
    url: canonical,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(profile.reviews_count > 0 && profile.rating > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(profile.rating).toFixed(1), reviewCount: profile.reviews_count } }
      : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Marketplace', item: `${BASE_URL}/marketplace` },
      { '@type': 'ListItem', position: 3, name, item: canonicalSelf },
    ],
  };

  const itemsHtml = listings.map((l) => {
    const cardName = l.title || l.vault_item?.card_name || 'Trading Card';
    return `    <li><a href="${BASE_URL}/marketplace/${esc(l.id)}/${esc(l.slug || 'listing')}">${esc(cardName)}</a>`
      + `${l.price_aud > 0 ? ` — A$${esc(Number(l.price_aud).toFixed(2))}` : ''}</li>`;
  }).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/marketplace">Marketplace</a> / ${esc(name)}</nav>
  <h1>${esc(name)}</h1>
  ${profile.business_tagline ? `<p>${esc(profile.business_tagline)}</p>` : ''}
  ${location ? `<p>${esc(location)}</p>` : ''}
  ${profile.bio ? `<p>${esc(profile.bio)}</p>` : ''}
  ${profile.is_sole_trader ? `<p><a href="${esc(canonical)}">Visit this seller's store</a></p>` : ''}
  <h2>Active Listings (${listings.length})</h2>
  <ul>
${itemsHtml || '    <li>No active listings at the moment.</li>'}
  </ul>
</main>`;

  return htmlDoc({ title, description, canonical, ogImage: image, jsonLdItems: [person, breadcrumb], bodyHtml });
}

// ── Store directory pages (/card-shops) ─────────────────────────────────────

const DIRECTORY_CITIES = {
  sydney:           { label: 'Sydney',         state: 'NSW' },
  newcastle:        { label: 'Newcastle',      state: 'NSW' },
  wollongong:       { label: 'Wollongong',     state: 'NSW' },
  'central-coast':  { label: 'Central Coast',  state: 'NSW' },
  canberra:         { label: 'Canberra',       state: 'ACT' },
  melbourne:        { label: 'Melbourne',      state: 'VIC' },
  geelong:          { label: 'Geelong',        state: 'VIC' },
  ballarat:         { label: 'Ballarat',       state: 'VIC' },
  bendigo:          { label: 'Bendigo',        state: 'VIC' },
  adelaide:         { label: 'Adelaide',       state: 'SA' },
  hobart:           { label: 'Hobart',         state: 'TAS' },
  launceston:       { label: 'Launceston',     state: 'TAS' },
  brisbane:         { label: 'Brisbane',       state: 'QLD' },
  'gold-coast':     { label: 'Gold Coast',     state: 'QLD' },
  'sunshine-coast': { label: 'Sunshine Coast', state: 'QLD' },
  cairns:           { label: 'Cairns',         state: 'QLD' },
  townsville:       { label: 'Townsville',     state: 'QLD' },
  toowoomba:        { label: 'Toowoomba',      state: 'QLD' },
  perth:            { label: 'Perth',          state: 'WA' },
  darwin:           { label: 'Darwin',         state: 'NT' },
};

async function renderStoresHub(supabase) {
  const { data: stores } = await supabase
    .from('local_game_stores')
    .select('slug, name, suburb, city, state')
    .eq('status', 'approved')
    .order('name')
    .limit(500);

  const counts = {};
  for (const store of stores || []) counts[store.city] = (counts[store.city] || 0) + 1;

  const title = 'Card Shops & Card Shows in Australia — Store Directory | CardPop';
  const description = 'Find trading card shops near you: Pokémon, sports cards, One Piece and TCG stores across Sydney, Melbourne, Brisbane, Perth, Adelaide and more — plus upcoming card shows.';

  const cityLinks = Object.entries(DIRECTORY_CITIES)
    .filter(([slug]) => counts[slug] > 0)
    .map(([slug, info]) =>
      `<li><a href="${BASE_URL}/card-shops/${esc(slug)}">Card shops in ${esc(info.label)}, ${esc(info.state)}</a> (${counts[slug]})</li>`)
    .join('\n');

  return htmlDoc({
    title,
    description,
    canonical: `${BASE_URL}/card-shops`,
    ogImage: `${BASE_URL}/og-image.jpg`,
    jsonLdItems: [{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: `${BASE_URL}/card-shops`,
    }],
    bodyHtml: `<main><h1>Australian Card Shops &amp; Shows</h1>
<p>${esc(description)}</p>
<ul>${cityLinks}</ul>
<p><a href="${BASE_URL}/card-shops/add">Add your store — free listing</a></p></main>`,
  });
}

async function renderStoresCity(supabase, citySlug) {
  const cityInfo = DIRECTORY_CITIES[citySlug];
  const { data: stores } = await supabase
    .from('local_game_stores')
    .select('slug, name, suburb, city, state, website, categories, description')
    .eq('status', 'approved')
    .eq('city', citySlug)
    .order('name')
    .limit(200);

  const title = `Card Shops in ${cityInfo.label} — Pokémon, TCG & Sports Card Stores | CardPop`;
  const description = `Find trading card shops in ${cityInfo.label}, ${cityInfo.state}: local stores for Pokémon, sports cards, One Piece and other TCGs, plus upcoming card shows near ${cityInfo.label}.`;

  const storeItems = (stores || []).map((store) => {
    const line = [store.suburb, store.state].filter(Boolean).join(', ');
    return `<li><strong>${esc(store.name)}</strong>${line ? ` — ${esc(line)}` : ''}${store.description ? `<br/>${esc(store.description)}` : ''}${store.website ? ` <a href="${esc(store.website)}" rel="noopener">Website</a>` : ''}</li>`;
  }).join('\n');

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Card Shops', item: `${BASE_URL}/card-shops` },
        { '@type': 'ListItem', position: 2, name: cityInfo.label, item: `${BASE_URL}/card-shops/${citySlug}` },
      ],
    },
    (stores || []).length ? {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Card shops in ${cityInfo.label}`,
      numberOfItems: stores.length,
      itemListElement: stores.map((store, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'LocalBusiness',
          name: store.name,
          ...(store.website ? { url: store.website } : {}),
          address: {
            '@type': 'PostalAddress',
            ...(store.suburb ? { addressLocality: store.suburb } : {}),
            addressRegion: store.state,
            addressCountry: 'AU',
          },
        },
      })),
    } : null,
  ].filter(Boolean);

  return htmlDoc({
    title,
    description,
    canonical: `${BASE_URL}/card-shops/${citySlug}`,
    ogImage: `${BASE_URL}/og-image.jpg`,
    jsonLdItems: jsonLd,
    bodyHtml: `<main>
<nav><a href="${BASE_URL}/card-shops">Card Shops</a></nav>
<h1>Card Shops in ${esc(cityInfo.label)}</h1>
<p>${esc(description)}</p>
<ul>${storeItems || '<li>No stores listed yet — know one? Add it below.</li>'}</ul>
<p><a href="${BASE_URL}/card-shops/add">Add your store — free listing</a> · <a href="${BASE_URL}/events">Card events calendar</a></p>
</main>`,
  });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const rawPath = String(req.query.path || '').split('?')[0];

  try {
    if (rawPath === '/community/local-traders') {
      return sendDoc(res, await renderLocalTraders(supabase));
    }

    if (LANDINGS[rawPath]) {
      return sendDoc(res, await renderLanding(supabase, rawPath));
    }

    if (rawPath === '/blog') {
      return sendDoc(res, await renderBlogIndex(supabase));
    }

    if (STATIC_CONTENT[rawPath]) {
      return sendDoc(res, renderStaticContent(rawPath));
    }

    if (rawPath === '/events') {
      return sendDoc(res, await renderEventsLanding(supabase, null));
    }

    const eventsMatch = rawPath.match(/^\/events\/([^/?#]+)/);
    if (eventsMatch) {
      const param = decodeURIComponent(eventsMatch[1]);
      // Known category slugs render a filtered landing; everything else is an
      // individual event (looked up by UUID or slug).
      if (EVENT_CATEGORIES[param]) {
        return sendDoc(res, await renderEventsLanding(supabase, param));
      }
      return sendDoc(res, await renderEvent(supabase, param));
    }

    const shopProductMatch = rawPath.match(/^\/product\/shop\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (shopProductMatch) {
      const id = decodeURIComponent(shopProductMatch[1]);
      const slug = shopProductMatch[2] ? decodeURIComponent(shopProductMatch[2]) : undefined;
      return sendDoc(res, await renderShopProduct(supabase, id, slug));
    }

    const dealerMatch = rawPath.match(/^\/dealer\/([^/?#]+)/);
    if (dealerMatch) {
      const id = decodeURIComponent(dealerMatch[1]);
      return sendDoc(res, await renderDealer(supabase, id));
    }

    if (rawPath === '/collections') {
      return sendDoc(res, renderCollectionsIndex());
    }

    const collectionMatch = rawPath.match(/^\/collections\/([^/?#]+)/);
    if (collectionMatch) {
      const slug = decodeURIComponent(collectionMatch[1]);
      return sendDoc(res, await renderCollection(supabase, slug));
    }

    const sellerMatch = rawPath.match(/^\/seller\/([^/?#]+)/);
    if (sellerMatch) {
      const id = decodeURIComponent(sellerMatch[1]);
      return sendDoc(res, await renderSeller(supabase, id));
    }

    const listingMatch = rawPath.match(/^\/marketplace\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (listingMatch) {
      const id = decodeURIComponent(listingMatch[1]);
      const slug = listingMatch[2] ? decodeURIComponent(listingMatch[2]) : undefined;
      return sendDoc(res, await renderListing(supabase, id, slug));
    }

    if (rawPath === '/analytics/buying-guides') {
      return sendDoc(res, renderBuyingGuidesHub());
    }

    const buyingGuideMatch = rawPath.match(/^\/analytics\/buying-guides\/([^/?#]+)/);
    if (buyingGuideMatch) {
      return sendDoc(res, await renderBuyingGuide(supabase, decodeURIComponent(buyingGuideMatch[1])));
    }

    if (rawPath === '/prices') {
      return sendDoc(res, await renderPricesHub(supabase, null));
    }

    if (rawPath === '/card-shops') {
      return res.status(200).send(await renderStoresHub(supabase));
    }

    const storesCityMatch = rawPath.match(/^\/card-shops\/([^/?#]+)/);
    if (storesCityMatch) {
      const citySlug = decodeURIComponent(storesCityMatch[1]);
      if (DIRECTORY_CITIES[citySlug]) {
        return res.status(200).send(await renderStoresCity(supabase, citySlug));
      }
      if (citySlug === 'add') {
        return res.status(200).send(htmlDoc({
          title: 'Add Your Card Store — Free Listing | CardPop',
          description: 'List your trading card store in CardPop\'s free Australian card shop directory and get found by collectors in your city.',
          canonical: `${BASE_URL}/card-shops/add`,
          bodyHtml: '<main><h1>Add your card store</h1><p>Free listing in the Australian card shop directory. Submissions are reviewed before going live.</p></main>',
        }));
      }
    }

    const pricesMatch = rawPath.match(/^\/prices\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (pricesMatch) {
      const category = decodeURIComponent(pricesMatch[1]);
      const cardSlug = pricesMatch[2] ? decodeURIComponent(pricesMatch[2]) : null;
      if (PRICE_CATEGORIES[category]) {
        return sendDoc(res, cardSlug
          ? await renderPriceCard(supabase, category, cardSlug)
          : await renderPricesHub(supabase, category));
      }
    }

    const blogCategoryMatch = rawPath.match(/^\/blog\/category\/([^/?#]+)/);
    if (blogCategoryMatch) {
      return sendDoc(res, await renderBlogCategory(supabase, decodeURIComponent(blogCategoryMatch[1])));
    }

    const blogMatch = rawPath.match(/^\/blog\/([^/?#]+)/);
    if (blogMatch && decodeURIComponent(blogMatch[1]) !== 'category') {
      const param = decodeURIComponent(blogMatch[1]);
      return sendDoc(res, await renderBlogArticle(supabase, param));
    }

    // Unknown path — a real 404 so crawlers drop the URL instead of tracking
    // it as an excluded-by-noindex page forever.
    return sendDoc(res, notFound({
      title: 'Page Not Found | CardPop',
      description: 'The page you are looking for could not be found on CardPop.',
      canonical: `${BASE_URL}${rawPath || '/'}`,
      bodyHtml: '<main><h1>Page Not Found</h1><p>This page does not exist on CardPop.</p></main>',
    }));
  } catch (err) {
    console.error('Prerender error:', err);
    // Transient failure (e.g. Supabase timeout). Answer 503 so crawlers retry
    // later and keep the currently indexed copy — a 200 + noindex here told
    // Google to DEINDEX a perfectly good page whenever a recrawl coincided
    // with a database hiccup. Never cache the error response.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '300');
    return res.status(503).send(htmlDoc({
      title: 'CardPop | Temporarily Unavailable',
      description: 'CardPop is temporarily unavailable. Please try again shortly.',
      canonical: `${BASE_URL}${rawPath || '/'}`,
      bodyHtml: '<main><h1>Temporarily unavailable</h1><p>Please try again in a few minutes.</p></main>',
    }));
  }
}
