import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import {
  Star, ShieldCheck, MapPin, Calendar, ExternalLink, ShieldAlert,
  Package, MessageSquare, BadgeCheck, CheckCircle2, Truck, Heart, Zap, RotateCcw,
} from 'lucide-react';
import SellerTierBadge from '@/components/SellerTierBadge.jsx';
import VerifiedBadge from '@/components/VerifiedBadge.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import VaultListingCard from '@/components/VaultListingCard.jsx';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';

const BADGE_META = {
  authentic:          { label: '100% Authentic',     desc: 'All cards verified before listing',                   Icon: CheckCircle2 },
  safe_secure:        { label: 'Safe & Secure',       desc: 'Cards packed with care and protection',               Icon: ShieldCheck  },
  worldwide_shipping: { label: 'Worldwide Shipping',  desc: 'Fast & reliable shipping Australia & Worldwide',      Icon: Truck        },
  collector_first:    { label: 'Collector First',     desc: "We're collectors too — you're in good hands",         Icon: Heart        },
  fast_dispatch:      { label: 'Fast Dispatch',       desc: 'Ships within 1–2 business days',                     Icon: Zap          },
  returns_accepted:   { label: 'Returns Accepted',    desc: '7-day returns on eligible items',                     Icon: RotateCcw    },
};

