import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead.jsx';
import { generateStructuredData, generateBreadcrumbStructuredData } from '@/utils/seoUtils.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { ShieldCheck, MessageCircle, User, TrendingUp, Loader2, Flag } from 'lucide-react';
import ReportModal from '@/components/ReportModal.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import CertificationVerificationSection from '@/components/CertificationVerificationSection.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { useCart } from '@/hooks/useCart.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

const MarketplaceListingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartItems } = useCart();
  const { currentUser } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csPrice, setCsPrice] = useState(null);
  const [csPriceLoading, setCsPriceLoading] = useState(false);
  const [addingToCheckout, setAddingToCheckout] = useState(false);
  const fetchRef = useRef(null);

  // "Buy Now" purchases a fixed-price listing. It drops the listing into the
  // cart (once — a listing is a unique, single item) and jumps to checkout,
  // which works for guests too. Auction / expression-of-interest / trade
  // listings aren't bought this way, and you can't buy your own listing.
  const handleBuyNow = async () => {
    if (!listing || addingToCheckout) return;
    setAddingToCheckout(true);
    try {
      const product = {
        id: listing.id,
        source: 'marketplace',
        type: 'listing',
        title: listing.vault_item?.card_name || listing.title || 'Trading Card',
        price: Number(listing.price_aud) || 0,
        image: listing.images?.[0] || listing.vault_item?.vault_images?.[0]?.image_url || null,
      };
      const alreadyInCart = cartItems.some((i) => (i.product?.id) === listing.id);
      if (!alreadyInCart) await addToCart(product, product, 1);
      navigate('/checkout');
    } catch (err) {
      toast.error(err?.message || 'Could not start checkout. Please try again.');
      setAddingToCheckout(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchListing = async () => {
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('*, vault_item:vault_items!inner(*, vault_images(*)), seller:profiles!seller_id(*)')
          .eq('id', id)
          .single();
        if (error) throw error;
        if (!cancelled) setListing(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load listing');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRef.current = fetchListing;
    fetchListing();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`marketplace-listing-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vault_items' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Fetch eBay pricing once listing title is known (replaces CardSight autocomplete → pricing)
  useEffect(() => {
    if (!listing?.title) return;
    let cancelled = false;
    const fetchCsPrice = async () => {
      setCsPriceLoading(true);
      try {
        const prRes = await apiServerClient.fetch(
          `/ebay/price-estimate?name=${encodeURIComponent(listing.title)}`
        );
        if (!prRes.ok || cancelled) return;
        const prData = await prRes.json();
        if (!cancelled && prData.count > 0) setCsPrice(prData);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setCsPriceLoading(false);
      }
    };
    fetchCsPrice();
    return () => { cancelled = true; };
  }, [listing?.title]);

  if (loading) return <div className="container-default section-padding"><Skeleton className="h-[600px] rounded-2xl" /></div>;
  if (error) return (
    <div className="container-default section-padding text-center">
      <p className="text-destructive font-medium mb-4">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
    </div>
  );
  if (!listing) return <div className="container-default section-padding text-center">Listing not found</div>;

  // Rich-result structured data so search engines can surface price /
  // availability / condition for this listing (Product + Offer + breadcrumb).
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : undefined;
  const structuredData = [
    generateStructuredData({
      title: listing.title,
      description: listing.description,
      id: listing.id,
      price: listing.price_aud,
      currency: 'AUD',
      condition: listing.condition,
      images: (listing.images || []).map((url) => ({ url })),
    }),
    generateBreadcrumbStructuredData([
      { name: 'Home', url: 'https://cardpop.com.au/' },
      { name: 'Marketplace', url: 'https://cardpop.com.au/marketplace' },
      { name: listing.title, url: canonicalUrl },
    ]),
  ];

  return (
    <div className="container-default section-padding min-h-[80vh]">
      <SEOHead
        title={`${listing.title} | CardPop Marketplace`}
        description={listing?.description || listing?.title || 'View this marketplace listing on CardPop'}
        canonicalUrl={canonicalUrl}
        ogImage={listing.images?.[0]}
        structuredData={structuredData}
      />

      <div className="flex flex-col lg:flex-row gap-12">
        <div className="w-full lg:w-3/5">
          <div className="bg-secondary/20 rounded-3xl p-4 border border-border aspect-square flex items-center justify-center overflow-hidden">
             {listing.images?.length > 0 ? (
               <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-contain mix-blend-multiply" />
             ) : (
               <div className="text-muted-foreground">No image available</div>
             )}
          </div>

          {/* Certification details sit directly under the card image so the PSA
              record (and any PSA card scans) sit alongside the listing photo. */}
          {(listing?.grading_number || listing?.vault_item?.cert_number) && (
            <CertificationVerificationSection
              certNumber={listing.grading_number || listing.vault_item?.cert_number}
              gradingCompany={listing.grading_company || listing.vault_item?.grading_company || 'psa'}
              grade={listing.vault_item?.grade}
            />
          )}
        </div>

        <div className="w-full lg:w-2/5 flex flex-col">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-secondary text-secondary-foreground text-sm font-medium rounded-full mb-4">
              {listing.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{listing.title}</h1>
            <p className="text-4xl font-bold text-primary mb-6">${(listing.price_aud || 0).toFixed(2)}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 mb-8">
            <h3 className="font-bold mb-4 flex items-center gap-2"><User className="w-5 h-5"/> Seller Information</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{listing.seller?.full_name || listing.seller?.username || 'Anonymous User'}</p>
                <p className="text-sm text-muted-foreground">Joined {listing.seller?.created_at ? new Date(listing.seller.created_at).getFullYear() : 'N/A'}</p>
              </div>
              <Button variant="outline" size="sm">View Profile</Button>
            </div>
          </div>

          <div className="space-y-4 mb-8">
             <div className="flex justify-between py-3 border-b border-border">
               <span className="text-muted-foreground">Condition</span>
               <span className="font-medium">{listing.condition || 'Not specified'}</span>
             </div>
             <div className="flex justify-between py-3 border-b border-border">
               <span className="text-muted-foreground">Grade</span>
               <span className="font-medium">{listing.grade || 'Raw / Ungraded'}</span>
             </div>
             <div className="flex justify-between py-3 border-b border-border">
               <span className="text-muted-foreground">Protection</span>
               <span className="font-medium text-emerald-600 flex items-center gap-1"><ShieldCheck className="w-4 h-4"/> Covered</span>
             </div>
          </div>

          {/* CardSight market price reference */}
          {(csPriceLoading || csPrice) && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-6">
              <h3 className="font-bold text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" /> Market Price Reference
              </h3>
              {csPriceLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading market data…
                </div>
              ) : (() => {
                const avg = csPrice.avgPrice ?? csPrice.avg_price ?? csPrice.average_price ?? csPrice.mean_price;
                const min = csPrice.minPrice ?? csPrice.min_price ?? csPrice.minimum_price;
                const max = csPrice.maxPrice ?? csPrice.max_price ?? csPrice.maximum_price;
                const count = csPrice.count ?? csPrice.total_count ?? csPrice.total;
                if (!avg) return <p className="text-xs text-muted-foreground">No pricing data available.</p>;
                const listingPrice = listing.price ?? 0;
                const diff = avg > 0 ? (((listingPrice - avg) / avg) * 100).toFixed(0) : null;
                return (
                  <div className="space-y-2">
                    <div className="flex gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">30-day avg sold</p>
                        <p className="font-bold text-blue-700 dark:text-blue-400">${Number(avg).toFixed(2)}</p>
                      </div>
                      {min != null && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Low</p>
                          <p className="font-semibold">${Number(min).toFixed(2)}</p>
                        </div>
                      )}
                      {max != null && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">High</p>
                          <p className="font-semibold">${Number(max).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                    {diff !== null && (
                      <p className={`text-xs font-medium ${Number(diff) <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Number(diff) <= 0
                          ? `${Math.abs(diff)}% below market average — good value`
                          : `${diff}% above market average`}
                      </p>
                    )}
                    {count != null && <p className="text-xs text-muted-foreground">Based on {count} completed sales · powered by CardSight</p>}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3">
            {(() => {
              const isFixed = listing.listing_type === 'fixed';
              const isActive = listing.status === 'active';
              const isOwn = currentUser?.id && currentUser.id === listing.seller_id;
              const purchasable = isFixed && isActive && (Number(listing.price_aud) || 0) > 0 && !isOwn;
              // Only fixed-price listings are bought outright; auctions / offers
              // use their own flows. Show the Sold state on a sold fixed listing.
              if (!isFixed && isActive) return null;
              const label = !isActive
                ? 'No longer available'
                : isOwn
                  ? 'This is your listing'
                  : 'Buy Now';
              return (
                <Button
                  size="lg"
                  className="w-full text-lg h-14 radius-btn"
                  onClick={handleBuyNow}
                  disabled={!purchasable || addingToCheckout}
                >
                  {addingToCheckout ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                  {label}
                </Button>
              );
            })()}
            <Button size="lg" variant="secondary" className="w-full text-lg h-14 radius-btn">
              <MessageCircle className="w-5 h-5 mr-2" /> Make an Offer
            </Button>
            <div className="flex justify-center pt-1">
              <ReportModal
                targetType="listing"
                targetId={listing.id}
                trigger={
                  <button type="button" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                    <Flag className="w-3.5 h-3.5" /> Report this listing
                  </button>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceListingPage;