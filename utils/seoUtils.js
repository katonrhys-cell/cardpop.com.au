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

  return {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.title || product.cardName || product.name,
    "image": product.images ? product.images.map(i => i.url) : [],
    "description": product.description || `Buy ${product.title || product.cardName} securely.`,
    "sku": product.sku || product.id,
    "offers": {
      "@type": "Offer",
      "url": typeof window !== 'undefined' ? window.location.href : '',
      "priceCurrency": product.currency || "USD",
      "price": product.price || product.askingPrice || product.estimatedValue,
      "itemCondition": product.condition ? `https://schema.org/${product.condition.replace(/\s+/g, '')}Condition` : "https://schema.org/UsedCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "CardPop Marketplace"
      }
    }
  };
};

export const generateSitemap = (listings, products) => {
  // A helper function to generate XML strings. 
  // In a real frontend app, this is often handled by a serverless function, but we can generate text.
  const baseUrl = "https://cardpop.example.com";
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