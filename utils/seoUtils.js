export const generateMetaTitle = (category, subcategory = null, productType = null, itemName = null) => {
  const baseName = "CardPop";
  if (itemName) {
    return `${itemName} | Buy & Sell ${baseName}`;
  }
  
  let parts = [];
  if (productType) parts.push(productType.name);
  if (subcategory) parts.push(subcategory.name);
  if (category) parts.push(category.name);
  
  if (parts.length > 0) {
    return `${parts.join(' - ')} | ${baseName}`;
  }
  return `Shop Trading Cards & Collectibles | ${baseName}`;
};

export const generateMetaDescription = (category, itemCount = 0, priceRange = null) => {
  const categoryName = category ? category.name : "Trading Cards & Collectibles";
  let desc = `Discover ${itemCount > 0 ? itemCount + '+' : 'a wide selection of'} ${categoryName} on CardPop. `;
  
  if (priceRange && priceRange.min !== null && priceRange.max !== null) {
    desc += `Prices ranging from $${priceRange.min} to $${priceRange.max}. `;
  }
  
  desc += "Buy, sell, and trade securely in our verified marketplace.";
  return desc;
};

export const generateStructuredData = (product, categoryPath = null) => {
  if (!product) return null;

  const baseData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.title || product.cardName || product.name,
    "image": product.images ? product.images.map(i => i.url) : [],
    "description": product.description || `Buy ${product.title || product.cardName} securely.`,
    "sku": product.sku || product.id,
    "offers": {
      "@type": "Offer",
      "url": typeof window !== 'undefined' ? window.location.href : '',
      "priceCurrency": product.currency || "AUD",
      "price": product.price || product.askingPrice || product.estimatedValue,
      "itemCondition": product.condition ? `https://schema.org/${product.condition.replace(/\s+/g, '')}Condition` : "https://schema.org/UsedCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "CardPop Marketplace"
      }
    }
  };

  // Add aggregate rating if available
  if (product.rating || product.averageRating) {
    baseData.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": product.rating || product.averageRating,
      "reviewCount": product.reviewCount || product.totalReviews || 1,
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  // Add reviews if available
  if (product.reviews && product.reviews.length > 0) {
    baseData.review = product.reviews.map(review => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.author || review.username || "Anonymous"
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating,
        "bestRating": "5",
        "worstRating": "1"
      },
      "reviewBody": review.text || review.comment || ""
    }));
  }

  return baseData;
};

export const generateBreadcrumbStructuredData = (breadcrumbs) => {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url
    }))
  };
};

export const generateFAQStructuredData = (faqs) => {
  if (!faqs || faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
};

export const generateLocalBusinessSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "name": "CardPop",
    "description": "Australia's most trusted trading card marketplace for Pokémon, Magic: The Gathering, sports cards and more.",
    "url": "https://cardpop.com.au",
    "address": {
      "@type": "PostalAddress",
      "postOfficeBoxNumber": "1024",
      "addressLocality": "Ascot Vale",
      "addressRegion": "VIC",
      "postalCode": "3032",
      "addressCountry": "AU"
    },
    "areaServed": {
      "@type": "Country",
      "name": "Australia"
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ],
      "opens": "00:00",
      "closes": "23:59"
    },
    "priceRange": "$$"
  };
};

// Map a trading-card condition / grade to a schema.org OfferItemCondition.
// Kept consistent with api/prerender.js so client- and bot-rendered markup agree.
export const mapItemCondition = (c) => {
  const v = String(c || '').toLowerCase();
  if (!v) return null;
  if (/(gem|mint|sealed|brand new|\bnm\b|graded)/.test(v) || /\b(8|8\.5|9|9\.5|10)\b/.test(v)) return 'https://schema.org/NewCondition';
  if (/(damaged|poor|heavily played|\bhp\b)/.test(v)) return 'https://schema.org/DamagedCondition';
  return 'https://schema.org/UsedCondition';
};

// Build a schema.org Product (with a nested Offer when a price is known).
export const generateProductSchema = ({
  name, image, description, url, price, currency = 'AUD',
  condition, availability = 'InStock', sellerName, brand, category,
  cardNumber, setName, sku, identifier,
} = {}) => {
  if (!name) return null;

  const images = (Array.isArray(image) ? image : [image]).filter(Boolean);

  // Build identifier: prefer explicit identifier, fall back to card number or set+card combo
  const gtin = identifier || (cardNumber && setName ? `${setName}-${cardNumber}` : cardNumber) || undefined;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(images.length ? { image: images } : {}),
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(gtin ? { gtin } : {}),
    ...(sku ? { sku } : {}),
  };

  if (price > 0) {
    const itemCondition = condition ? mapItemCondition(condition) : null;
    data.offers = {
      '@type': 'Offer',
      price: Number(price).toFixed(2),
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
      ...(itemCondition ? { itemCondition } : {}),
      ...(url ? { url } : {}),
      ...(sellerName ? { seller: { '@type': 'Organization', name: sellerName } } : {}),
    };
  }

  return data;
};

export const generateBlogPostingSchema = (blogPost) => {
  if (!blogPost) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": blogPost.title,
    "image": blogPost.image || blogPost.featuredImage,
    "author": {
      "@type": "Person",
      "name": blogPost.author || "CardPop Team",
      "url": "https://cardpop.com.au/blog"
    },
    "datePublished": blogPost.publishedAt || blogPost.created,
    "dateModified": blogPost.updated,
    "description": blogPost.excerpt || blogPost.description,
    "url": typeof window !== 'undefined' ? window.location.href : ''
  };
};

export const generateSitemap = (listings, products) => {
  // A helper function to generate XML strings. 
  // In a real frontend app, this is often handled by a serverless function, but we can generate text.
  const baseUrl = "https://cardpop.com.au";
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
  xml += `  <url>\n    <loc>${baseUrl}/vault</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  xml += `  <url>\n    <loc>${baseUrl}/shop</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  
  listings?.forEach(item => {
    xml += `  <url>\n    <loc>${baseUrl}/vault/listing/${item.id}</loc>\n    <lastmod>${new Date(item.updated).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  });

  products?.forEach(item => {
    xml += `  <url>\n    <loc>${baseUrl}/shop/product/${item.id}</loc>\n    <lastmod>${new Date(item.updated).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  });

  xml += `</urlset>`;
  return xml;
};