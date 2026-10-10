import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronDown, ChevronRight, ArrowRight, ShoppingBag, Store,
  SlidersHorizontal, RefreshCw, AlertCircle,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient.js';
import ProductGrid from '@/components/ProductGrid.jsx';
import { resolveShopCollection } from '@/data/shopCollectionConfigs.js';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';
import { cardThumbUrl } from '@/utils/imageUrl.js';
import { SHOP_CARD_COLUMNS } from '@/utils/shopColumns.js';
import { isSoldOut, isComingSoon, isPreorder, PUBLIC_SHOP_STATUSES, preorderCartFields, hasUnlimitedStock } from '@/utils/shopStock.js';
import { useCart } from '@/hooks/useCart.jsx';
import { useShopFacets } from '@/hooks/useShopFacets.js';
import { DEFAULT_FACET_KEYS, filterFacetRows, sortFacetRows, fetchShopProductsByIds } from '@/utils/shopFacets.js';
import ShopFilterPanel from '@/components/shop/ShopFilterPanel.jsx';
import { shopProductPath } from '@/utils/shopProductUrl.js';
import { toast } from 'sonner';
import NotFoundPage from '@/pages/NotFoundPage.jsx';

// ─── Hero floating icon animation (matches CollectionPage) ───────────────────
const floatVariants = {
  animate: {
    y: [0, -12, 0],
    rotate: [-1, 1, -1],
    transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Skeleton card for the horizontal scroll sections ────────────────────────
const CardSkeleton = () => (
  <div className="flex-shrink-0 w-48 rounded-2xl overflow-hidden border border-border bg-card">
    <Skeleton className="aspect-[4/5] w-full" />
    <div className="p-3 space-y-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  </div>
);

// ─── Compact product card for the horizontal "New Arrivals" strip ────────────
const MiniProductCard = ({ product, accentHex }) => {
  const imgPath = product.images?.[0] || product.image_url || product.card_image || null;
  // Strip tile: the `.opt.thumb.webp` companion where the photo has one.
  const imgSrc = cardThumbUrl(imgPath);
  const price = Number(product.price_aud ?? product.price ?? 0);
  const title = product.title || 'Product';
  const detailPath = shopProductPath(product);
  const comingSoon = isComingSoon(product);
  const soldOut = !comingSoon && isSoldOut(product);
  const preorder = !comingSoon && !soldOut && isPreorder(product);

  return (
    <Link
      to={detailPath}
      className="group flex-shrink-0 w-44 sm:w-48 flex flex-col rounded-2xl overflow-hidden border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative aspect-[4/5] bg-muted/30 overflow-hidden">
        {comingSoon && (
          <span className="absolute top-2 right-2 z-10 rounded-md bg-brand-charcoal px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
            Coming soon
          </span>
        )}
        {preorder && (
          <span className="absolute top-2 right-2 z-10 rounded-md border border-brand-red bg-brand-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-red shadow-md">
            Pre-order
          </span>
        )}
        {soldOut && (
          <span className="absolute top-2 right-2 z-10 rounded-md bg-brand-red px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
            Sold out
          </span>
        )}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className={`w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500 ${soldOut ? 'grayscale opacity-70' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <ShoppingBag className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground line-clamp-1">
          {product.category || '—'}
        </p>
        <p className="text-sm font-bold leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {title}
        </p>
        <p className="text-base font-extrabold tabular-nums mt-auto" style={{ color: accentHex }}>
          ${price.toFixed(2)}
        </p>
      </div>
    </Link>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  SHOP COLLECTION PAGE  (/shop/:groupSlug)
//  Mirrors the marketplace CollectionPage layout, but for shop supplies.
// ═══════════════════════════════════════════════════════════════════════════
const ShopCollectionPage = () => {
  const { groupSlug } = useParams();
  const browseGridRef = useRef(null);
  const { addToCart } = useCart();

  // The static config, with its leaf items swapped for the admin-edited list
  // (custom categories added, removed ones dropped — utils/shopCategories.js).
  const { groups } = useShopCategoryGroups();
  const baseConfig = resolveShopCollection(groupSlug);
  const config = useMemo(() => {
    if (!baseConfig) return null;
    const items = groups.find((g) => g.slug === baseConfig.slug)?.items;
    return items ? { ...baseConfig, items } : baseConfig;
  }, [baseConfig, groups]);

  // ─── State ─────────────────────────────────────────────────────────────
  const [activeSub, setActiveSub] = useState(null);       // pill filter (item name)
  const [newArrivals, setNewArrivals] = useState([]);
  const [newArrivalsLoading, setNewArrivalsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  // Whether the last page came back full — the trap-proof "is there more?" signal.
  // totalProducts is an estimate (count: 'estimated') and can't gate Load More
  // without leaving a stuck button (over-estimate) or hiding rows (under-estimate).
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState('newest');
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const PER_PAGE = 16;

  // Scroll to top when the group changes (before paint).
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [groupSlug]);

  // Reset derived state when the group changes.
  const prevSlugRef = useRef(groupSlug);
  useEffect(() => {
    if (prevSlugRef.current !== groupSlug) {
      prevSlugRef.current = groupSlug;
      setActiveSub(null);
      setNewArrivals([]);
      setNewArrivalsLoading(true);
      setProducts([]);
      setProductsLoading(true);
      setProductsError(null);
      setPage(1);
      setTotalProducts(0);
      setSort('newest');
      setSeoExpanded(false);
      setFiltersOpen(false);
    }
  }, [groupSlug]);

  // A Supabase `.or()` clause matching shop_products.category against every leaf
  // category name in the group (plus the group label), so the grid pulls the
  // whole group. Item names have no commas, so they're safe inside `.or()`.
  const buildGroupOr = useCallback(() => {
    if (!config) return '';
    const names = [config.label, ...config.items.map((i) => i.name)];
    return names.map((n) => `category.ilike.%${n}%`).join(',');
  }, [config]);

  // ─── New Arrivals (newest in the group) ─────────────────────────────────
  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    setNewArrivalsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('shop_products')
          .select(SHOP_CARD_COLUMNS)
          .in('status', PUBLIC_SHOP_STATUSES)
          .or(buildGroupOr())
          .order('created_at', { ascending: false })
          .limit(10);
        if (cancelled) return;
        if (error) throw error;
        setNewArrivals((data || []).map((p) => ({ ...p, source: 'shop', type: 'shop' })));
      } catch {
        if (!cancelled) setNewArrivals([]);
      } finally {
        if (!cancelled) setNewArrivalsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [config, buildGroupOr]);

  // ─── Filter chips (colour, price, availability, brand…) ────────────────
  // Scoped like the grid: the selected pill's category, else the whole group.
  // Type (product line) only once a pill narrows to one category — across a
  // whole group it would just list every product.
  const facets = useShopFacets({
    keys: activeSub ? DEFAULT_FACET_KEYS : DEFAULT_FACET_KEYS.filter((k) => k !== 'type'),
    scope: (q) => (activeSub ? q.ilike('category', `%${activeSub}%`) : q.or(buildGroupOr())),
    scopeKey: `${groupSlug}|${activeSub || ''}`,
    enabled: Boolean(config),
  });
  const selectionKey = JSON.stringify(facets.selection);
  const filtering = facets.activeCount > 0;
  // Only a filtered grid reads the facet rows — don't refetch the unfiltered
  // grid just because they finished loading.
  const filterRows = filtering ? facets.rows : null;

  // ─── Main browse grid (paginated, sortable, pill-filtered) ──────────────
  const fetchIdRef = useRef(0);
  const fetchProducts = useCallback(async (nextPage = 1) => {
    if (!config) return;
    const fetchId = ++fetchIdRef.current;
    const isCurrent = () => fetchIdRef.current === fetchId;
    setProductsLoading(true);
    setProductsError(null);

    const from = (nextPage - 1) * PER_PAGE;
    try {
      // Filtered: the facet rows hold the whole scope, so filter + sort them
      // here and fetch full rows for just this page.
      if (filterRows) {
        const matched = sortFacetRows(filterFacetRows(filterRows, JSON.parse(selectionKey)), sort);
        const pageRows = await fetchShopProductsByIds(supabase, matched.slice(from, from + PER_PAGE).map((r) => r.id));
        if (!isCurrent()) return;
        const mapped = pageRows.map((p) => ({ ...p, source: 'shop', type: 'shop' }));
        setProducts(nextPage === 1 ? mapped : (prev) => [...prev, ...mapped]);
        setTotalProducts(matched.length);
        setHasMore(matched.length > from + PER_PAGE);
        setPage(nextPage);
        return;
      }

      let q = supabase
        .from('shop_products')
        .select(SHOP_CARD_COLUMNS, { count: 'estimated' })
        .in('status', PUBLIC_SHOP_STATUSES);

      // A selected pill narrows to one leaf category; otherwise match the group.
      if (activeSub) q = q.ilike('category', `%${activeSub}%`);
      else q = q.or(buildGroupOr());

      if (sort === 'price_asc') q = q.order('price_aud', { ascending: true });
      else if (sort === 'price_desc') q = q.order('price_aud', { ascending: false });
      else if (sort === 'oldest') q = q.order('created_at', { ascending: true });
      else q = q.order('created_at', { ascending: false });

      q = q.range(from, from + PER_PAGE - 1);

      const { data, error, count } = await q;
      if (!isCurrent()) return;
      if (error) throw error;

      const mapped = (data || []).map((p) => ({ ...p, source: 'shop', type: 'shop' }));
      setProducts(nextPage === 1 ? mapped : (prev) => [...prev, ...mapped]);
      setTotalProducts(count || 0);
      setHasMore(mapped.length === PER_PAGE);
      setPage(nextPage);
    } catch {
      if (isCurrent()) setProductsError('Failed to load products. Please try again.');
    } finally {
      if (isCurrent()) setProductsLoading(false);
    }
  }, [config, activeSub, sort, buildGroupOr, filterRows, selectionKey]);

  useEffect(() => {
    // Hold while a filter in the URL can't be resolved yet (no unfiltered flash).
    if (config && !facets.waiting) fetchProducts(1);
  }, [fetchProducts, config, facets.waiting]);

  const handleSubClick = (name) => {
    const next = name === activeSub ? null : name;
    setActiveSub(next);
    if (next) {
      setTimeout(() => browseGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleAddToCart = (product) => {
    const priceInCents = Math.round((Number(product.price_aud) || 0) * 100);
    const cartProduct = {
      id: product.id,
      source: 'shop',
      type: 'shop',
      title: product.title,
      price: priceInCents / 100,
      image: product.images?.[0] || product.image_url || product.card_image || null,
      ...preorderCartFields(product),
    };
    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      // Pre-orders are unlimited, so the cart doesn't cap them by stock.
      manage_inventory: !hasUnlimitedStock(product) && product.stock_quantity != null,
      inventory_quantity: product.stock_quantity,
    };
    addToCart(cartProduct, cartVariant, 1, product.stock_quantity ?? 999)
      .then(() => toast.success(`${product.title || 'Item'} added to cart`))
      .catch((e) => toast.error(e.message));
  };

  // Unknown group slug → render the 404 in place (keeps the requested URL).
  if (!config) return <NotFoundPage />;

  const {
    Icon, name, label, tagline, heroGradient, heroTextDark, accentHex,
    seoTitle, seoDescription, seoIntro, items,
  } = config;

  const textColor = heroTextDark ? 'text-gray-900' : 'text-white';
  const textMuted = heroTextDark ? 'text-gray-700' : 'text-white/80';
  const canonical = typeof window !== 'undefined'
    ? `https://cardpop.com.au/shop/${config.slug}`
    : '';

  return (
    <>
      <SEOHead title={seoTitle} description={seoDescription} canonicalUrl={canonical} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${heroGradient} pt-16 pb-20`}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`
        }} />

        <div className="relative container mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 text-center lg:text-left">
            <Badge
              className="mb-4 text-xs font-bold uppercase tracking-widest px-3 py-1"
              style={{ background: 'rgba(0,0,0,0.15)', color: heroTextDark ? '#333' : '#fff', border: 'none' }}
            >
              CardPop Supplies
            </Badge>
            <h1 className={`font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 leading-none tracking-tight ${textColor}`}>
              {name}
            </h1>
            <p className={`text-lg sm:text-xl font-medium mb-8 max-w-lg ${textMuted}`}>
              {tagline}
            </p>
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <Button
                size="lg"
                className="rounded-full font-bold px-8 shadow-lg"
                style={{ background: heroTextDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)', color: heroTextDark ? '#111' : '#fff', backdropFilter: 'blur(8px)' }}
                onClick={() => browseGridRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                Browse All <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full font-bold px-8"
                style={{ borderColor: heroTextDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', color: heroTextDark ? '#111' : '#fff', background: 'transparent' }}
                asChild
              >
                <Link to="/shop">
                  <Store className="mr-2 w-4 h-4" /> All Supplies
                </Link>
              </Button>
            </div>
          </div>

          <motion.div variants={floatVariants} animate="animate" className="flex-shrink-0">
            <div
              className="w-40 h-40 sm:w-52 sm:h-52 lg:w-64 lg:h-64 rounded-3xl flex items-center justify-center shadow-2xl"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(255,255,255,0.3)' }}
            >
              <Icon className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 opacity-90 drop-shadow-lg" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── STICKY SUBCATEGORY PILL BAR ──────────────────────────────────── */}
      <section className="border-b border-border bg-background/95 backdrop-blur-md sticky top-[70px] lg:top-[120px] z-20 shadow-sm">
        <div className="container mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3">
            <button
              onClick={() => handleSubClick(null)}
              className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl transition-all duration-200 min-w-[56px] ${
                !activeSub ? 'bg-foreground text-background shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              <span className="text-xs font-extrabold leading-tight">All</span>
              <span className="text-[10px] font-normal leading-tight opacity-70">{label}</span>
            </button>

            {items.map((item) => (
              <button
                key={item.slug}
                onClick={() => handleSubClick(item.name)}
                className={`group flex-shrink-0 relative overflow-hidden flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  activeSub === item.name
                    ? 'text-white shadow-md scale-[1.03]'
                    : 'bg-muted text-foreground hover:scale-[1.02]'
                }`}
                style={activeSub === item.name ? { background: accentHex } : undefined}
              >
                <span className="text-xs font-bold leading-tight whitespace-nowrap">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10 space-y-16">

        {/* ── BREADCRUMB (internal linking) ──────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="-mb-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">{name}</span>
        </nav>

        {/* ── SEO INTRO ──────────────────────────────────────────────────── */}
        {seoIntro && (
          <section className="max-w-3xl">
            <div className={`relative text-muted-foreground text-sm sm:text-base leading-relaxed ${!seoExpanded ? 'line-clamp-2' : ''}`}>
              {seoIntro}
            </div>
            <button
              onClick={() => setSeoExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              {seoExpanded ? 'Show Less' : 'Read More'}
              <ChevronDown className={`w-3 h-3 transition-transform ${seoExpanded ? 'rotate-180' : ''}`} />
            </button>
          </section>
        )}

        {/* ── NEW ARRIVALS ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">New Arrivals</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Fresh {name.toLowerCase()} in the shop</p>
            </div>
            <button
              onClick={() => browseGridRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1 text-sm font-bold hover:underline"
              style={{ color: accentHex }}
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {newArrivalsLoading
              ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
              : newArrivals.length === 0
                ? (
                  <div className="py-10 text-center text-muted-foreground w-full flex flex-col items-center gap-2">
                    <ShoppingBag className="w-10 h-10 opacity-30" />
                    <p>No {name.toLowerCase()} in stock yet — check back soon.</p>
                  </div>
                )
                : newArrivals.map((product) => (
                  <MiniProductCard key={product.id} product={product} accentHex={accentHex} />
                ))
            }
          </div>
        </section>

        {/* ── SHOP BY CATEGORY (internal links to each leaf category) ─────── */}
        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-extrabold tracking-tight">Shop by Category</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Browse every {label.toLowerCase()} category</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => (
              <Link
                key={item.slug}
                to={`/shop/category/${item.slug}`}
                className="group flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors"
              >
                <span
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} shadow-sm shrink-0`}
                >
                  <item.Icon className="w-5 h-5 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{item.name}</p>
                  {item.desc && <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FULL BROWSE GRID ──────────────────────────────────────────── */}
        <section ref={browseGridRef} id="browse-grid" className="scroll-mt-[160px] lg:scroll-mt-[220px]">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Browse {activeSub || name}
              </h2>
              {totalProducts > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {totalProducts.toLocaleString()} {totalProducts === 1 ? 'product' : 'products'} available
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-bold gap-2"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Sort
            </Button>
          </div>

          {filtersOpen && (
            <div className="bg-muted/30 border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center mb-6">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[180px] rounded-xl bg-background border-border font-medium">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <ShopFilterPanel
            options={facets.options}
            rows={facets.rows}
            selection={facets.selection}
            onChange={facets.setFacet}
            onClear={facets.clearFacets}
          />

          {productsError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <AlertCircle className="w-10 h-10 opacity-40" />
              <p>{productsError}</p>
              <Button size="sm" variant="outline" className="rounded-full gap-2" onClick={() => fetchProducts(1)}>
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </div>
          ) : (
            <>
              <ProductGrid
                items={products}
                loading={productsLoading && products.length === 0}
                isVault={false}
                onAddToCart={handleAddToCart}
              />

              {hasMore && (
                <div className="flex justify-center mt-10">
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full font-bold px-10 gap-2"
                    onClick={() => fetchProducts(page + 1)}
                    disabled={productsLoading}
                  >
                    {productsLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Load More <ChevronDown className="w-4 h-4" /></>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

      </div>
    </>
  );
};

export default ShopCollectionPage;
