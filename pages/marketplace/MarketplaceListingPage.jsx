import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient.js';
import { formatCurrency } from '@/api/EcommerceApi';
import { Button } from '@/components/ui/button';
import { ShieldCheck, MessageCircle, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const MarketplaceListingPage = () => {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('*, seller:profiles!seller_id(*)')
          .eq('id', id)
          .single();
        if (error) throw error;
        setListing(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  if (loading) return <div className="container-default section-padding"><Skeleton className="h-[600px] rounded-2xl" /></div>;
  if (!listing) return <div className="container-default section-padding text-center">Listing not found</div>;

  return (
    <div className="container-default section-padding min-h-[80vh]">
      <Helmet><title>{listing.title} | Marketplace</title></Helmet>
      
      <div className="flex flex-col lg:flex-row gap-12">
        <div className="w-full lg:w-3/5">
          <div className="bg-secondary/20 rounded-3xl p-4 border border-border aspect-square flex items-center justify-center overflow-hidden">
             {listing.images?.length > 0 ? (
               <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-contain mix-blend-multiply" />
             ) : (
               <div className="text-muted-foreground">No image available</div>
             )}
          </div>
        </div>

        <div className="w-full lg:w-2/5 flex flex-col">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-secondary text-secondary-foreground text-sm font-medium rounded-full mb-4">
              {listing.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{listing.title}</h1>
            <p className="text-4xl font-bold text-primary mb-6">{formatCurrency(listing.price)}</p>
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

          <div className="mt-auto flex flex-col gap-3">
            <Button size="lg" className="w-full text-lg h-14 radius-btn">Buy Now</Button>
            <Button size="lg" variant="secondary" className="w-full text-lg h-14 radius-btn">
              <MessageCircle className="w-5 h-5 mr-2" /> Make an Offer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceListingPage;