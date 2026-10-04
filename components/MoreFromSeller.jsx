import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { LISTING_CARD_VAULT_EMBED_INNER } from '@/lib/listingCardColumns.js';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';

// "More from this seller" — the cheapest cross-sell on a marketplace: the
// buyer already trusts this seller enough to be here, and combining cards
// saves them postage. Renders nothing when the seller has no other live cards.
const SELLER_EMBED = 'seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, is_admin, is_sole_trader, business_name, business_logo_url, store_slug, seller_tier, rating, reviews_count)';

const MoreFromSeller = ({ sellerId, excludeListingId, sellerName, storePath, limit = 4, className = '' }) => {
  const [listings, setListings] = useState([]);

  useEffect(() => {
    if (!sellerId) return undefined;
    let cancelled = false;
    supabase
      .from('listings')
      .select(`*, ${LISTING_CARD_VAULT_EMBED_INNER}, ${SELLER_EMBED}`)
      .eq('seller_id', sellerId)
      .eq('status', 'active')
      .neq('listing_type', 'vault')
      .neq('id', excludeListingId || '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setListings(data || []);
      }, () => {});
    return () => { cancelled = true; };
  }, [sellerId, excludeListingId, limit]);

  if (listings.length === 0) return null;

  return (
    <section className={className} aria-labelledby="more-from-seller-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="more-from-seller-heading" className="text-2xl font-bold font-serif text-foreground">More from {sellerName || 'this seller'}</h2>
          <p className="text-sm text-muted-foreground">Combine cards from one seller and save on postage.</p>
        </div>
        <Link to={storePath || `/seller/${sellerId}`} className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          See all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {listings.map((listing) => (
          <ErrorBoundary key={listing.id} fallback={null}>
            <MarketplaceListingCard listing={listing} />
          </ErrorBoundary>
        ))}
      </div>
    </section>
  );
};

export default MoreFromSeller;
