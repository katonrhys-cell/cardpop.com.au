import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import BackButton from '@/components/BackButton.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { LISTING_CARD_VAULT_EMBED, VAULT_ITEM_CARD_SELECT } from '@/lib/listingCardColumns.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import {
  Star, ShieldCheck, MapPin, Calendar, ExternalLink, ShieldAlert,
  Package, MessageSquare, BadgeCheck, CheckCircle2, Truck, Heart, Zap, RotateCcw, Instagram,
} from 'lucide-react';

// Normalise a user-entered social link into an absolute URL.
const normalizeSocialUrl = (u) => {
  const v = String(u || '').trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`;
};

// Map a trading-card condition / grade to a schema.org OfferItemCondition.
const schemaItemCondition = (c) => {
  const v = String(c || '').toLowerCase();
  if (!v) return undefined;
  if (/(gem|mint|sealed|brand new|\bnm\b|graded)/.test(v) || /\b(8|8\.5|9|9\.5|10)\b/.test(v)) return 'https://schema.org/NewCondition';
  if (/(damaged|poor|heavily played|\bhp\b)/.test(v)) return 'https://schema.org/DamagedCondition';
  return 'https://schema.org/UsedCondition';
};
import SellerTierBadge from '@/components/SellerTierBadge.jsx';
import VerifiedBadge from '@/components/VerifiedBadge.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import VaultListingCard from '@/components/VaultListingCard.jsx';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';
import WhatnotIcon from '@/components/WhatnotIcon.jsx';

const BADGE_META = {
  authentic:          { label: '100% Authentic',     desc: 'All cards verified before listing',                   Icon: CheckCircle2 },
  safe_secure:        { label: 'Safe & Secure',       desc: 'Cards packed with care and protection',               Icon: ShieldCheck  },
  worldwide_shipping: { label: 'Worldwide Shipping',  desc: 'Fast & reliable shipping Australia & Worldwide',      Icon: Truck        },
  collector_first:    { label: 'Collector First',     desc: "We're collectors too — you're in good hands",         Icon: Heart        },
  fast_dispatch:      { label: 'Fast Dispatch',       desc: 'Ships within 1–2 business days',                     Icon: Zap          },
  returns_accepted:   { label: 'Returns Accepted',    desc: '7-day returns on eligible items',                     Icon: RotateCcw    },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SoleTraderStorePage = () => {
  // Route param may be a store slug (preferred) or a legacy UUID.
  const { userId: routeParam } = useParams();
  const navigate = useNavigate();
  const [dealer, setDealer]   = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats]     = useState({ totalListings: 0, averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!routeParam) return;
    let mounted = true;

    (async () => {
      try {
        // Resolve by slug, or by UUID for legacy/back-compat links.
        const byUuid = UUID_RE.test(routeParam);
        let profileQuery = supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS);
        profileQuery = byUuid
          ? profileQuery.eq('id', routeParam)
          : profileQuery.eq('store_slug', routeParam);
        const { data: profile, error: profileErr } = await profileQuery.maybeSingle();

        if (profileErr) throw profileErr;
        if (!profile) throw new Error('Store not found.');
        if (!profile.is_sole_trader) throw new Error('This page is not a dealer store.');
        if (profile.is_public === false) throw new Error('This store is private.');

        // Redirect legacy UUID links to the clean slug URL.
        if (byUuid && profile.store_slug && mounted) {
          navigate(`/dealer/${profile.store_slug}`, { replace: true });
          return;
        }

        const resolvedId = profile.id;
        const [marketplaceRes, vaultRes, reviewsRes] = await Promise.all([
          supabase.from('listings')
            .select(`*, ${LISTING_CARD_VAULT_EMBED}, seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)`)
            .eq('seller_id', resolvedId).eq('status', 'active')
            .order('created_at', { ascending: false }).limit(24),
          supabase.from('vault_items')
            .select(`${VAULT_ITEM_CARD_SELECT}, owner:profiles!vault_items_owner_id_fkey(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)`)
            .eq('owner_id', resolvedId).eq('is_public', true).neq('listing_type', 'Private')
            .order('created_at', { ascending: false }).limit(24),
          supabase.from('reviews')
            .select('*', { count: 'estimated' })
            .eq('recipient_id', resolvedId),
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
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [routeParam, navigate]);

  if (loading) return (
    <div className="max-w-[90rem] mx-auto px-4 py-12 space-y-8 animate-in fade-in duration-500">
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

  // SEO: absolute logo URL + Store / BreadcrumbList JSON-LD describing this
  // dealer's storefront so search engines can render it as a local business.
  const SITE = 'https://cardpop.com.au';
  const storeUrl = `${SITE}/dealer/${dealer.store_slug || dealer.id}`;
  const absLogo = logoUrl
    ? (logoUrl.startsWith('http') ? logoUrl : `${SITE}${logoUrl}`)
    : undefined;

  // Resolve a storage path / URL for a listing's primary image.
  const resolveListingImage = (item) => {
    const path = item._type === 'marketplace'
      ? (item.vault_item?.vault_images?.[0]?.storage_path || item.vault_item?.card_image)
      : (item.vault_images?.[0]?.storage_path || item.card_image);
    if (!path) return undefined;
    return publicImageUrl(path);
  };

  // Product + Offer JSON-LD for each item shown in the store.
  const productListLd = listings.map((item) => {
    const isMkt = item._type === 'marketplace';
    const name = (isMkt ? item.vault_item?.card_name : item.card_name) || 'Trading Card';
    const price = isMkt ? item.price_aud : item.estimated_value_aud;
    const condition = schemaItemCondition(isMkt ? item.vault_item?.condition : item.condition);
    const url = isMkt
      ? `${SITE}/marketplace/${item.id}/${item.slug || 'listing'}`
      : `${SITE}/product/vault/${item.id}`;
    const image = resolveListingImage(item);
    return {
      '@type': 'Product',
      name,
      url,
      ...(image ? { image } : {}),
      ...(price > 0
        ? { offers: {
            '@type': 'Offer',
            price: Number(price).toFixed(2),
            priceCurrency: 'AUD',
            availability: 'https://schema.org/InStock',
            ...(condition ? { itemCondition: condition } : {}),
            url,
            seller: { '@type': 'Store', name: displayName },
          } }
        : {}),
    };
  });

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: displayName,
      url: storeUrl,
      ...(dealer.business_tagline ? { description: dealer.business_tagline } : {}),
      ...(absLogo ? { image: absLogo, logo: absLogo } : {}),
      ...(dealer.location_state ? { address: { '@type': 'PostalAddress', addressRegion: dealer.location_state, addressLocality: dealer.location_suburb || undefined, addressCountry: 'AU' } } : {}),
      ...(stats.totalReviews > 0 && stats.averageRating > 0
        ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: stats.averageRating.toFixed(1), reviewCount: stats.totalReviews } }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Local Traders', item: `${SITE}/community/local-traders` },
        { '@type': 'ListItem', position: 3, name: displayName, item: storeUrl },
      ],
    },
    ...(productListLd.length > 0
      ? [{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${displayName} listings`,
          numberOfItems: productListLd.length,
          itemListElement: productListLd.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: p })),
        }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead
        title={`${displayName} | CardPop Dealer`}
        description={dealer.business_tagline || `${displayName} — trading card dealer on CardPop Australia.`}
        canonicalUrl={storeUrl}
        ogImage={absLogo}
        structuredData={structuredData}
      />

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="bg-[hsl(var(--profile-bg))] border-b border-[hsl(var(--section-divider))]">
        <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-16 pb-12">
          <BackButton fallback="/marketplace" className="mb-8" />
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">

            {/* Logo */}
            <div className="shrink-0 relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-muted border-4 border-card shadow-xl flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-bold text-muted-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {isDealer && (
                <div className="absolute -bottom-2 -right-2 text-white p-2 rounded-xl shadow-lg border-2 border-card" style={{ backgroundColor: `hsl(var(--verified-badge))` }} title="Verified Dealer">
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
                  <Link to={`/seller/${dealer.id}`}>
                    <ExternalLink className="w-4 h-4 mr-2" /> Full Profile
                  </Link>
                </Button>
                {(() => {
                  const socials = dealer.social_links || {};
                  const items = [];
                  if (socials.instagram) items.push({
                    key: 'instagram', label: 'Instagram', href: normalizeSocialUrl(socials.instagram), icon: 'instagram',
                    className: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white border-transparent hover:opacity-90',
                  });
                  if (socials.whatnot) items.push({
                    key: 'whatnot', label: 'Whatnot', href: normalizeSocialUrl(socials.whatnot), icon: 'whatnot',
                    className: 'bg-[#FFD800] text-black border-transparent hover:brightness-95',
                  });
                  // Any other configured platforms keep a neutral fallback.
                  Object.entries(socials)
                    .filter(([k, v]) => v && k !== 'instagram' && k !== 'whatnot')
                    .forEach(([k, v]) => items.push({
                      key: k, label: k.charAt(0).toUpperCase() + k.slice(1), href: normalizeSocialUrl(v), icon: 'link',
                      className: 'bg-muted/50 text-muted-foreground border-border hover:text-primary',
                    }));
                  return items.filter(i => i.href).map(i => (
                    <a key={i.key} href={i.href} target="_blank" rel="noopener noreferrer"
                      title={i.label}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${i.className}`}>
                      {i.icon === 'instagram' && <Instagram className="w-4 h-4" />}
                      {i.icon === 'whatnot' && <WhatnotIcon className="w-4 h-4" />}
                      {i.icon === 'link' && <ExternalLink className="w-4 h-4" />}
                      {i.label}
                    </a>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Trust badge strip */}
        {trustBadges.length > 0 && (
          <div className="border-t border-[hsl(var(--section-divider))]">
            <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-4">
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
      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-12 grid grid-cols-1 lg:grid-cols-4 gap-8">

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
              {listings.map((item, i) => (
                item._type === 'vault'
                  ? <VaultListingCard key={item.id} vaultItem={item} priority={i < 2} />
                  : <MarketplaceListingCard key={item.id} listing={item} priority={i < 2} />
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
