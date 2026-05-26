import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, Star, ArrowRight, Plus,
  SlidersHorizontal, X, RefreshCw, Sparkles, ShoppingBag,
  AlertCircle, Search, Award, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import pb from '@/lib/pocketbaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import { COLLECTION_CONFIGS, resolveCollectionSlug } from '@/data/collectionConfigs.js';

// ─── Hero floating icon animation ───────────────────────────────────────────
const floatVariants = {
  animate: {
    y: [0, -12, 0],
    rotate: [-1, 1, -1],
    transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Skeleton cards for loading state ───────────────────────────────────────
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

// ─── Mini listing card for horizontal scroll sections ────────────────────────
const MiniListingCard = ({ listing, accentHex, badge }) => {
  const imageUrl = listing.images?.[0];
  const imgSrc = imageUrl ? pb.files.getUrl(listing, imageUrl) : null;
  const price = listing.price ?? listing.sale_price ?? 0;
  const title = listing.title ?? listing.cardName ?? listing.name ?? 'Untitled';
  const source = listing.source ?? 'vault';
  const detailPath = `/product/${source}/${listing.id}`;
  const grade = listing.grade ?? listing.gradeText ?? listing.gradeScore;
  const gradingCompany = listing.gradingCompany;

  return (
    <Link
      to={detailPath}
      className="group flex-shrink-0 w-44 sm:w-48 flex flex-col rounded-2xl overflow-hidden border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative aspect-[4/5] bg-muted/30 overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <ShoppingBag className="w-8 h-8" />
          </div>
        )}
        {/* Grade badge overlay */}
        {grade && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-yellow-400 text-yellow-900 shadow">
            {gradingCompany ? `${gradingCompany} ${grade}` : grade}
          </div>
        )}
        {/* Custom badge (e.g. "Trending") */}
        {badge && !grade && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white shadow"
            style={{ background: accentHex }}
          >
            {badge}
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground line-clamp-1">
          {listing.category || listing.collectionType || '—'}
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

// ─── Holy grail card (featured picks) ───────────────────────────────────────
const HolyGrailCard = ({ card, accentHex }) => {
  const imageUrl = card.images?.[0] ?? card.image;
  const imgSrc = imageUrl ? pb.files.getUrl(card, imageUrl) : null;
  const price = card.price ?? card.sale_price ?? 0;
  const title = card.title ?? card.cardName ?? card.name ?? 'Featured Card';
  const sellerName = card.expand?.seller?.name ?? card.expand?.owner?.name ?? card.expand?.owner?.username ?? 'Seller';
  const sellerAvatar = card.expand?.seller?.avatar ?? card.expand?.owner?.avatar;
  const sellerId = card.seller ?? card.owner;
  const avatarSrc = sellerAvatar ? pb.files.getUrl(card.expand?.seller ?? card.expand?.owner, sellerAvatar) : null;
  const source = card.source ?? 'vault';
  const detailPath = `/product/${source}/${card.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="group relative flex flex-col rounded-2xl overflow-hidden border-2 bg-card hover:shadow-2xl transition-all duration-300"
      style={{ borderColor: `${accentHex}40` }}
    >
      <div
        className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: accentHex, color: '#fff' }}
      >
        <Star className="w-3 h-3 fill-white" /> Holy Grail
      </div>

      <Link to={detailPath} className="block relative aspect-[3/4] bg-muted/30 overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <Sparkles className="w-12 h-12" />
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col gap-2">
        <Link to={detailPath}>
          <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
        </Link>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
          <span className="text-xl font-extrabold tabular-nums" style={{ color: accentHex }}>
            ${price.toFixed(2)}
          </span>
          {sellerId && (
            <Link
              to={`/seller/${sellerId}`}
              className="flex items-center gap-1.5 group/seller"
              onClick={e => e.stopPropagation()}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={sellerName} className="w-6 h-6 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {sellerName?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <span className="text-xs text-muted-foreground group-hover/seller:text-foreground transition-colors line-clamp-1 max-w-[80px]">
                {sellerName}
              </span>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  COLLECTION PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const CollectionPage = () => {
  const { collectionSlug: rawSlug } = useParams();
  const navigate = useNavigate();
  const browseGridRef = useRef(null);

  // Resolve config
  const slug = resolveCollectionSlug(rawSlug);
  const config = slug ? COLLECTION_CONFIGS[slug] : null;

  // ─── State ────────────────────────────────────────────────────────────────
  const [categoryId, setCategoryId] = useState(null);
  const [activeEra, setActiveEra] = useState(null);

  const [newReleases, setNewReleases] = useState([]);
  const [newReleasesLoading, setNewReleasesLoading] = useState(true);

  const [holyGrail, setHolyGrail] = useState([]);
  const [holyGrailLoading, setHolyGrailLoading] = useState(true);

  // Graded slabs section (opt-in per config)
  const [gradedListings, setGradedListings] = useState([]);
  const [gradedLoading, setGradedLoading] = useState(false);

  // Trending spotlight (opt-in per config)
  const [trendingListings, setTrendingListings] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState(null);
  const [listingsPage, setListingsPage] = useState(1);
  const [totalListings, setTotalListings] = useState(0);

  const [seoExpanded, setSeoExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterSort, setFilterSort] = useState('-created');
  const [filterSub, setFilterSub] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');

  const [subOpts, setSubOpts] = useState([]);
  const [brandOpts, setBrandOpts] = useState([]);
  const [seriesOpts, setSeriesOpts] = useState([]);

  const isMounted = useRef(true);
  const { getCategories, getSubcategoriesByCategory, getBrandsBySubcategory, getSeriesByBrand } = useCategories();

  const LISTINGS_PER_PAGE = 24;

  // ─── Redirect to 404 if unknown slug ─────────────────────────────────────
  useEffect(() => {
    if (rawSlug && !config) {
      navigate('/not-found', { replace: true });
    }
  }, [rawSlug, config, navigate]);

  // ─── Resolve PocketBase categoryId ───────────────────────────────────────
  useEffect(() => {
    if (!config) return;
    isMounted.current = true;

    getCategories().then(cats => {
      if (!isMounted.current) return;
      const aliases = [config.name, ...(config.categoryAliases ?? [])].map(a => a.toLowerCase());
      const match = cats.find(c => aliases.includes(c.name.toLowerCase()));
      if (match) setCategoryId(match.id);
    });

    return () => { isMounted.current = false; };
  }, [config, getCategories]);

  // ─── Load subcategory cascade ─────────────────────────────────────────────
  useEffect(() => {
    if (categoryId) {
      getSubcategoriesByCategory(categoryId).then(subs => {
        if (isMounted.current) setSubOpts(subs);
      });
    }
  }, [categoryId, getSubcategoriesByCategory]);

  useEffect(() => {
    if (filterSub) getBrandsBySubcategory(filterSub).then(b => { if (isMounted.current) setBrandOpts(b); });
    else { setBrandOpts([]); setFilterBrand(''); }
  }, [filterSub, getBrandsBySubcategory]);

  useEffect(() => {
    if (filterBrand) getSeriesByBrand(filterBrand).then(s => { if (isMounted.current) setSeriesOpts(s); });
    else { setSeriesOpts([]); setFilterSeries(''); }
  }, [filterBrand, getSeriesByBrand]);

  // ─── Era click: match against PocketBase brands and auto-filter ───────────
  // When user selects an era, try to find a matching brand in the first subcategory
  useEffect(() => {
    if (!activeEra || !categoryId || subOpts.length === 0) return;

    const tryMatchEra = async () => {
      for (const sub of subOpts) {
        const brands = await getBrandsBySubcategory(sub.id);
        const match = brands.find(b => b.name.toLowerCase().includes(activeEra.toLowerCase()) || activeEra.toLowerCase().includes(b.name.toLowerCase()));
        if (match) {
          setFilterSub(sub.id);
          setBrandOpts(brands);
          setFilterBrand(match.id);
          return;
        }
      }
      // No match found — just show the hint banner, filters stay unchanged
    };

    tryMatchEra();
  }, [activeEra, categoryId, subOpts, getBrandsBySubcategory]);

  // ─── New Releases ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!categoryId) return;
    setNewReleasesLoading(true);

    const vaultFilter = `is_public=true && categoryId="${categoryId}"`;
    const shopFilter = `(visibility="public" || visibility="marketplace-only") && categoryId="${categoryId}"`;

    Promise.allSettled([
      pb.collection('user_vaults').getList(1, 8, { filter: vaultFilter, sort: '-created', $autoCancel: false }),
      pb.collection('shop_products').getList(1, 8, { filter: shopFilter, sort: '-created', $autoCancel: false }),
    ]).then(([vaultRes, shopRes]) => {
      if (!isMounted.current) return;
      const vaultItems = vaultRes.status === 'fulfilled' ? vaultRes.value.items.map(i => ({ ...i, source: 'vault' })) : [];
      const shopItems = shopRes.status === 'fulfilled' ? shopRes.value.items.map(i => ({ ...i, source: 'shop' })) : [];
      const merged = [...vaultItems, ...shopItems]
        .sort((a, b) => new Date(b.created) - new Date(a.created))
        .slice(0, 10);
      setNewReleases(merged);
      setNewReleasesLoading(false);
    });
  }, [categoryId]);

  // ─── Graded Slabs ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!categoryId || !config?.showGradedSection) return;
    setGradedLoading(true);

    // Filter for cards that have a grade or grading company set
    const gradedFilter = `is_public=true && categoryId="${categoryId}" && (grade!="" || gradingCompany!="")`;

    pb.collection('user_vaults').getList(1, 10, {
      filter: gradedFilter,
      sort: '-created',
      $autoCancel: false,
    }).then(res => {
      if (!isMounted.current) return;
      setGradedListings(res.items.map(i => ({ ...i, source: 'vault' })));
    }).catch(() => {
      if (isMounted.current) setGradedListings([]);
    }).finally(() => {
      if (isMounted.current) setGradedLoading(false);
    });
  }, [categoryId, config]);

  // ─── Trending (highest-priced listings = premium market signal) ───────────
  useEffect(() => {
    if (!categoryId || !config?.showTrendingSection) return;
    setTrendingLoading(true);

    const filter = `is_public=true && categoryId="${categoryId}" && price>0`;

    pb.collection('user_vaults').getList(1, 8, {
      filter,
      sort: '-price',
      $autoCancel: false,
    }).then(res => {
      if (!isMounted.current) return;
      setTrendingListings(res.items.map(i => ({ ...i, source: 'vault' })));
    }).catch(() => {
      if (isMounted.current) setTrendingListings([]);
    }).finally(() => {
      if (isMounted.current) setTrendingLoading(false);
    });
  }, [categoryId, config]);

  // ─── Holy Grail (featured picks) ─────────────────────────────────────────
  useEffect(() => {
    setHolyGrailLoading(true);
    const loadHolyGrail = async () => {
      try {
        const featuredRefs = await pb.collection('featuredCards').getList(1, 20, {
          filter: 'is_active=true',
          sort: 'order',
          $autoCancel: false,
        });

        const cardIds = featuredRefs.items.map(r => r.card_id).filter(Boolean);
        if (cardIds.length === 0) { setHolyGrail([]); return; }

        const filterStr = cardIds.map(id => `id="${id}"`).join(' || ');
        const [vaultRes, shopRes] = await Promise.allSettled([
          pb.collection('user_vaults').getList(1, 20, {
            filter: `(${filterStr}) && is_public=true${categoryId ? ` && categoryId="${categoryId}"` : ''}`,
            expand: 'seller',
            $autoCancel: false,
          }),
          pb.collection('shop_products').getList(1, 20, {
            filter: filterStr,
            $autoCancel: false,
          }),
        ]);

        const vaultItems = vaultRes.status === 'fulfilled' ? vaultRes.value.items.map(i => ({ ...i, source: 'vault' })) : [];
        const shopItems = shopRes.status === 'fulfilled' ? shopRes.value.items.map(i => ({ ...i, source: 'shop' })) : [];

        const idOrderMap = Object.fromEntries(featuredRefs.items.map((r, idx) => [r.card_id, idx]));
        const all = [...vaultItems, ...shopItems].sort((a, b) => (idOrderMap[a.id] ?? 99) - (idOrderMap[b.id] ?? 99));

        if (isMounted.current) setHolyGrail(all.slice(0, 6));
      } catch {
        if (isMounted.current) setHolyGrail([]);
      } finally {
        if (isMounted.current) setHolyGrailLoading(false);
      }
    };
    loadHolyGrail();
  }, [categoryId]);

  // ─── Main Browse Grid ─────────────────────────────────────────────────────
  const fetchListings = useCallback(async (page = 1) => {
    if (!categoryId) return;
    if (isMounted.current) { setListingsLoading(true); setListingsError(null); }

    let vaultFilter = `is_public=true && categoryId="${categoryId}"`;
    let shopFilter = `(visibility="public" || visibility="marketplace-only") && categoryId="${categoryId}"`;

    if (filterSub) { vaultFilter += ` && subcategoryId="${filterSub}"`; shopFilter += ` && subcategoryId="${filterSub}"`; }
    if (filterBrand) { vaultFilter += ` && brandId="${filterBrand}"`; shopFilter += ` && brandId="${filterBrand}"`; }
    if (filterSeries) { vaultFilter += ` && seriesId="${filterSeries}"`; shopFilter += ` && seriesId="${filterSeries}"`; }
    if (filterCondition) vaultFilter += ` && condition="${filterCondition}"`;

    if (filterType === 'For Sale') {
      vaultFilter += ' && (listing_type="For Sale" || listing_type="For Sale & Trade")';
    } else if (filterType === 'For Trade') {
      shopFilter = 'id="NONE"';
      vaultFilter += ' && (listing_type="For Trade" || listing_type="For Sale & Trade")';
    } else {
      vaultFilter += ' && (listing_type="For Sale" || listing_type="For Trade" || listing_type="For Sale & Trade")';
    }

    try {
      const perPage = LISTINGS_PER_PAGE;
      const [vaultRes, shopRes] = await Promise.allSettled([
        pb.collection('user_vaults').getList(page, perPage, { filter: vaultFilter, sort: filterSort, $autoCancel: false }),
        pb.collection('shop_products').getList(page, perPage, { filter: shopFilter, sort: filterSort, $autoCancel: false }),
      ]);

      if (!isMounted.current) return;

      const vaultItems = vaultRes.status === 'fulfilled' ? vaultRes.value.items.map(i => ({ ...i, source: 'vault' })) : [];
      const shopItems = shopRes.status === 'fulfilled' ? shopRes.value.items.map(i => ({ ...i, source: 'shop' })) : [];
      const vaultTotal = vaultRes.status === 'fulfilled' ? vaultRes.value.totalItems : 0;
      const shopTotal = shopRes.status === 'fulfilled' ? shopRes.value.totalItems : 0;

      let merged = [...vaultItems, ...shopItems];
      if (filterSort === '-created') merged.sort((a, b) => new Date(b.created) - new Date(a.created));
      else if (filterSort === 'price') merged.sort((a, b) => (a.price || 0) - (b.price || 0));
      else if (filterSort === '-price') merged.sort((a, b) => (b.price || 0) - (a.price || 0));

      setListings(page === 1 ? merged : prev => [...prev, ...merged]);
      setTotalListings(vaultTotal + shopTotal);
      setListingsPage(page);
    } catch (err) {
      if (isMounted.current) setListingsError('Failed to load listings. Please try again.');
    } finally {
      if (isMounted.current) setListingsLoading(false);
    }
  }, [categoryId, filterType, filterCondition, filterSort, filterSub, filterBrand, filterSeries]);

  useEffect(() => {
    if (categoryId) fetchListings(1);
  }, [fetchListings, categoryId]);

  const clearFilters = () => {
    setFilterType('All');
    setFilterCondition('');
    setFilterSort('-created');
    setFilterSub('');
    setFilterBrand('');
    setFilterSeries('');
    setActiveEra(null);
  };

  const handleEraClick = (eraName) => {
    const next = eraName === activeEra ? null : eraName;
    setActiveEra(next);
    if (next) {
      // Scroll to browse grid after a short delay so state updates first
      setTimeout(() => browseGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const hasActiveFilters = filterType !== 'All' || filterCondition || filterSort !== '-created' || filterSub || filterBrand || filterSeries;

  if (!config) return null;

  const { Icon, heroGradient, heroTextDark, accentHex, tagline, name, seoTitle, seoDescription, seoIntro, eras, holyGrailLabel, holyGrailDesc, showGradedSection, showTrendingSection } = config;

  const textColor = heroTextDark ? 'text-gray-900' : 'text-white';
  const textMuted = heroTextDark ? 'text-gray-700' : 'text-white/80';

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
      </Helmet>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${heroGradient} pt-16 pb-20`}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`
        }} />

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 text-center lg:text-left">
            <Badge
              className="mb-4 text-xs font-bold uppercase tracking-widest px-3 py-1"
              style={{ background: 'rgba(0,0,0,0.15)', color: heroTextDark ? '#333' : '#fff', border: 'none' }}
            >
              CardPop Collections
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
                <Link to="/vault/add">
                  <Plus className="mr-2 w-4 h-4" /> List Your Cards
                </Link>
              </Button>
            </div>
          </div>

          <motion.div variants={floatVariants} animate="animate" className="flex-shrink-0">
            <div
              className="w-40 h-40 sm:w-52 sm:h-52 lg:w-64 lg:h-64 rounded-3xl flex items-center justify-center shadow-2xl"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(255,255,255,0.3)' }}
            >
              <Icon className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 opacity-90 drop-shadow-lg" style={{ color: heroTextDark ? 'rgba(0,0,0,0.7)' : '#fff' }} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ERA / SET BRAND STRIP ─────────────────────────────────────────── */}
      {eras && eras.length > 0 && (
        <>
          {/* Visual era tiles — full-width horizontal scroll */}
          <section className="bg-card border-b border-border overflow-hidden">
            <div className="container mx-auto px-4 sm:px-6 py-5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-3 px-1">Browse by Set Era</p>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {eras.map(era => (
                  <button
                    key={era.name}
                    onClick={() => handleEraClick(era.name)}
                    className={`group flex-shrink-0 relative rounded-2xl overflow-hidden transition-all duration-200 ${
                      activeEra === era.name ? 'ring-2 ring-offset-2 scale-[1.03]' : 'hover:scale-[1.02]'
                    }`}
                    style={activeEra === era.name ? { ringColor: accentHex } : {}}
                  >
                    <div className={`bg-gradient-to-br ${era.gradient} px-5 py-4 min-w-[140px] text-left`}>
                      <p className="text-white font-extrabold text-sm leading-tight">{era.name}</p>
                      <p className="text-white/70 text-[11px] mt-0.5">{era.years}</p>
                      {era.hint && (
                        <p className="text-white/50 text-[10px] mt-1.5 leading-snug line-clamp-2 hidden group-hover:block">
                          {era.hint}
                        </p>
                      )}
                    </div>
                    {activeEra === era.name && (
                      <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                          <Search className="w-3 h-3 text-gray-700" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Sticky filter pills (compact) */}
          <section className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-20 shadow-sm">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2">
                <button
                  onClick={clearFilters}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    !activeEra ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  All
                </button>
                {eras.map(era => (
                  <button
                    key={era.name}
                    onClick={() => handleEraClick(era.name)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                      activeEra === era.name
                        ? `bg-gradient-to-r ${era.gradient} text-white shadow-sm`
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {era.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

        {/* ── SEO INTRO ───────────────────────────────────────────────────── */}
        {seoIntro && (
          <section className="max-w-3xl">
            <div className={`relative text-muted-foreground text-sm sm:text-base leading-relaxed ${!seoExpanded ? 'line-clamp-2' : ''}`}>
              {seoIntro}
            </div>
            <button
              onClick={() => setSeoExpanded(v => !v)}
              className="mt-2 flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              {seoExpanded ? 'Show Less' : 'Read More'}
              <ChevronDown className={`w-3 h-3 transition-transform ${seoExpanded ? 'rotate-180' : ''}`} />
            </button>
          </section>
        )}

        {/* ── NEW RELEASES ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">New Releases</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Fresh listings in the {name} category</p>
            </div>
            <Link
              to="/marketplace"
              className="flex items-center gap-1 text-sm font-bold hover:underline"
              style={{ color: accentHex }}
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {newReleasesLoading
              ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
              : newReleases.length === 0
                ? (
                  <div className="py-10 text-center text-muted-foreground w-full flex flex-col items-center gap-2">
                    <ShoppingBag className="w-10 h-10 opacity-30" />
                    <p>No listings yet — be the first to sell {name} cards on CardPop!</p>
                    <Button size="sm" variant="outline" className="mt-2 rounded-full" asChild>
                      <Link to="/vault/add">List a Card</Link>
                    </Button>
                  </div>
                )
                : newReleases.map(listing => (
                  <MiniListingCard key={listing.id} listing={listing} accentHex={accentHex} />
                ))
            }
          </div>
        </section>

        {/* ── GRADED SLABS ─────────────────────────────────────────────────── */}
        {showGradedSection && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: `linear-gradient(135deg, #F59E0B, #D97706)` }}
                >
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Graded Slabs</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">PSA · BGS · CGC · ACE graded {name} cards</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFilterCondition('');
                  browseGridRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm font-bold hover:underline flex items-center gap-1"
                style={{ color: accentHex }}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {gradedLoading
                ? Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
                : gradedListings.length === 0
                  ? (
                    <div className="py-8 text-muted-foreground w-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border">
                      <Award className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No graded {name} cards listed yet.</p>
                      <p className="text-xs text-muted-foreground/70">List a PSA or BGS slab to appear here.</p>
                    </div>
                  )
                  : gradedListings.map(listing => (
                    <MiniListingCard key={listing.id} listing={listing} accentHex="#D97706" />
                  ))
              }
            </div>
          </section>
        )}

        {/* ── HOLY GRAIL ───────────────────────────────────────────────────── */}
        <section className="rounded-3xl overflow-hidden border-2 p-6 sm:p-8" style={{ borderColor: `${accentHex}30`, background: `linear-gradient(135deg, ${accentHex}08 0%, transparent 60%)` }}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-5 h-5 fill-current" style={{ color: accentHex }} />
                <h2 className="text-2xl font-extrabold tracking-tight">{holyGrailLabel ?? 'Holy Grail Picks'}</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                {holyGrailDesc ?? `CardPop-curated ${name} cards worth chasing — hand-picked for condition, rarity, and value.`}
              </p>
            </div>
          </div>

          {holyGrailLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border bg-card">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : holyGrail.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Holy Grail picks coming soon for {name}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {holyGrail.map(card => (
                <HolyGrailCard key={card.id} card={card} accentHex={accentHex} />
              ))}
            </div>
          )}
        </section>

        {/* ── TRENDING SPOTLIGHT ───────────────────────────────────────────── */}
        {showTrendingSection && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)` }}
                >
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Trending Now</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Premium {name} cards at the top of the market</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFilterSort('-price');
                  browseGridRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm font-bold hover:underline flex items-center gap-1"
                style={{ color: accentHex }}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {trendingLoading
                ? Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
                : trendingListings.length === 0
                  ? (
                    <div className="py-8 text-muted-foreground w-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border">
                      <TrendingUp className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No trending {name} cards yet.</p>
                    </div>
                  )
                  : trendingListings.map(listing => (
                    <MiniListingCard key={listing.id} listing={listing} accentHex={accentHex} badge="Premium" />
                  ))
              }
            </div>
          </section>
        )}

        {/* ── FULL BROWSE GRID ─────────────────────────────────────────────── */}
        <section ref={browseGridRef} id="browse-grid">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Browse {name}</h2>
              {totalListings > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">{totalListings.toLocaleString()} listings available</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-bold gap-2"
              onClick={() => setFiltersOpen(v => !v)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="bg-muted/30 border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[150px] rounded-xl bg-background border-border font-medium">
                      <SelectValue placeholder="Listing Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      <SelectItem value="For Sale">For Sale</SelectItem>
                      <SelectItem value="For Trade">For Trade</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterCondition} onValueChange={setFilterCondition}>
                    <SelectTrigger className="w-[150px] rounded-xl bg-background border-border font-medium">
                      <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Conditions</SelectItem>
                      <SelectItem value="Mint">Mint</SelectItem>
                      <SelectItem value="Near Mint">Near Mint</SelectItem>
                      <SelectItem value="Excellent">Excellent</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Light Play">Light Play</SelectItem>
                      <SelectItem value="Moderate Play">Moderate Play</SelectItem>
                      <SelectItem value="Heavy Play">Heavy Play</SelectItem>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterSort} onValueChange={setFilterSort}>
                    <SelectTrigger className="w-[160px] rounded-xl bg-background border-border font-medium">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-created">Newest First</SelectItem>
                      <SelectItem value="created">Oldest First</SelectItem>
                      <SelectItem value="price">Price: Low to High</SelectItem>
                      <SelectItem value="-price">Price: High to Low</SelectItem>
                    </SelectContent>
                  </Select>

                  {subOpts.length > 0 && (
                    <Select value={filterSub} onValueChange={setFilterSub}>
                      <SelectTrigger className="w-[160px] rounded-xl bg-background border-border font-medium">
                        <SelectValue placeholder="Subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Subcategories</SelectItem>
                        {subOpts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {brandOpts.length > 0 && (
                    <Select value={filterBrand} onValueChange={setFilterBrand}>
                      <SelectTrigger className="w-[150px] rounded-xl bg-background border-border font-medium">
                        <SelectValue placeholder="Brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Brands</SelectItem>
                        {brandOpts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {seriesOpts.length > 0 && (
                    <Select value={filterSeries} onValueChange={setFilterSeries}>
                      <SelectTrigger className="w-[150px] rounded-xl bg-background border-border font-medium">
                        <SelectValue placeholder="Series" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Series</SelectItem>
                        {seriesOpts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-xl ml-auto text-muted-foreground">
                      <X className="w-4 h-4 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active era hint banner */}
          {activeEra && (
            <div
              className="mb-6 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
              style={{ background: `${accentHex}15`, color: accentHex }}
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span>Browsing era: <strong>{activeEra}</strong></span>
              {eras?.find(e => e.name === activeEra)?.hint && (
                <span className="text-muted-foreground font-normal ml-1 hidden sm:inline">
                  — {eras.find(e => e.name === activeEra).hint}
                </span>
              )}
              <button onClick={() => setActiveEra(null)} className="ml-auto opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Grid */}
          {listingsError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <AlertCircle className="w-10 h-10 opacity-40" />
              <p>{listingsError}</p>
              <Button size="sm" variant="outline" className="rounded-full gap-2" onClick={() => fetchListings(1)}>
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </div>
          ) : listingsLoading && listings.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border bg-card">
                  <Skeleton className="aspect-[4/5] w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-6 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <Icon className="w-10 h-10 text-muted-foreground opacity-40" />
              </div>
              <h3 className="text-xl font-bold">No listings yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Be the first to list {name} cards on CardPop! Connect with thousands of Australian collectors.
              </p>
              <Button className="rounded-full font-bold px-8 mt-2" asChild>
                <Link to="/vault/add">List Your Cards</Link>
              </Button>
            </div>
          ) : (
            <>
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
              >
                {listings.map(listing => (
                  <motion.div
                    key={listing.id}
                    variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  >
                    <MarketplaceListingCard listing={listing} />
                  </motion.div>
                ))}
              </motion.div>

              {listings.length < totalListings && (
                <div className="flex justify-center mt-10">
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full font-bold px-10 gap-2"
                    onClick={() => fetchListings(listingsPage + 1)}
                    disabled={listingsLoading}
                  >
                    {listingsLoading ? (
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

export default CollectionPage;
