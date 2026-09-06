
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { canViewVaultProduct } from '@/utils/vaultSecurityUtils.js';
import { slugify } from '@/lib/slugify.js';
import { isVerified } from '@/utils/verification.js';
import { useCart } from '@/hooks/useCart.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ShoppingCart, PackageX, Store, ArrowLeft, ShieldCheck, User, Lock, ArrowRightLeft, HandCoins, Tag } from 'lucide-react';
import { getVaultListingBadge } from '@/utils/vaultListingBadge.js';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';
import EbayMarketSection from '@/components/EbayMarketSection.jsx';
import MarketPriceAnchor from '@/components/MarketPriceAnchor.jsx';
import ListingWatchers from '@/components/ListingWatchers.jsx';
import { addToRecentlyViewed } from '@/utils/recentlyViewed.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import CertificationVerificationSection from '@/components/CertificationVerificationSection.jsx';
import GradeBadge from '@/components/GradeBadge.jsx';
import BnplMessage from '@/components/BnplMessage.jsx';
import { ROOKIE_VARIANT } from '@/lib/cardVariants.js';
import { getAutographLabel, getRefractorLabel, getRefractorBadgeClass, genericVariantChips } from '@/lib/cardAttributeLabels.js';
import { sellerFromProfile, OFFICIAL_STORE_NAME } from '@/lib/sellerIdentity.js';
import CardPopLogo from '@/components/CardPopLogo.jsx';
import RookiePill from '@/components/RookiePill.jsx';
// Lazy: only needed once a buyer taps "Make an Offer".
const MakeOfferModal = lazy(() => import('@/components/MakeOfferModal.jsx'));
const ProposeTradeModal = lazy(() => import('@/components/ProposeTradeModal.jsx'));