const SoleTraderStorePage = () => {
  const { userId } = useParams();
  const [dealer, setDealer]   = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats]     = useState({ totalListings: 0, averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    (async () => {
      try {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileErr) throw profileErr;
        if (!profile.is_sole_trader) throw new Error('This page is not a dealer store.');
        if (profile.is_public === false) throw new Error('This store is private.');

        const [marketplaceRes, vaultRes, reviewsRes] = await Promise.all([
          supabase.from('listings')
            .select('*, vault_item:vault_items(*, vault_images(*)), seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)')
            .eq('seller_id', userId).eq('status', 'active')
            .order('created_at', { ascending: false }).limit(24),
          supabase.from('vault_items')
            .select('*, vault_images(*), owner:profiles!vault_items_owner_id_fkey(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)')
            .eq('owner_id', userId).eq('is_public', true).neq('listing_type', 'Private')
            .order('created_at', { ascending: false }).limit(24),
          supabase.from('reviews')
            .select('*', { count: 'exact' })
            .eq('recipient_id', userId),
        ]);

        if (!mounted) return;

        const listedIds = new Set((marketplaceRes.data || []).map(l => l.vault_item_id).filter(Boolean));
        const combined = [
          ...(vaultRes.data || []).filter(i => !listedIds.has(i.id)).map(i => ({ ...i, _type: 'vault' })),
          ...(marketplaceRes.data || []).map(i => ({ ...i, _type: 'marketplace' })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const totalReviews = reviewsRes.count ?? 0;
        const avgRating = totalReviews > 0
          ? (reviewsRes.data || []).reduce((s, r) => s + r.rating, 0) / totalReviews
          : (profile.rating || 0);

        setDealer(profile);
        setListings(combined);
        setStats({ totalListings: combined.length, averageRating: avgRating, totalReviews: totalReviews || (profile.reviews_count || 0) });
      } catch (err) {
        if (mounted) { console.error(err); setError(err.message || 'Store not found.'); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [userId]);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8 animate-in fade-in duration-500">
      <Skeleton className="h-72 w-full rounded-[2rem]" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Skeleton className="h-56 rounded-[2rem]" />
        <Skeleton className="h-56 rounded-[2rem] md:col-span-2" />
      </div>
    </div>
  );

  if (error || !dealer) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
      <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Store Unavailable</h2>
      <p className="text-muted-foreground max-w-md">{error}</p>
      <Button asChild className="mt-6 rounded-xl font-bold">
        <Link to="/marketplace">Return to Marketplace</Link>
      </Button>
    </div>
  );

  const isVerified   = dealer.is_admin || dealer.is_verified;
  const isDealer     = dealer.is_sole_trader && isVerified;
  const logoUrl      = dealer.business_logo_url || dealer.avatar_url || null;
  const categories   = dealer.business_categories ?? [];
  const trustBadges  = (dealer.dealer_trust_badges ?? []).map(k => BADGE_META[k]).filter(Boolean);

  const displayName  = dealer.business_name || dealer.display_name || 'Dealer';
  const location     = [dealer.location_suburb, dealer.location_state].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead
        title={`${displayName} | CardPop Dealer`}
        description={dealer.business_tagline || `${displayName} — trading card dealer on CardPop Australia.`}
      />

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="bg-[hsl(var(--profile-bg))] border-b border-[hsl(var(--section-divider))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">

            {/* Logo */}
            <div className="shrink-0 relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] bg-muted border-4 border-card shadow-xl flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-bold text-muted-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {isDealer && (
                <div className="absolute -bottom-2 -right-2 bg-[hsl(var(--verified-badge,214,100%,50%))] bg-primary text-primary-foreground p-2 rounded-xl shadow-lg border-2 border-card" title="Verified Dealer">
                  <BadgeCheck className="w-6 h-6" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">{displayName}</h1>
                {isDealer && (
                  <Badge className="bg-primary text-primary-foreground rounded-xl px-3 py-1 font-bold text-sm gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5" /> Verified Dealer
                  </Badge>
                )}
                {!isDealer && isVerified && <VerifiedBadge size="md" showLabel />}
                {dealer.seller_tier && dealer.seller_tier !== 'none' && (
                  <SellerTierBadge tier={dealer.seller_tier} size="md" />
                )}
              </div>

              {dealer.business_tagline && (
                <p className="text-lg text-muted-foreground font-medium mb-3">{dealer.business_tagline}</p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground mb-5">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-foreground font-bold">{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'New'}</span>
                  <span>({stats.totalReviews} reviews)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span><span className="text-foreground font-bold">{dealer.total_sales ?? 0}</span> sales</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span><span className="text-foreground font-bold">{stats.totalListings}</span> listings</span>
                </div>
                {location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{location}</span>
                  </div>
                )}
                {dealer.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Member since {new Date(dealer.created_at).getFullYear()}</span>
                  </div>
                )}
              </div>

              {dealer.bio && (
                <p className="text-foreground/80 leading-relaxed max-w-3xl mb-5">{dealer.bio}</p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <Button className="rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-transform">
                  <MessageSquare className="w-4 h-4 mr-2" /> Message Dealer
                </Button>
                <Button asChild variant="outline" className="rounded-xl font-bold">
                  <Link to={`/seller/${userId}`}>
                    <ExternalLink className="w-4 h-4 mr-2" /> Full Profile
                  </Link>
                </Button>
                {dealer.social_links && Object.entries(dealer.social_links).filter(([, v]) => v).map(([platform, link]) => (
                  <a key={platform} href={link} target="_blank" rel="noopener noreferrer"
                    title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                    className="p-2.5 text-muted-foreground hover:text-primary transition-colors bg-muted/50 rounded-xl border border-border">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trust badge strip */}
        {trustBadges.length > 0 && (
          <div className="border-t border-[hsl(var(--section-divider))]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-3">
                {trustBadges.map(({ label, desc, Icon }) => (
                  <div key={label} className="flex items-center gap-2.5" title={desc}>
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-bold text-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">

          {/* Categories */}
          {categories.length > 0 && (
            <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm">
              <h3 className="font-bold text-foreground mb-4 uppercase text-xs tracking-wider">Categories</h3>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <Badge key={cat} variant="secondary" className="rounded-lg text-xs font-semibold">{cat}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Shipping */}
          {dealer.dealer_shipping_policy && (
            <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm">
              <h3 className="font-bold text-foreground mb-3 uppercase text-xs tracking-wider">Shipping Policy</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{dealer.dealer_shipping_policy}</p>
            </div>
          )}

          {/* ABN */}
          {dealer.abn && (
            <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm">
              <h3 className="font-bold text-foreground mb-2 uppercase text-xs tracking-wider">ABN</h3>
              <p className="text-sm font-mono text-muted-foreground">{dealer.abn}</p>
            </div>
          )}

          {/* Stats */}
          <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-foreground uppercase text-xs tracking-wider">Store Stats</h3>
            {dealer.seller_tier && dealer.seller_tier !== 'none' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Seller Tier</span>
                <SellerTierBadge tier={dealer.seller_tier} size="sm" />
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rating</span>
              <span className="font-bold">{stats.averageRating > 0 ? `${stats.averageRating.toFixed(1)} / 5` : 'New'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reviews</span>
              <span className="font-bold">{stats.totalReviews}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed Sales</span>
              <span className="font-bold">{dealer.total_sales ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Listings</span>
              <span className="font-bold">{stats.totalListings}</span>
            </div>
          </div>
        </div>

        {/* Listings */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold text-foreground">Store Listings</h2>
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
            <div className="text-center py-24 bg-card rounded-[2rem] border border-border border-dashed">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-1">No Active Listings</h3>
              <p className="text-muted-foreground">This dealer has no items listed at the moment. Check back soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoleTraderStorePage;
