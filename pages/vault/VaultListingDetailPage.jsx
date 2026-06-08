import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { generateStructuredData } from '@/utils/seoUtils.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ShieldCheck, BarChart3 } from 'lucide-react';

const VaultListingDetailPage = () => {
  const { itemId } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const { data: record, error } = await supabase
          .from('listings')
          .select('*, vault_item:vault_items!inner(*, vault_images(*)), seller:profiles!seller_id(display_name, username, avatar_url, is_verified)')
          .eq('id', itemId)
          .single();
        if (error) throw error;
        setListing(record);
      } catch (err) {
        console.error("Error fetching listing:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
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

  if (!listing) {
    return <div className="container-default section-padding text-center py-32"><h2 className="text-2xl font-bold">Listing not found</h2></div>;
  }

  const vi = listing.vault_item;
  const structuredData = generateStructuredData(listing);
  const title = vi?.card_name || 'Card Listing';
  const price = listing.price_aud || vi?.estimated_value_aud || 0;
  const rawPath = vi?.card_image || vi?.vault_images?.[0]?.storage_path || null;
  const imageUrl = rawPath
    ? (rawPath.startsWith('http') ? rawPath : supabase.storage.from('vault-images').getPublicUrl(rawPath).data.publicUrl)
    : '/placeholder-card.png';

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
        <div className="bg-muted/30 p-8 rounded-3xl border border-border flex items-center justify-center">
          <img 
            src={imageUrl} 
            alt={title}
            className="w-full max-w-md h-auto object-contain rounded-xl drop-shadow-xl"
          />
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

          <div className="bg-card rounded-2xl border border-border p-6 mb-8 space-y-4">
            <h3 className="font-bold text-lg mb-2">Card Details</h3>
            {vi?.card_number && <div className="flex justify-between"><span className="text-muted-foreground">Card Number</span> <span className="font-medium">{vi.card_number}</span></div>}
            {vi?.year && <div className="flex justify-between"><span className="text-muted-foreground">Year</span> <span className="font-medium">{vi.year}</span></div>}
            {vi?.grading_company && vi.grading_company !== 'raw' && <div className="flex justify-between"><span className="text-muted-foreground">Grading</span> <span className="font-medium flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-primary" />{vi.grading_company.toUpperCase()} {vi.grade}</span></div>}
          </div>

          <div className="mt-auto space-y-4">
            <Button size="lg" className="w-full h-14 text-lg font-bold gap-2">
              <ShoppingCart className="w-5 h-5" /> Buy Now
            </Button>
            <Button size="lg" variant="outline" className="w-full h-14 text-lg font-bold">
              Make Offer
            </Button>
            {/* Analytics link — passes cardsight_card_id if available for real market data */}
            <Link
              to={`/analytics/card?name=${encodeURIComponent(vi?.card_name || title)}&set=${encodeURIComponent(vi?.set_name || '')}&collection=${encodeURIComponent(vi?.collection || '')}&price=${price}${vi?.cardsight_card_id ? `&cardsight_id=${vi.cardsight_card_id}` : ''}`}
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