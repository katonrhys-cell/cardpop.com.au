import React from 'react';
import { Helmet } from 'react-helmet';

const SEOHead = ({ title, description, canonicalUrl, structuredData }) => {
  const siteName = "CardPop";
  const defaultTitle = `${siteName} | Premier Trading Card Marketplace`;
  const defaultDescription = "Buy, sell, and trade authenticated trading cards, collectibles, and TCG accessories on CardPop.";
  
  return (
    <Helmet>
      <title>{title || defaultTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      
      {/* Open Graph */}
      <meta property="og:title" content={title || defaultTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title || defaultTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
      
      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
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