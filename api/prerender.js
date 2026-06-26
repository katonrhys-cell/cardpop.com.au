import { createClient } from '@supabase/supabase-js';

// Dynamic rendering for crawlers / link unfurlers. The site is a client-rendered
// SPA, so bots that don't execute JS would otherwise see an empty shell. Vercel
// rewrites route bot user-agents for these public pages here, where we return
// fully-formed HTML with titles, meta tags and JSON-LD. Humans are unaffected —
// their requests fall through to the SPA (index.html).

const SUPABASE_URL = 'https://odoglvswwymyjuwlonkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

const BASE_URL = 'https://cardpop.com.au';

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

// Map a trading-card condition / grade to a schema.org OfferItemCondition.
const schemaItemCondition = (c) => {
  const v = String(c || '').toLowerCase();
  if (!v) return undefined;
  if (/(gem|mint|sealed|brand new|\bnm\b|graded)/.test(v) || /\b(8|8\.5|9|9\.5|10)\b/.test(v)) return 'https://schema.org/NewCondition';
  if (/(damaged|poor|heavily played|\bhp\b)/.test(v)) return 'https://schema.org/DamagedCondition';
  return 'https://schema.org/UsedCondition';
};

function htmlDoc({ title, description, canonical, ogImage, robots, ogType = 'website', headExtra = '', jsonLdItems = [], bodyHtml = '' }) {
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
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}" />` : ''}
${headExtra}
${ld}
</head>
<body>
${bodyHtml}
<p><a href="${esc(canonical)}">View on CardPop</a></p>
</body>
</html>`;
}

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
    return htmlDoc({
      title: 'Store Unavailable | CardPop',
      description: 'This dealer store could not be found on CardPop.',
      canonical,
      robots: 'noindex, follow',
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
    const img = imgPath
      ? (imgPath.startsWith('http') ? imgPath : supabase.storage.from('vault-images').getPublicUrl(imgPath).data.publicUrl)
      : undefined;
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
    return htmlDoc({
      title: 'Article Not Found | CardPop',
      description: 'This article could not be found on CardPop.',
      canonical: `${BASE_URL}/blog/${param}`,
      robots: 'noindex, follow',
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

  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    ...(image ? { image } : {}),
    author: { '@type': 'Person', name: author },
    publisher: {
      '@type': 'Organization',
      name: 'CardPop',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/og-image.jpg` },
    },
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'The Parallel Report', item: `${BASE_URL}/blog` },
      ...(article.category ? [{ '@type': 'ListItem', position: 3, name: article.category, item: `${BASE_URL}/blog/category/${encodeURIComponent(article.category)}` }] : []),
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
    article.category ? `<meta property="article:section" content="${esc(article.category)}" />` : '',
  ].filter(Boolean).join('\n');

  const bodyHtml = `<main>
  <nav aria-label="Breadcrumb"><a href="${BASE_URL}/">Home</a> / <a href="${BASE_URL}/blog">The Parallel Report</a> / ${esc(article.title)}</nav>
  <article>
    <h1>${esc(article.title)}</h1>
    <p><em>By ${esc(author)}${published ? ` — ${esc(new Date(published).toISOString().split('T')[0])}` : ''}${article.read_time_minutes ? ` · ${esc(String(article.read_time_minutes))} min read` : ''}</em></p>
    ${article.excerpt ? `<p>${esc(article.excerpt)}</p>` : ''}
    ${image ? `<img src="${esc(image)}" alt="${esc(article.title)}" />` : ''}
    ${bodyContent || `<p>${esc(description)}</p>`}
  </article>
  ${faqHtml}
</main>`;

  return htmlDoc({ title, description, canonical, ogImage: image, ogType: 'article', headExtra, jsonLdItems: [blogPosting, breadcrumb, ...(faqPage ? [faqPage] : [])], bodyHtml });
}

