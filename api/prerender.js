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
  let query = supabase
    .from('blog_articles')
    .select('id, slug, title, seo_title, seo_description, excerpt, content_html, content, featured_image_url, author, category, published_at, created_at, updated_at, read_time_minutes, is_published');
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
</main>`;

  return htmlDoc({ title, description, canonical, ogImage: image, ogType: 'article', headExtra, jsonLdItems: [blogPosting, breadcrumb], bodyHtml });
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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const rawPath = String(req.query.path || '').split('?')[0];

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

    if (rawPath === '/community/local-traders') {
      return res.status(200).send(await renderLocalTraders(supabase));
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