// `source` can come from the route param (/product/:source/:id/:slug?) or be
// fixed by the mounting route (/marketplace/:id/:slug? passes source="marketplace").
const ProductDetailPage = ({ source: sourceProp }) => {
  const { source: sourceParam, id } = useParams();
  const source = sourceProp || sourceParam;
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCart();
  const { currentUser, isAdmin, loading: authLoading } = useAuth();
  const { settings } = usePlatformSettings();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seller, setSeller] = useState(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const fetchRef = useRef(null);

  // Auth only affects the private-vault authorization branch. Depending on the
  // `currentUser` object itself refetched every product 2-3 times during auth
  // boot (session resolve, then profile merge, each swap the object identity),
  // so the effect keys on projections that stay constant for marketplace/shop
  // views and only change for vault views when the answer could change.
  const vaultAuthPending = source === 'vault' && authLoading;

  // Record the view for the "Recently viewed" strips (localStorage only).
  useEffect(() => {
    if (!product?.id) return;
    addToRecentlyViewed({
      id: product.id,
      title: product.name,
      image: publicImageUrl(product.images?.[0]),
      price: product.price,
      type: source,
      url: window.location.pathname,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per loaded product
  }, [product?.id]);
  const vaultViewerId = source === 'vault' ? currentUser?.id ?? null : null;
  const vaultIsAdmin = source === 'vault' ? isAdmin : false;

  useEffect(() => {
    let isMounted = true;
    const fetchProduct = async () => {
      if (!id || !source) {
        if (isMounted) setError('Invalid product link.');
        setLoading(false);
        return;
      }
      if (isMounted) setError(null);
      // Set when the fetch bails out to wait for auth — the skeleton must
      // stay up (loading stays true) until the re-run decides the outcome.
      let stillResolving = false;
      try {
        setLoading(true);

        if (source === 'marketplace') {
          const { data: listing, error: fetchError } = await supabase
            .from('listings')
            .select('*, vault_item:vault_items!inner(*, vault_images(*)), seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, is_admin, is_sole_trader, business_name, business_logo_url, store_slug)')
            .eq('id', id)
            // Sold listings still render (marked "Sold" + buy disabled); only
            // archived listings are treated as gone.
            .in('status', ['active', 'sold'])
            .single();

          if (fetchError) throw fetchError;
          if (!isMounted) return;

          const vi = listing.vault_item;
          const images = [];
          if (vi?.card_image) images.push(vi.card_image);
          if (vi?.card_images?.length) {
            vi.card_images.forEach(p => { if (p) images.push(p); });
          }
          if (vi?.vault_images?.length) {
            vi.vault_images.forEach(img => { if (img.storage_path && !images.includes(img.storage_path)) images.push(img.storage_path); });
          }

          const listingTypeMap = { fixed: 'For Sale', auction: 'For Sale', trade: 'For Trade', vault: 'Private', expression_of_interest: 'Expression of Interest' };
          // A fixed-price listing that also accepts trades gets the combined
          // label — the action area keys the Buy and Trade buttons off it.
          const displayListingType = listing.accepts_trade && listing.listing_type === 'fixed'
            ? 'For Sale & Trade'
            : (listingTypeMap[listing.listing_type] || 'For Sale');

          setProduct({
            ...listing,
            vault_item: vi,
            name: vi?.card_name || listing.title || 'Untitled',
            price: listing.price_aud || 0,
            description: listing.description || vi?.notes || '',
            images,
            condition: vi?.condition,
            grade: vi?.grade,
            grading_company: vi?.grading_company,
            year: vi?.card_year || vi?.year || null,
            set: vi?.set_name || vi?.card_set || vi?.era || vi?.collection || null,
            category: listing.category,
            listing_type: displayListingType,
            owner_id: listing.seller_id,
          });

          if (listing.seller) {
            setSeller(sellerFromProfile(listing.seller, listing.seller_id));
          }
          return;
        }

        if (source === 'shop') {
          const { data, error: fetchError } = await supabase
            .from('shop_products')
            .select('*')
            .eq('id', id)
            .eq('status', 'active')
            .maybeSingle();

          if (fetchError) throw fetchError;
          if (!isMounted) return;
          if (!data) {
            setError('Product not found or unavailable.');
            setLoading(false);
            return;
          }

          const images = Array.isArray(data.images) && data.images.length
            ? data.images
            : (data.image_url ? [data.image_url] : []);

          setProduct({
            ...data,
            name: data.title,
            price: data.price_aud ?? 0,
            images,
            stockQuantity: data.stock_quantity,
            listing_type: 'For Sale',
          });
          setSeller({ business_name: OFFICIAL_STORE_NAME, is_verified: true, type: 'official', storePath: '/shop' });
          return;
        }

        // Only the 'vault' source reaches here.
        const { data, error: fetchError } = await supabase
          .from('vault_items')
          .select(`*, vault_images(*), owner:profiles!vault_items_owner_id_fkey(${PUBLIC_PROFILE_COLUMNS})`)
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!isMounted) return;

        if (source === 'vault') {
          // Always prefer the marketplace listing if one exists — it has price + buy action
          const { data: activeListing } = await supabase
            .from('listings')
            .select('id')
            .eq('vault_item_id', id)
            .eq('status', 'active')
            .maybeSingle();

          if (isMounted && activeListing) {
            navigate(`/marketplace/${activeListing.id}`, { replace: true });
            return;
          }

          // No active listing — if the item's latest listing sold, send the
          // viewer to that listing page instead: it renders the Sold state.
          // A sale only flips listings.status (the webhook never touches
          // vault_items), so falling through here used to show the stale
          // 'For Sale' vault view with a Buy Now button on a card that had
          // already sold.
          const { data: soldListing } = await supabase
            .from('listings')
            .select('id')
            .eq('vault_item_id', id)
            .eq('status', 'sold')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (isMounted && soldListing) {
            navigate(`/marketplace/${soldListing.id}`, { replace: true });
            return;
          }

          // Don't decide ownership until auth has resolved — otherwise an owner
          // can be shown a false 403 while currentUser is momentarily null.
          // The effect re-runs (vaultAuthPending dep) once auth settles. Keep
          // the skeleton up meanwhile: letting `finally` clear `loading` here
          // flashed the "Not Found" card at the owner until auth landed.
          if (authLoading) {
            stillResolving = true;
            return;
          }

          const userRole = isAdmin ? 'admin' : 'user';
          const isAuthorized = canViewVaultProduct(currentUser?.id, data.owner_id, data.is_public, userRole);
          if (!isAuthorized) {
            if (isMounted) {
              setError('403 Forbidden: You do not have permission to view this private vault item.');
              setLoading(false);
            }
            return;
          }
        }

        // The marketplace branch above shapes its row into the { images, price }
        // contract the page renders from; the vault fall-through used to hand
        // the raw vault row straight to setProduct, so a public vault card
        // rendered "No images available" over $0.00 while holding both a photo
        // and an estimated value. Shape it the same way.
        const vaultImages = [];
        if (data.card_image) vaultImages.push(data.card_image);
        if (Array.isArray(data.card_images)) {
          data.card_images.forEach(pth => { if (pth && !vaultImages.includes(pth)) vaultImages.push(pth); });
        }
        if (Array.isArray(data.vault_images)) {
          data.vault_images.forEach(img => {
            if (img?.storage_path && !vaultImages.includes(img.storage_path)) vaultImages.push(img.storage_path);
          });
        }

        setProduct({
          ...data,
          name: data.card_name || data.name || 'Untitled',
          images: vaultImages,
          price: Number(data.estimated_value_aud) || 0,
        });

        if (source === 'vault' && data.owner) {
          setSeller(sellerFromProfile(data.owner, data.owner_id));
        } else if (data.owner_id) {
          try {
            const { data: user } = await supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('id', data.owner_id).single();
            if (isMounted) setSeller(sellerFromProfile(user, data.owner_id));
          } catch (e) {
            if (isMounted) setSeller(sellerFromProfile(null, data.owner_id));
          }
        }
      } catch (err) {
        if (isMounted) setError('Product not found or unavailable.');
      } finally {
        if (isMounted && !stillResolving) setLoading(false);
      }
    };

    fetchRef.current = fetchProduct;
    fetchProduct();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentUser/isAdmin/authLoading are tracked via their vault-scoped projections above
  }, [id, source, vaultAuthPending, vaultViewerId, vaultIsAdmin, navigate]);

  useEffect(() => {
    // For a marketplace listing, `id` is the listings.id — the vault_item's
    // own id (needed to filter that table) is only known once the listing
    // fetch above resolves. Don't listen to vault_items at all until then:
    // the initial fetch is already in flight during that window, and an
    // unfiltered listener would make every open product page refetch on
    // every vault_items UPDATE anywhere on the site. This effect re-runs
    // (vault_item.id dep) and subscribes filtered once the product loads.
    const vaultItemId = product?.vault_item?.id;
    let channel = supabase.channel(`product-detail-${id}`);
    if (vaultItemId) {
      channel = channel.on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vault_items', filter: `id=eq.${vaultItemId}` },
        () => { if (source === 'marketplace' && fetchRef.current) fetchRef.current(); }
      );
    }
    channel = channel
      // A sale (webhook) or admin action flips listings.status without touching
      // vault_items — listen here so an open page updates to "Sold" live.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings', filter: `id=eq.${id}` },
        () => { if (source === 'marketplace' && fetchRef.current) fetchRef.current(); }
      )
      // `id` is shop_products.id directly for a shop-sourced product.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_products', filter: `id=eq.${id}` },
        () => { if (source === 'shop' && fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, source, product?.vault_item?.id]);

  const handleAddToCart = () => {
    if (!product) return;
    if (source !== 'shop' && product.status === 'sold') {
      toast.error('This item has already sold.');
      return;
    }
    const priceInCents = Math.round((product.price || 0) * 100);
    const cartProduct = {
      id: product.id,
      source,
      // Server-side checkout discriminator: shop products vs marketplace listings.
      type: source === 'shop' ? 'shop' : 'listing',
      title: product.name,
      price: priceInCents / 100,
      image: product.images?.[0] || null,
      year: product.year || product.card_year || null,
      set: product.set || product.set_name || product.card_set || product.era || product.collection || null,
      grading_company: product.grading_company || product.gradingCompany || null,
      grade: product.grade || null,
    };
    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      manage_inventory: product.stockQuantity !== null,
      inventory_quantity: product.stockQuantity
    };
    addToCart(cartProduct, cartVariant, 1, product.stockQuantity ?? 999)
      .then(() => {
        toast.success('Added to cart', {
          action: {
            label: 'View Cart',
            onClick: () => setIsCartOpen(true)
          }
        });
      })
      .catch(e => toast.error(e.message));
  };

  // Opens the propose-trade modal: pick one of your own listings to offer,
  // with the value difference settled as a cash top-up. Only rendered when the
  // enable_trading platform flag is on.
  const handleRequestTrade = () => {
    if (!seller?.id) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }
    setTradeOpen(true);
  };

  if (loading) {
    return (
      <div className="max-w-[90rem] mx-auto px-4 py-12">
        <Skeleton className="h-6 w-32 mb-8 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-7">
            <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
          </div>
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <Skeleton className="h-8 w-1/3 rounded-md" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 bg-background">
        <div className="text-center bg-card p-10 rounded-[2rem] border border-border shadow-md max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            {error?.includes('403') ? <Lock className="w-8 h-8 text-muted-foreground" /> : <PackageX className="w-8 h-8 text-muted-foreground" />}
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">{error?.includes('403') ? 'Access Restricted' : 'Not Found'}</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed text-balance">
            {error || "This item could not be found or has been removed."}
          </p>
          <Button onClick={() => navigate('/marketplace')} className="w-full rounded-xl h-12 font-bold">
            Return to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const isShop = source === 'shop';
  const isSold = !isShop && product.status === 'sold';
  const outOfStock = isShop && product.stockQuantity !== null && product.stockQuantity <= 0;
  // Expression of Interest: no fixed price — the seller published a target
  // range and buyers negotiate through offers.
  const isEOI = !isShop && product.listing_type === 'Expression of Interest';
  const canOffer = !isShop && !isSold && source === 'marketplace' && (isEOI || product.accepts_offers);
  
  const statusBadge = isShop 
    ? { label: product.visibility === 'public' ? 'Shop + Marketplace' : 'Shop Only', config: { className: 'bg-primary text-primary-foreground', icon: Store } }
    : (() => {
        const config = getVaultListingBadge(product.listing_type);
        return { label: config.label, config };
      })();
    
  const StatusIcon = statusBadge.config.icon;

  // Card attribute source: marketplace listings carry it under vault_item,
  // a direct vault item is the product itself. Shop products have none.
  const vi = isShop ? null : (product.vault_item || product);
  const variantChips = vi?.variant
    ? vi.variant.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const autoLabel = getAutographLabel(vi);
  const refractorLabel = getRefractorLabel(vi);
  const hasCardDetails = !!vi && (
    variantChips.length > 0 || vi.is_foil || vi.is_refractor || vi.is_auto ||
    vi.is_rookie || vi.is_sealed || vi.serial_number || vi.parallel?.name ||
    vi.subset?.name || vi.card_number || vi.condition || vi.grade
  );

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-8 md:py-12">
        <SEOHead
          title={`${product.name} | CardPop`}
          description={product.description || `${product.name} — available on CardPop Australia's trading card marketplace.`}
          ogImage={product.images?.[0] || undefined}
          canonicalUrl={source === 'marketplace'
            // Marketplace listings canonicalise to /marketplace/:id/:slug — the
            // URL form the sitemap and bot prerenderer advertise.
            ? `/marketplace/${id}/${product.slug || slugify(product.name || 'listing')}`
            : `/product/${source}/${id}/${slugify(product.name || 'product')}`}
        />

        {/* Breadcrumb gives a reliable upward path for visitors who land here
            directly from search/social (where navigate(-1) would leave the site
            or do nothing). The Back button stays for in-app grid → detail nav. */}
        <Breadcrumb
          items={[
            { label: 'Home', path: '/' },
            isShop
              ? { label: 'Shop', path: '/shop' }
              : source === 'vault'
                ? { label: 'My Vault', path: '/vault' }
                : { label: 'Marketplace', path: '/marketplace' },
            { label: product.name },
          ]}
        />

        <Button variant="link" className="px-0 mb-8 text-muted-foreground hover:text-primary font-medium" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>

        {/* Desktop: the right column spans two rows, so the cert section (last
            grid item) lands directly under the image carousel. Mobile: DOM
            order applies — image, then price/Buy Now/description/eBay, then
            cert — keeping the buy button above the fold. Row gap is disabled
            at lg because the cert section brings its own mt-8. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-x-16 lg:gap-y-0">
          <div className="lg:col-span-6 xl:col-span-7">
            {/* display_style is a vault-only field: on marketplace listings it
                rides on the embedded vault_item, on vault records it's on the
                record itself. Shop products have none and stay Classic. */}
            <ProductImageCarousel
              images={product.images}
              record={product}
              displayStyle={product.vault_item?.display_style || product.display_style}
            />
          </div>

          <div className="lg:col-span-6 xl:col-span-5 lg:row-span-2 flex flex-col">
            <div className="flex flex-wrap gap-2 mb-4">
              {isShop || seller?.type === 'official' ? (
                // The platform's own listings are official stock, wherever
                // they're sold from — never badged as a community vault item.
                <Badge className="bg-primary text-primary-foreground border-none font-bold shadow-sm px-2.5 py-1">
                  <Store className="w-3 h-3 mr-1.5 inline-block" />
                  {OFFICIAL_STORE_NAME}
                </Badge>
              ) : (
                <Badge className="bg-accent text-accent-foreground border-none font-bold shadow-sm px-2.5 py-1">
                  Community Vault
                </Badge>
              )}

              <Badge className={`font-bold border-none shadow-sm px-2.5 py-1 ${statusBadge.config.className}`}>
                <StatusIcon className="w-3 h-3 mr-1.5 inline-block" />
                {statusBadge.label}
              </Badge>

              {isSold && (
                <Badge className="font-bold border-none shadow-sm px-2.5 py-1 bg-brand-red text-white uppercase tracking-wider">
                  Sold
                </Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3 leading-tight text-balance">
              {product.name}
            </h1>
            
            <p className="text-muted-foreground font-medium text-sm mb-2">
              {product.category || product.collectionType}
            </p>
            {(product.year || product.set) && (
              <p className="text-muted-foreground text-sm mb-6">
                {[product.year, product.set].filter(Boolean).join(' · ')}
              </p>
            )}

            {hasCardDetails && (
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Card Details</p>
                <div className="flex flex-wrap gap-1.5">
                  {vi.condition && (
                    <Badge variant="outline" className="text-[11px] font-bold border-emerald-400/50 text-emerald-700 bg-emerald-400/10 dark:text-emerald-300">
                      {vi.condition.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Badge>
                  )}
                  {vi.grade && (
                    <GradeBadge grade={vi.grade} gradingCompany={vi.grading_company} isPositioned={false} className="text-[11px]" />
                  )}
                  {vi.parallel?.name && (
                    <Badge variant="outline" className="text-[11px] font-bold border-amber-400/50 text-amber-800 bg-amber-400/10 dark:text-amber-300">{vi.parallel.name}</Badge>
                  )}
                  {vi.subset?.name && (
                    <Badge variant="outline" className="text-[11px] font-bold border-sky-400/50 text-sky-700 bg-sky-400/10 dark:text-sky-300">{vi.subset.name}</Badge>
                  )}
                  {vi.card_number && <Badge variant="secondary" className="text-[11px] font-medium">#{vi.card_number}</Badge>}
                  {vi.serial_number && <Badge variant="secondary" className="text-[11px] font-bold">#{vi.serial_number}</Badge>}
                  {vi.is_foil && <Badge variant="outline" className="text-[11px] font-bold border-yellow-400/50 text-yellow-800 bg-yellow-400/10 dark:text-yellow-300">Foil</Badge>}
                  {refractorLabel && <Badge variant="outline" className={`text-[11px] font-bold ${getRefractorBadgeClass(vi)}`}>{refractorLabel}</Badge>}
                  {autoLabel && <Badge variant="outline" className="text-[11px] font-bold border-blue-400/50 text-blue-700 bg-blue-400/10 dark:text-blue-300">{autoLabel}</Badge>}
                  {(vi.is_rookie || variantChips.includes(ROOKIE_VARIANT)) && <RookiePill className="text-[11px]" />}
                  {vi.is_sealed && <Badge variant="outline" className="text-[11px] font-bold border-green-400/50 text-green-800 bg-green-400/10 dark:text-green-300">Sealed</Badge>}
                  {genericVariantChips(variantChips).map(v => (
                    <Badge key={v} variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5">{v}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              {isEOI ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Seller Is Looking For</p>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
                      {product.price_min_aud != null && product.price_max_aud != null
                        ? `$${Number(product.price_min_aud).toFixed(2)} – $${Number(product.price_max_aud).toFixed(2)}`
                        : 'Open to offers'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    This card is listed as an expression of interest — make an offer in (or near) this range.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Estimated Value / Price</p>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
                      ${(product.price || 0).toFixed(2)}
                    </span>
                    {product.retail_price_aud && Number(product.price || 0) < Number(product.retail_price_aud) && (
                      <span className="text-lg text-muted-foreground line-through pb-1">
                        ${Number(product.retail_price_aud).toFixed(2)}
                      </span>
                    )}
                    {isShop && <span className="text-sm font-medium text-muted-foreground pb-1">+ Shipping</span>}
                    {/* Seller-set postage on marketplace listings — surfaced next
                        to the price so the checkout shipping line is never a
                        surprise. 0 (or a pre-migration row) reads as free. */}
                    {!isShop && (
                      <span className="text-sm font-medium text-muted-foreground pb-1">
                        {Number(product.shipping_cost_aud) > 0
                          ? `+ $${Number(product.shipping_cost_aud).toFixed(2)} shipping`
                          : 'Free shipping'}
                      </span>
                    )}
                  </div>
                  <BnplMessage amount={product.price} className="mt-2" />
                  {/* Market context beside the price — the number buyers actually
                      decide on. Links down to the full eBay market section. */}
                  {!isShop && (
                    <div>
                      <MarketPriceAnchor
                        cardName={product.name}
                        cardSet={vi?.set_name || product.set}
                        gradingService={vi?.grading_company}
                        gradeScore={vi?.grade}
                        listingPrice={product.price}
                      />
                      {source === 'marketplace' && <ListingWatchers listingId={product.id} className="mt-2" />}
                    </div>
                  )}
                </>
              )}
            </div>

            {seller && (
              <div className="flex items-center justify-between gap-4 mb-8 p-5 bg-card border border-border rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                    {seller.type === 'official' ? (
                      <CardPopLogo variant="icon" iconClassName="w-6 h-[30px]" />
                    ) : seller.logoUrl ? (
                      <img src={publicImageUrl(seller.logoUrl)} alt={`${seller.business_name} logo`} className="w-full h-full object-cover" />
                    ) : seller.isDealer ? (
                      <Store className="w-6 h-6" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Owner / Seller</p>
                    <p className="font-bold text-base text-foreground flex items-center gap-1.5">
                      {seller.business_name}
                      {isVerified(seller.is_verified) && <ShieldCheck className="w-4 h-4" style={{ color: `hsl(var(--verified-badge))` }} />}
                    </p>
                  </div>
                </div>
                {/* A seller with a storefront links to the full store (which
                    lists this card among the rest of their stock); everyone
                    else links to their public profile. */}
                {seller.storePath ? (
                  <Button asChild variant="outline" size="sm" className="rounded-full hidden sm:flex">
                    <Link to={seller.storePath}>View Store</Link>
                  </Button>
                ) : !isShop && seller.id ? (
                  <Button asChild variant="outline" size="sm" className="rounded-full hidden sm:flex">
                    <Link to={`/seller/${seller.id}`}>View Profile</Link>
                  </Button>
                ) : null}
              </div>
            )}

            {isShop ? (
              <div className="flex flex-col gap-3 mb-8">
                <Button 
                  size="lg" 
                  className="w-full h-14 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all"
                  onClick={handleAddToCart}
                  disabled={outOfStock}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </Button>
                {product.stockQuantity !== null && (
                  <p className="text-sm text-center font-medium text-muted-foreground">
                    {product.stockQuantity} available in stock
                  </p>
                )}
              </div>
            ) : isSold ? (
              <div className="flex flex-col gap-3 mb-8">
                <Button size="lg" variant="secondary" className="w-full h-14 rounded-xl font-bold text-lg" disabled>
                  <PackageX className="w-5 h-5 mr-2" /> Sold
                </Button>
                <p className="text-sm text-center font-medium text-muted-foreground">
                  This item has already sold and is no longer available for purchase.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mb-8">
                {product.listing_type === 'For Sale' || product.listing_type === 'For Sale & Trade' ? (
                  // A vault item is only purchasable through its marketplace
                  // listing (checkout prices from the listings row). Reaching
                  // the vault view means no active listing exists — its listing
                  // sold, expired or was archived — so a Buy Now here could
                  // only ever fail at checkout.
                  source === 'vault' ? (
                    <Button size="lg" variant="secondary" className="w-full h-14 rounded-xl font-bold text-lg" disabled>
                      <PackageX className="w-5 h-5 mr-2" /> Not currently available
                    </Button>
                  ) : (
                    <Button size="lg" className="w-full h-14 rounded-xl font-bold text-lg shadow-md" onClick={handleAddToCart}>
                      Buy Now
                    </Button>
                  )
                ) : null}

                {canOffer && (
                  <Button
                    size="lg"
                    variant={isEOI ? 'default' : 'outline'}
                    className="w-full h-14 rounded-xl font-bold text-lg shadow-md"
                    onClick={() => setOfferOpen(true)}
                  >
                    {isEOI ? <HandCoins className="w-5 h-5 mr-2" /> : <Tag className="w-5 h-5 mr-2" />}
                    Make an Offer
                  </Button>
                )}

                {settings.enable_trading !== false &&
                 (product.listing_type === 'For Trade' || product.listing_type === 'For Sale & Trade') &&
                 seller?.id && seller.id !== currentUser?.id ? (
                  <Button size="lg" variant={product.listing_type === 'For Sale & Trade' ? 'outline' : 'default'} className="w-full h-14 rounded-xl font-bold text-lg" onClick={handleRequestTrade}>
                    <ArrowRightLeft className="w-5 h-5 mr-2" /> Propose Trade
                  </Button>
                ) : null}

                {/* Trade-only listing while trading is switched off: without
                    this the action area would be empty. */}
                {settings.enable_trading === false && product.listing_type === 'For Trade' && !canOffer && (
                  <div className="text-center p-4 rounded-xl bg-muted/50 border border-border">
                    <p className="text-sm font-medium text-muted-foreground">
                      This card is listed for trade. Trading is not available yet — check back soon.
                    </p>
                  </div>
                )}

                {product.listing_type === 'Private' && (
                  <Button size="lg" variant="secondary" className="w-full h-14 rounded-xl font-bold text-lg" disabled>
                    <Lock className="w-5 h-5 mr-2" /> Private Item
                  </Button>
                )}
              </div>
            )}

            {offerOpen && (
              <Suspense fallback={null}>
                <MakeOfferModal isOpen={offerOpen} onClose={() => setOfferOpen(false)} listing={product} />
              </Suspense>
            )}

            {tradeOpen && (
              <Suspense fallback={null}>
                <ProposeTradeModal
                  listing={{
                    id: product.id,
                    sellerId: product.seller_id || product.owner_id,
                    name: product.name,
                    value: Number(product.vault_item?.trade_value_aud ?? product.price ?? product.vault_item?.estimated_value_aud ?? 0),
                  }}
                  onClose={() => setTradeOpen(false)}
                  onSuccess={() => navigate('/trades')}
                />
              </Suspense>
            )}

            <div className="space-y-4 pt-6 border-t border-border">
              <h3 className="font-bold text-lg text-foreground">Description</h3>
              {product.description ? (
                <div className="prose prose-sm dark:prose-invert text-muted-foreground leading-relaxed max-w-none">
                  {product.description}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">No detailed description provided.</p>
              )}
            </div>

            {!isShop && (
              <EbayMarketSection
                cardName={product.name}
                cardSet={vi?.set_name || product.set}
                gradingService={vi?.grading_company}
                gradeScore={vi?.grade}
              />
            )}
          </div>

          {/* -mt-8 cancels the section's built-in top margin on mobile (the
              grid gap already separates it); at lg the row gap is 0 so the
              built-in margin is restored to space it under the carousel. */}
          {!isShop && (vi?.cert_number || vi?.certification_number) && (
            <div className="-mt-8 lg:mt-0 lg:col-span-6 xl:col-span-7 lg:col-start-1">
              <CertificationVerificationSection
                certNumber={vi?.cert_number || vi?.certification_number}
                gradingCompany={vi?.grading_company || 'psa'}
                grade={vi?.grade}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
