import React, { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';

// Since this is a React app, we render an HTML sitemap for users,
// but usually search engines hit /sitemap.xml which is served by a backend.
// We provide this as a fallback HTML index of links.
const SitemapPage = () => {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    const fetchSitemapData = async () => {
      try {
        const vaultRes = await pb.collection('cardListings').getList(1, 100, { filter: 'marketplaceStatus != "Private"', $autoCancel: false });
        const shopRes = await pb.collection('shop_products').getList(1, 100, { $autoCancel: false });
        
        const combined = [
          { label: 'Home', path: '/' },
          { label: 'Vault', path: '/vault' },
          { label: 'Shop', path: '/shop' },
          ...vaultRes.items.map(i => ({ label: i.cardName || 'Vault Item', path: `/vault/listing/${i.id}` })),
          ...shopRes.items.map(i => ({ label: i.name || 'Shop Item', path: `/shop/product/${i.id}` }))
        ];
        
        setLinks(combined);
      } catch (err) {
        console.error("Failed to load sitemap links", err);
      }
    };
    fetchSitemapData();
  }, []);

  return (
    <div className="container-default section-padding">
      <SEOHead title="HTML Sitemap | CardPop" description="Site map for CardPop marketplace." />
      <h1 className="text-3xl font-bold font-heading mb-8 border-b pb-4">Site Index</h1>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-4">
        {links.map((link, idx) => (
          <div key={idx} className="break-inside-avoid">
            <a href={link.path} className="text-primary hover:underline text-sm block py-1">
              {link.label}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SitemapPage;