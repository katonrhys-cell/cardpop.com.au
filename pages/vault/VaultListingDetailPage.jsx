import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { generateStructuredData } from '@/utils/seoUtils.js';
import { addToRecentlyViewed } from '@/utils/recentlyViewed.js';
import { buildCardAnalyticsUrl } from '@/utils/cardSlug.js';
import BuyerProtection from '@/components/BuyerProtection.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ShieldCheck, BarChart3 } from 'lucide-react';
import PSAPopPanel from '@/components/PSAPopPanel.jsx';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';
import CertificationVerificationSection from '@/components/CertificationVerificationSection.jsx';
import { getCardAttributeRows } from '@/lib/cardAttributeLabels.js';
import { ROOKIE_VARIANT } from '@/lib/cardVariants.js';
import RookiePill from '@/components/RookiePill.jsx';

const VaultListingDetailPage = () => {
  const { itemId } = useParams();
  const [listing, setListing] = useState(null);
  const [psaData, setPsaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchListing = async () => {
      try {
        const { data: record, error } = await supabase
          .from('listings')
          .select('*, vault_item:vault_items!inner(*, vault_images(*)), seller:profiles!seller_id(display_name, username, avatar_url, is_verified)')
          .eq('id', itemId)
          .single();
        if (error) throw error;
        if (!cancelled) {
          setListing(record);

          // Fetch PSA population data if the card has been identified via CardSight
          const csId = record?.vault_item?.cardsight_card_id;
          if (csId) {
            supabase
              .from('card_market_valuations')
              .select('raw_data')
              .eq('card_id', csId)
              .eq('source', 'psa')
              .maybeSingle()
              .then(({ data }) => { if (data?.raw_data) setPsaData(data.raw_data); });
          }
        }
        
        // Track recently viewed
        if (record) {
          addToRecentlyViewed({
            id: record.id,
            title: record.vault_item?.card_name || record.title,
            image: record.vault_item?.vault_images?.[0]?.url,
            price: record.price_aud,
            type: 'listing'
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load listing');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchListing();
    return () => { cancelled = true; };
  }, [itemId]);

  if (loading) {
    return (
      <div className="container-default section-padding space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-2 gap-12">
          <Skeleton className="aspect-square rounded-2xl w-full" />
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-default section-padding text-center py-32">
        <p className="text-destructive font-medium mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  if (!listing) {
    return <div className="container-default section-padding text-center py-32"><h2 className="text-2xl font-bold">Listing not found</h2></div>;
  }

  const vi = listing.vault_item;
  const structuredData = generateStructuredData(listing);
  const title = vi?.card_name || 'Card Listing';
  const price = listing.price_aud || vi?.estimated_value_aud || 0;
  const allImages = [];
  if (vi?.card_image) allImages.push(vi.card_image);
  if (vi?.card_images?.length) vi.card_images.forEach(p => { if (p) allImages.push(p); });
  if (vi?.vault_images?.length) vi.vault_images.forEach(img => { if (img.storage_path && !allImages.includes(img.storage_path)) allImages.push(img.storage_path); });

  const breadcrumbs = [
    { label: 'Home', path: '/' },
    { label: 'Marketplace', path: '/marketplace' },
    { label: title, path: '#' }
  ];

  return (
    <div className="container-default section-padding">
      <SEOHead 
        title={`${title} | Vault Listing | CardPop`} 
        description={`Buy ${title} in ${listing.condition || 'good'} condition.`}
        structuredData={structuredData}
      />
      
      <Breadcrumb items={breadcrumbs} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
        {/* Image Gallery */}
        <div>
          <ProductImageCarousel images={allImages} frameClassName="bg-zinc-950" />
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <Badge variant="secondary" className="w-fit mb-4">{vi?.condition || 'Raw'}</Badge>
          
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground mb-4">
            {title}
          </h1>
          
          <div className="text-3xl font-bold text-primary font-heading mb-6">
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 mb-8 space-y-3">
            <h3 className="font-bold text-lg mb-2">Card Details</h3>
            {vi?.set_name && <div className="flex justify-between"><span className="text-muted-foreground">Set</span> <span className="font-medium text-right">{vi.set_name}</span></div>}
            {vi?.collection && <div className="flex justify-between"><span className="text-muted-foreground">Collection</span> <span className="font-medium">{vi.collection}</span></div>}
            {vi?.year && <div className="flex justify-between"><span className="text-muted-foreground">Year</span> <span className="font-medium">{vi.year}</span></div>}
            {vi?.card_number && <div className="flex justify-between"><span className="text-muted-foreground">Card Number</span> <span className="font-medium">#{vi.card_number}</span></div>}
            {vi?.condition && <div className="flex justify-between"><span className="text-muted-foreground">Condition</span> <span className="font-medium capitalize">{vi.condition.replace(/_/g, ' ')}</span></div>}
            {vi?.serial_number && <div className="flex justify-between"><span className="text-muted-foreground">Serial Number</span> <span className="font-extrabold text-primary">#{vi.serial_number}</span></div>}
            {vi?.grading_company && vi.grading_company !== 'raw' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grading</span>
                <span className="font-medium flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-primary" />{vi.grading_company.toUpperCase()} {vi.grade}</span>
              </div>
            )}
            {vi?.cert_number && <div className="flex justify-between"><span className="text-muted-foreground">Cert Number</span> <span className="font-medium">{vi.cert_number}</span></div>}
            {getCardAttributeRows(vi).map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right">{value}</span>
              </div>
            ))}

            {/* Attributes */}
            {(vi?.is_foil || vi?.is_refractor || vi?.is_auto || vi?.is_rookie || vi?.is_sealed) && (
              <div className="flex justify-between items-start pt-1">
                <span className="text-muted-foreground">Attributes</span>
                <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                  {vi.is_foil && <Badge variant="outline" className="text-[10px] font-bold border-yellow-400/50 text-yellow-700 bg-yellow-400/10">Foil</Badge>}
                  {vi.is_refractor && <Badge variant="outline" className="text-[10px] font-bold border-indigo-400/50 text-indigo-700 bg-indigo-400/10">Refractor</Badge>}
                  {vi.is_auto && <Badge variant="outline" className="text-[10px] font-bold border-blue-400/50 text-blue-700 bg-blue-400/10">Auto</Badge>}
                  {vi.is_rookie && <RookiePill />}
                  {vi.is_sealed && <Badge variant="outline" className="text-[10px] font-bold border-green-400/50 text-green-700 bg-green-400/10">Sealed</Badge>}
                </div>
              </div>
            )}

            {/* Variant / Finish */}
            {vi?.variant && (
              <div className="flex justify-between items-start pt-1">
                <span className="text-muted-foreground">Variant / Finish</span>
                <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                  {vi.variant.split(',').map(v => v.trim()).filter(v => v && v !== ROOKIE_VARIANT).map(v => (
                    <Badge key={v} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">{v}</Badge>
                  ))}
                </div>
              </div>
            )}

            {vi?.notes && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
                <p className="text-sm text-foreground whitespace-pre-line">{vi.notes}</p>
              </div>
            )}

            {/* PSA population data — shown when available */}
            {vi?.cardsight_card_id && (
              <div className="pt-4 border-t border-border">
                <PSAPopPanel rawData={psaData} />
              </div>
            )}

          </div>

          {/* Certification Verification Section */}
          {(vi?.cert_number || listing?.grading_number) && (
            <CertificationVerificationSection
              certNumber={vi?.cert_number || listing?.grading_number}
              gradingCompany={vi?.grading_company || listing?.grading_company || 'psa'}
              grade={vi?.grade}
            />
          )}

          <BuyerProtection className="mb-8" />

          <div className="mt-auto space-y-4">
            <Button size="lg" className="w-full h-14 text-lg font-bold gap-2">
              <ShoppingCart className="w-5 h-5" /> Buy Now
            </Button>
            <Button size="lg" variant="outline" className="w-full h-14 text-lg font-bold">
              Make Offer
            </Button>
            {/* Analytics link — passes cardsight_card_id if available for real market data */}
            <Link
              to={buildCardAnalyticsUrl({
                name: vi?.card_name || title,
                set: vi?.set_name || '',
                collection: vi?.collection || '',
                price,
                cardsight_id: vi?.cardsight_card_id,
              })}
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <BarChart3 className="w-4 h-4" /> View Market Analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultListingDetailPage;