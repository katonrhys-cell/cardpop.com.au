import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';

// Since this is a React app, we render an HTML sitemap for users,
// but usually search engines hit /sitemap.xml which is served by a backend.
// We provide this as a fallback HTML index of links.
const SitemapPage = () => {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    const fetchSitemapData = async () => {
      try {
        const [vaultRes, shopRes] = await Promise.all([
          supabase.from('vault_items').select('id, card_name').eq('is_public', true).limit(100),
          supabase.from('listings').select('id, slug, vault_item_id, vault_item:vault_items(card_name)').eq('status', 'active').limit(100),
        ]);

        // Curated index of the main destinations, so the HTML sitemap is a real
        // navigational fallback rather than just Home/Vault/Shop + listings.
        const staticLinks = [
          { label: 'Home', path: '/' },
          { label: 'Marketplace', path: '/marketplace' },
          { label: 'Shop', path: '/shop' },
          { label: 'Analytics', path: '/analytics' },
          { label: 'Card Prices (AUD)', path: '/prices' },
          { label: 'Grading Hub', path: '/grading' },
          { label: 'Card Shop Directory', path: '/card-shops' },
          { label: 'Events', path: '/events' },
          { label: 'Community', path: '/community' },
          { label: 'Blog', path: '/blog' },
          { label: 'Pricing & Plans', path: '/pricing' },
          { label: 'About', path: '/about' },
          { label: 'Contact', path: '/contact' },
          { label: 'FAQ & Help', path: '/faq' },
          { label: 'Shipping', path: '/shipping' },
          { label: 'Returns & Refunds', path: '/returns' },
          { label: 'Trust & Safety', path: '/trust-safety' },
          { label: 'Terms of Service', path: '/terms' },
          { label: 'Privacy Policy', path: '/privacy' },
        ];

        const combined = [
          ...staticLinks,
          ...(vaultRes.data ?? []).map(i => ({ label: i.card_name || 'Vault Item', path: `/product/vault/${i.id}` })),
          ...(shopRes.data ?? []).map(i => ({ label: i.vault_item?.card_name || 'Marketplace Listing', path: `/marketplace/${i.id}/${i.slug || 'listing'}` })),
        ];
        
        setLinks(combined);
      } catch (err) {
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
            <Link to={link.path} className="text-primary hover:underline text-sm block py-1">
              {link.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SitemapPage;