import React from 'react';
import { Helmet } from 'react-helmet';

const SEOHead = ({ title, description, canonicalUrl, ogImage, structuredData }) => {
  const siteName = "CardPop";
  const defaultTitle = `${siteName} | Australia's Trading Card Marketplace | CardPop.online`;
  const defaultDescription = "Buy, sell, and trade authenticated trading cards in Australia. Browse Pokemon, Magic, Yu-Gi-Oh and more on CardPop.";
  const resolvedCanonical = canonicalUrl || (typeof window !== 'undefined' ? window.location.href.split('?')[0] : '');
  const resolvedTitle = title || defaultTitle;
  const resolvedDesc = description || defaultDescription;

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
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDesc} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* Structured Data JSON-LD */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;