async function renderListing(supabase, id, slugParam) {
  if (!UUID_RE.test(id)) {
    return htmlDoc({
      title: 'CardPop Marketplace',
      description: 'Buy, sell and trade trading cards on CardPop.',
      canonical: `${BASE_URL}/marketplace`,
      robots: 'noindex, follow',
      bodyHtml: '<main><h1>CardPop Marketplace</h1></main>',
    });
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, title, description, price, price_aud, category, condition, grade, grading_company, status, images, accepts_offers, created_at, updated_at, seller_id, vault_item:vault_items(card_name, set_name, year, condition, grade, grading_company, card_image, vault_images(storage_path)), seller:profiles!seller_id(username, display_name, business_name, store_slug)')
    .eq('id', id)
    .maybeSingle();

  const canonical = `${BASE_URL}/marketplace/${id}/${listing?.slug || slugParam || 'listing'}`;

  if (!listing || listing.status !== 'active') {
    return htmlDoc({
      title: 'Listing Unavailable | CardPop',
      description: 'This marketplace listing is no longer available on CardPop.',
      canonical,
      robots: 'noindex, follow',
      bodyHtml: '<main><h1>Listing Unavailable</h1><p>This listing is sold or no longer active.</p></main>',
    });
  }

  const card = listing.vault_item || {};
  const cardName = listing.title || card.card_name || 'Trading Card';
  const imgPath = listing.images?.[0] || card.vault_images?.[0]?.storage_path || card.card_image;
  const image = imgPath
    ? (imgPath.startsWith('http') ? imgPath : supabase.storage.from('vault-images').getPublicUrl(imgPath).data.publicUrl)
    : undefined;
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
  ${price > 0 ? `<p><strong>A$${esc(Number(price).toFixed(2))}</strong>${listing.accepts_offers ? ' (offers accepted)' : ''}</p>` : ''}
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
    return htmlDoc({
      title: 'CardPop Shop',
      description: 'Shop official CardPop sealed products, singles and accessories.',
      canonical: `${BASE_URL}/shop`,
      robots: 'noindex, follow',
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
    return htmlDoc({
      title: 'Product Unavailable | CardPop',
      description: 'This product is no longer available in the CardPop shop.',
      canonical,
      robots: 'noindex, follow',
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
  '/browse': {
    title: 'Browse Listings | CardPop', h1: 'Browse Cards', breadcrumb: 'Browse', source: 'listings',
    description: 'Browse all trading card listings on CardPop — Pokemon, Magic, Yu-Gi-Oh, sports cards and more.',
    intro: 'Every active trading card listing on CardPop, from Pokémon to sports cards.',
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
      const image = imgPath
        ? (imgPath.startsWith('http') ? imgPath : supabase.storage.from('vault-images').getPublicUrl(imgPath).data.publicUrl)
        : undefined;
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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const rawPath = String(req.query.path || '').split('?')[0];

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

    if (rawPath === '/community/local-traders') {
      return res.status(200).send(await renderLocalTraders(supabase));
    }

    if (LANDINGS[rawPath]) {
      return res.status(200).send(await renderLanding(supabase, rawPath));
    }

    const shopProductMatch = rawPath.match(/^\/product\/shop\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (shopProductMatch) {
      const id = decodeURIComponent(shopProductMatch[1]);
      const slug = shopProductMatch[2] ? decodeURIComponent(shopProductMatch[2]) : undefined;
      return res.status(200).send(await renderShopProduct(supabase, id, slug));
    }

    const dealerMatch = rawPath.match(/^\/dealer\/([^/?#]+)/);
    if (dealerMatch) {
      const id = decodeURIComponent(dealerMatch[1]);
      return res.status(200).send(await renderDealer(supabase, id));
    }

    const listingMatch = rawPath.match(/^\/marketplace\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (listingMatch) {
      const id = decodeURIComponent(listingMatch[1]);
      const slug = listingMatch[2] ? decodeURIComponent(listingMatch[2]) : undefined;
      return res.status(200).send(await renderListing(supabase, id, slug));
    }

    const blogMatch = rawPath.match(/^\/blog\/([^/?#]+)/);
    if (blogMatch && decodeURIComponent(blogMatch[1]) !== 'category') {
      const param = decodeURIComponent(blogMatch[1]);
      return res.status(200).send(await renderBlogArticle(supabase, param));
    }

    // Unknown path — return a minimal, non-indexable document.
    return res.status(200).send(htmlDoc({
      title: 'CardPop | Australia\'s Trading Card Marketplace',
      description: 'Buy, sell and trade trading cards on CardPop.',
      canonical: `${BASE_URL}${rawPath || '/'}`,
      robots: 'noindex, follow',
      bodyHtml: '<main><h1>CardPop</h1></main>',
    }));
  } catch (err) {
    console.error('Prerender error:', err);
    return res.status(200).send(htmlDoc({
      title: 'CardPop',
      description: 'Buy, sell and trade trading cards on CardPop.',
      canonical: `${BASE_URL}${rawPath || '/'}`,
      robots: 'noindex, follow',
      bodyHtml: '<main><h1>CardPop</h1></main>',
    }));
  }
}
