import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEOHead = ({ title, description, canonicalUrl, ogImage, structuredData }) => {
  const siteName = "CardPop";
  const SITE_ORIGIN = "https://cardpop.com.au";
  const defaultTitle = `${siteName} | Australia's Trading Card Marketplace`;
  const defaultDescription = "Buy, sell, and trade authenticated trading cards in Australia. Browse Pokemon, Magic, Yu-Gi-Oh and more on CardPop.";
  // Always emit an apex-host, query-stripped canonical so the tag never conflicts
  // with the static one in index.html (Lighthouse flagged www vs apex duplicates).
  const normalizeCanonical = (url) => {
    if (!url) return '';
    try {
      const u = new URL(url, SITE_ORIGIN);
      return `${SITE_ORIGIN}${u.pathname}`.replace(/\/+$/, '') || SITE_ORIGIN;
    } catch {
      return SITE_ORIGIN;
    }
  };
  const resolvedCanonical = normalizeCanonical(
    canonicalUrl || (typeof window !== 'undefined' ? window.location.pathname : '/')
  );
  const resolvedTitle = title || defaultTitle;
  const resolvedDesc = description || defaultDescription;

  const resolvedOgImage = ogImage || '/og-image.jpg';

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDesc} />

      {/* Canonical */}
      {resolvedCanonical && <link rel="canonical" href={resolvedCanonical} />}

      {/* Open Graph */}
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDesc} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      {resolvedCanonical && <meta property="og:url" content={resolvedCanonical} />}
      {resolvedOgImage && <meta property="og:image" content={resolvedOgImage} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDesc} />
      {resolvedOgImage && <meta name="twitter:image" content={resolvedOgImage} />}

      {/* Structured Data JSON-LD */}
      {structuredData && (() => {
        const items = Array.isArray(structuredData) ? structuredData.filter(Boolean) : [structuredData];
        if (items.length === 0) return null;
        const payload = items.length === 1
          ? items[0]
          : { '@context': 'https://schema.org', '@graph': items.map(({ '@context': _ctx, ...rest }) => rest) };
        return (
          <script type="application/ld+json">
            {JSON.stringify(payload)}
          </script>
        );
      })()}
    </Helmet>
  );
};

export default SEOHead;