
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient.js';
import { Star, ShieldCheck, MapPin, Calendar, ExternalLink, ShieldAlert, Package, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import VaultListingCard from '@/components/VaultListingCard.jsx';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';

const PublicSellerProfilePage = () => {
  const { userId } = useParams();
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ totalListings: 0, averageRating: 0, totalReviews: 0 });

  useEffect(() => {
    let isMounted = true;

    const fetchSellerData = async () => {
      try {
        setLoading(true);

        // Fetch user profile
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (userError) throw userError;

        if (userData.is_public === false) {
          throw new Error('This profile is private.');
        }

        // Fetch Vault listings (public ones)
        const { data: vaultData } = await supabase
          .from('vault_items')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_public', true)
          .neq('listing_type', 'Private')
          .order('created_at', { ascending: false })
          .limit(20);

        // Fetch Marketplace listings
        const { data: marketplaceData } = await supabase
          .from('listings')
          .select('*')
          .eq('seller_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(20);

        // Fetch Reviews
        const { data: reviewsData, count: reviewsCount } = await supabase
          .from('reviews')
          .select('*', { count: 'exact' })
          .eq('recipient_id', userId);

        if (!isMounted) return;

        setSeller(userData);

        // Combine listings
        const combined = [
          ...(vaultData || []).map(item => ({ ...item, _type: 'vault' })),
          ...(marketplaceData || []).map(item => ({ ...item, _type: 'marketplace' }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setListings(combined);

        // Calculate stats
        const totalReviews = reviewsCount || 0;
        const avgRating = totalReviews > 0
          ? (reviewsData || []).reduce((acc, curr) => acc + curr.rating, 0) / totalReviews
          : (userData.rating || 0);

        setStats({
          totalListings: combined.length,
          averageRating: avgRating,
          totalReviews: totalReviews || (userData.reviews_count || 0)
        });

      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError(err.message || 'Profile not found.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSellerData();

    return () => { isMounted = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-64 w-full rounded-[2rem]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-48 rounded-[2rem]" />
          <Skeleton className="h-48 rounded-[2rem] md:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
        <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Profile Unavailable</h2>
        <p className="text-muted-foreground max-w-md">{error}</p>
        <Button asChild className="mt-6 rounded-xl font-bold">
          <Link to="/marketplace">Return to Marketplace</Link>
        </Button>
      </div>
    );
  }

  const avatarUrl = seller.profile_photo_or_character
    ? (seller.profile_photo_or_character.startsWith('http')
        ? seller.profile_photo_or_character
        : supabase.storage.from('vault-images').getPublicUrl(seller.profile_photo_or_character).data.publicUrl)
    : null;
  const isVerified = seller.is_admin === true || seller.is_verified === true || seller.is_verified === 'true';

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>{`${seller.display_name || seller.name || 'Seller'} | CardPop Profile`}</title>
      </Helmet>

      {/* Profile Header Banner */}
      <div className="bg-[hsl(var(--profile-bg))] border-b border-[hsl(var(--section-divider))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
            
            {/* Avatar */}
            <div className="shrink-0 relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] bg-muted border-4 border-card shadow-xl flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={seller.display_name || seller.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-bold text-muted-foreground">
                    {(seller.display_name || seller.name || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {isVerified && (
                <div className="absolute -bottom-2 -right-2 bg-[hsl(var(--verified-badge))] text-white p-2 rounded-xl shadow-lg border-2 border-card" title="Verified Collector">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
                  {seller.display_name || seller.name || 'Community Member'}
                </h1>
                {isVerified && <Badge className="bg-[hsl(var(--verified-badge))] hover:bg-[hsl(var(--verified-badge))]/90 font-bold border-none shadow-sm text-white">Verified</Badge>}
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground mb-6">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-[hsl(var(--rating-color))] text-[hsl(var(--rating-color))]" />
                  <span className="text-foreground font-bold">{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'New'}</span>
                  <span>({stats.totalReviews} reviews)</span>
                </div>
                {seller.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{seller.location}</span>
                  </div>
                )}
                {seller.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Member since {new Date(seller.created_at).getFullYear()}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>{stats.totalListings} active listings</span>
                </div>
              </div>

              {/* Bio */}
              <p className="text-foreground/80 leading-relaxed max-w-3xl mb-6">
                {seller.bio || "This collector hasn't added a bio yet."}
              </p>

              {/* Actions / Socials */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <Button className="rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-transform">
                  <MessageSquare className="w-4 h-4 mr-2" /> Message User
                </Button>
                
                {seller.social_links && Object.keys(seller.social_links).length > 0 && (
                  <div className="flex items-center gap-2 pl-4 border-l border-[hsl(var(--section-divider))]">
                    {Object.entries(seller.social_links).map(([platform, link]) => (
                      <a key={platform} href={link} target="_blank" rel="noopener noreferrer" className="p-2 text-muted-foreground hover:text-primary transition-colors bg-muted/50 rounded-lg">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm">
            <h3 className="font-bold text-foreground mb-4 uppercase text-xs tracking-wider">Looking For</h3>
            {seller.looking_for ? (
              <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                <p>{seller.looking_for}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not specified.</p>
            )}
          </div>
          
          <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm">
            <h3 className="font-bold text-foreground mb-4 uppercase text-xs tracking-wider">Seller Stats</h3>
            <div className="space-y-4 text-sm font-medium">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Response Time</span>
                <span className="text-foreground">~2 hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Transactions</span>
                <span className="text-foreground">{seller.inventoryCount || stats.totalListings * 3}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Listings Grid */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold text-foreground">Active Listings</h2>
            <Badge variant="secondary" className="font-bold rounded-lg">{stats.totalListings} Items</Badge>
          </div>

          {listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {listings.map(item => (
                item._type === 'vault' 
                  ? <VaultListingCard key={item.id} vaultItem={item} />
                  : <MarketplaceListingCard key={item.id} listing={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-card rounded-[2rem] border border-border border-dashed">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-1">No Active Listings</h3>
              <p className="text-muted-foreground">This user currently has no items listed for sale or trade.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PublicSellerProfilePage;
