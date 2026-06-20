import React from 'react';
import { Helmet } from 'react-helmet';

const SEOHead = ({ title, description, canonicalUrl, ogImage, structuredData }) => {
  const siteName = "CardPop";
  const defaultTitle = `${siteName} | Australia's Trading Card Marketplace`;
  const defaultDescription = "Buy, sell, and trade authenticated trading cards in Australia. Browse Pokemon, Magic, Yu-Gi-Oh and more on CardPop.";
  const resolvedCanonical = canonicalUrl || (typeof window !== 'undefined' ? window.location.href.split('?')[0] : '');
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