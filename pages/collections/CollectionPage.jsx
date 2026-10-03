import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
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
import { supabase } from '@/lib/supabaseClient.js';
import { VAULT_ITEM_CARD_SELECT, LISTING_CARD_VAULT_EMBED_INNER } from '@/lib/listingCardColumns.js';
import { vaultItemListing } from '@/lib/vaultItemListing.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { useCategories } from '@/hooks/useCategories.js';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import GradeBadge from '@/components/GradeBadge.jsx';
import SoldBadge from '@/components/SoldBadge.jsx';
import { COLLECTION_CONFIGS, resolveCollectionSlug } from '@/data/collectionConfigs.js';
import { useCollectionEras } from '@/hooks/useCollectionEras.js';
import { slugify } from '@/lib/slugify.js';
import { CARD_VARIANTS, getCardVariants, FOIL_VARIANT } from '@/lib/cardVariants.js';
import { genericVariantChips, getAutographLabel } from '@/lib/cardAttributeLabels.js';
import { fetchPinnedSectionItems, mergePinned } from '@/lib/collectionSections.js';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';

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
  // Vault-sourced rails carry the card's listing in `listings`; marketplace
  // rows carry their own status. Either way a sold card is badged, never shown
  // as available — the vault row's listing_type still reads "For Sale".
  const rowListing = vaultItemListing(listing);
  const isSold = listing.status === 'sold' || rowListing?.status === 'sold';
  const imgPath = listing.card_image || listing.vault_images?.[0]?.storage_path || null;
  const imgSrc = imgPath
    ? (publicImageUrl(imgPath))
    : null;
  const price = listing.estimated_value_aud ?? listing.price_aud ?? listing.price ?? 0;
  const title = listing.card_name ?? listing.title ?? listing.name ?? 'Untitled';
  const source = listing.source ?? 'vault';
  const detailPath = source === 'marketplace'
    ? `/marketplace/${listing.id}/${slugify(title)}`
    : (rowListing
        ? `/marketplace/${rowListing.id}/${slugify(title)}`
        : `/product/${source}/${listing.id}/${slugify(title)}`);
  const grade = listing.grade;
  const gradingCompany = listing.grading_company;

  // Eyebrow line: the set the card belongs to (what the card is), falling back
  // to the collection. Marketplace-sourced rows carry `category` instead.
  const eyebrow = listing.set_name || listing.category || listing.collectionType || listing.collection || '—';
  const detailBits = [listing.year, listing.card_number ? `#${listing.card_number}` : null].filter(Boolean);
  // Finish chips — a selected Foil / Holo must be visible on the tile. `variant`
  // is a comma-separated string on vault rows.
  const variantList = listing.variant
    ? String(listing.variant).split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const finishChips = genericVariantChips(variantList)
    .filter(v => v !== FOIL_VARIANT)
    .slice(0, 2);
  const isFoil = !!listing.is_foil || variantList.some(v => /holo|foil/i.test(v));
  const autoLabel = getAutographLabel(listing);

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
        {isSold && <SoldBadge size="sm" className="absolute top-2 left-2 z-10" />}
        {/* Grade badge overlay */}
        {grade && (
          <GradeBadge grade={grade} gradingCompany={gradingCompany} isPositioned={false} className="absolute top-2 right-2 z-10 text-[10px]" />
        )}
        {/* Custom badge (e.g. "Trending") */}
        {badge && !grade && !isSold && (
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
          {eyebrow}
        </p>
        <p className="text-sm font-bold leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {title}
        </p>
        {detailBits.length > 0 && (
          <p className="text-[11px] text-muted-foreground line-clamp-1">{detailBits.join(' · ')}</p>
        )}
        {(isFoil || finishChips.length > 0 || autoLabel || listing.is_rookie) && (
          <div className="flex flex-wrap gap-1">
            {isFoil && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none border border-yellow-400/50 bg-yellow-400/10 text-yellow-800 dark:text-yellow-300">
                <Sparkles className="w-2.5 h-2.5" /> {finishChips.find(v => /holo|foil/i.test(v)) ?? 'Holo'}
              </span>
            )}
            {finishChips.filter(v => !/holo|foil/i.test(v)).map(v => (
              <span key={v} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none border border-primary/30 bg-primary/5 text-primary">{v}</span>
            ))}
            {autoLabel && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none border border-border bg-muted/50 text-foreground">Auto</span>
            )}
            {listing.is_rookie && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-amber-100 text-amber-900">RC</span>
            )}
          </div>
        )}
        <p
          className={`text-base font-extrabold tabular-nums mt-auto ${isSold ? 'line-through opacity-60' : ''}`}
          style={{ color: isSold ? undefined : accentHex }}
        >
          ${price.toFixed(2)}
        </p>
      </div>
    </Link>
  );
};

// ─── Holy grail card (featured picks) ───────────────────────────────────────
const HolyGrailCard = ({ card, accentHex }) => {
  const imgPath = card.card_image || card.vault_images?.[0]?.storage_path || null;
  const imgSrc = imgPath
    ? (publicImageUrl(imgPath))
    : null;
  const price = card.estimated_value_aud ?? 0;
  const title = card.card_name ?? 'Featured Card';
  const sellerName = card.owner?.display_name || card.owner?.username || 'Seller';
  const sellerId = card.owner_id;
  const avatarSrc = card.owner?.avatar_url || null;
  const source = card.source ?? 'vault';
  // Same rule as MiniListingCard: the vault row's embedded listing is the only
  // place "sold" lives, and it's also the right page to link to.
  const rowListing = vaultItemListing(card);
  const isSold = card.status === 'sold' || rowListing?.status === 'sold';
  const detailPath = source === 'marketplace'
    ? `/marketplace/${card.id}/${slugify(title)}`
    : (rowListing
        ? `/marketplace/${rowListing.id}/${slugify(title)}`
        : `/product/${source}/${card.id}/${slugify(title)}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="group relative flex flex-col rounded-2xl overflow-hidden border-2 bg-card hover:shadow-2xl transition-all duration-300"
      style={{ borderColor: `${accentHex}40` }}
    >
      <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none">
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: accentHex, color: '#fff' }}
        >
          <Star className="w-3 h-3 fill-white" /> Holy Grail
        </div>
        {isSold && <SoldBadge size="sm" />}
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
          <span
            className={`text-xl font-extrabold tabular-nums ${isSold ? 'line-through opacity-60' : ''}`}
            style={{ color: isSold ? undefined : accentHex }}
          >
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

// ─── Pikachu outline icon (used for Pokémon Graded Slabs badge) ──────────────
const PikachuIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {/* Head */}
    <ellipse cx="12" cy="14.5" rx="7.5" ry="6.5" />
    {/* Left ear */}
    <path d="M6.5 9.5 L4.5 3 L10 8" />
    {/* Right ear */}
    <path d="M17.5 9.5 L19.5 3 L14 8" />
    {/* Left eye */}
    <circle cx="9.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
    {/* Right eye */}
    <circle cx="14.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
    {/* Left cheek */}
    <circle cx="7.5" cy="16.5" r="1.5" fill="currentColor" stroke="none" opacity="0.45" />
    {/* Right cheek */}
    <circle cx="16.5" cy="16.5" r="1.5" fill="currentColor" stroke="none" opacity="0.45" />
    {/* Smile */}
    <path d="M10 17.5 Q12 19.5 14 17.5" />
    {/* Nose */}
    <circle cx="12" cy="15.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  COLLECTION PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const CollectionPage = () => {
  const { collectionSlug: rawSlug } = useParams();
  const browseGridRef = useRef(null);

  // Resolve config
  const slug = resolveCollectionSlug(rawSlug);
  const config = slug ? COLLECTION_CONFIGS[slug] : null;
  const GradedIcon = slug === 'pokemon' ? PikachuIcon : Award;

  // DB-driven eras (falls back to static config if DB is empty)
  const { eras } = useCollectionEras(slug);

  // ─── State ────────────────────────────────────────────────────────────────
  const [categoryId, setCategoryId] = useState(null);
  const [activeEra, setActiveEra] = useState(null);

  // Scroll to top immediately when slug changes (fires before paint, catches both remount and re-render cases)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [rawSlug]);

  // Reset ALL derived state when slug changes (guards against deferred key-remount in concurrent mode)
  const prevSlugRef = useRef(slug);
  useEffect(() => {
    if (prevSlugRef.current !== slug) {
      prevSlugRef.current = slug;
      setCategoryId(null);
      setActiveEra(null);
      setNewReleases([]);
      setNewReleasesLoading(true);
      setHolyGrail([]);
      setHolyGrailLoading(true);
      setGradedListings([]);
      setTrendingListings([]);
      setListings([]);
      setListingsLoading(true);
      setListingsError(null);
      setListingsPage(1);
      setTotalListings(0);
      setSeoExpanded(false);
      setFiltersOpen(false);
      setFilterType('All');
      setFilterCondition('');
      setFilterVariant('');
      setFilterSort('-created');
      setFilterSub('');
      setFilterBrand('');
      setFilterSeries('');
    }
  }, [slug]);

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
  const [filterVariant, setFilterVariant] = useState('');
  const [filterSort, setFilterSort] = useState('-created');
  const [filterSub, setFilterSub] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');

  const [subOpts, setSubOpts] = useState([]);
  const [brandOpts, setBrandOpts] = useState([]);
  const [seriesOpts, setSeriesOpts] = useState([]);

  const { getCategories, getSubcategoriesByCategory, getBrandsBySubcategory, getSeriesByBrand } = useCategories();

  const LISTINGS_PER_PAGE = 24;

  // ─── Resolve categoryId from DB ───────────────────────────────────────────
  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    getCategories().then(cats => {
      if (cancelled) return;
      const aliases = [config.name, ...(config.categoryAliases ?? [])].map(a => a.toLowerCase());
      const match = cats.find(c => aliases.includes(c.name.toLowerCase()));
      if (match) setCategoryId(match.id);
    });
    return () => { cancelled = true; };
  }, [config, getCategories]);

  // ─── Load subcategory cascade ─────────────────────────────────────────────
  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    getSubcategoriesByCategory(categoryId).then(subs => {
      if (!cancelled) setSubOpts(subs);
    });
    return () => { cancelled = true; };
  }, [categoryId, getSubcategoriesByCategory]);

  useEffect(() => {
    if (!filterSub) { setBrandOpts([]); setFilterBrand(''); return; }
    let cancelled = false;
    getBrandsBySubcategory(filterSub).then(b => { if (!cancelled) setBrandOpts(b); });
    return () => { cancelled = true; };
  }, [filterSub, getBrandsBySubcategory]);

  useEffect(() => {
    if (!filterBrand) { setSeriesOpts([]); setFilterSeries(''); return; }
    let cancelled = false;
    getSeriesByBrand(filterBrand).then(s => { if (!cancelled) setSeriesOpts(s); });
    return () => { cancelled = true; };
  }, [filterBrand, getSeriesByBrand]);

  // Clear subcategory dropdown when an era pill is selected (they're independent filters)
  useEffect(() => {
    if (activeEra) setFilterSub('');
  }, [activeEra]);

  // ─── New Releases (admin-pinned first, then newest) ───────────────────────
  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    setNewReleasesLoading(true);

    (async () => {
      try {
        const [pinned, autoRes] = await Promise.all([
          fetchPinnedSectionItems(slug, 'new_releases'),
          supabase.from('vault_items')
            .select(VAULT_ITEM_CARD_SELECT)
            .or(`category_id.eq.${categoryId},franchise_id.eq.${categoryId}`)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);
        if (cancelled) return;
        const auto = (autoRes.data ?? []).map(i => ({ ...i, source: 'vault' }));
        setNewReleases(mergePinned(pinned, auto, 10));
      } catch {
        if (!cancelled) setNewReleases([]);
      } finally {
        if (!cancelled) setNewReleasesLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [categoryId, slug]);

  // ─── Graded Slabs (admin-pinned first, then newest graded) ────────────────
  useEffect(() => {
    if (!categoryId || !config?.showGradedSection) return;
    let cancelled = false;
    setGradedLoading(true);

    (async () => {
      try {
        const [pinned, autoRes] = await Promise.all([
          fetchPinnedSectionItems(slug, 'graded'),
          supabase.from('vault_items').select(VAULT_ITEM_CARD_SELECT)
            .or(`category_id.eq.${categoryId},franchise_id.eq.${categoryId}`)
            .eq('is_public', true)
            .not('grade', 'is', null)
            .neq('grading_company', 'raw')
            .order('created_at', { ascending: false })
            .limit(10),
        ]);
        if (cancelled) return;
        const auto = (autoRes.data ?? []).map(i => ({ ...i, source: 'vault' }));
        setGradedListings(mergePinned(pinned, auto, 10));
      } catch {
        if (!cancelled) setGradedListings([]);
      } finally {
        if (!cancelled) setGradedLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [categoryId, config, slug]);

  // ─── Trending (admin-pinned first, then highest-priced) ───────────────────
  useEffect(() => {
    if (!categoryId || !config?.showTrendingSection) return;
    let cancelled = false;
    setTrendingLoading(true);

    (async () => {
      try {
        const [pinned, autoRes] = await Promise.all([
          fetchPinnedSectionItems(slug, 'trending'),
          supabase.from('vault_items').select(VAULT_ITEM_CARD_SELECT)
            .or(`category_id.eq.${categoryId},franchise_id.eq.${categoryId}`)
            .eq('is_public', true)
            .gt('estimated_value_aud', 0)
            .order('estimated_value_aud', { ascending: false })
            .limit(8),
        ]);
        if (cancelled) return;
        const auto = (autoRes.data ?? []).map(i => ({ ...i, source: 'vault' }));
        setTrendingListings(mergePinned(pinned, auto, 8));
      } catch {
        if (!cancelled) setTrendingListings([]);
      } finally {
        if (!cancelled) setTrendingLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [categoryId, config, slug]);

  // ─── Holy Grail (admin-pinned first, then highest-value picks) ────────────
  useEffect(() => {
    let cancelled = false;
    setHolyGrailLoading(true);
    const loadHolyGrail = async () => {
      try {
        let query = supabase.from('vault_items')
          .select(`${VAULT_ITEM_CARD_SELECT}, owner:profiles!vault_items_owner_id_fkey(${PUBLIC_PROFILE_COLUMNS})`)
          .eq('is_public', true)
          .gt('estimated_value_aud', 0)
          .order('estimated_value_aud', { ascending: false })
          .limit(6);
        if (categoryId) query = query.or(`category_id.eq.${categoryId},franchise_id.eq.${categoryId}`);
        const [pinned, { data: featured }] = await Promise.all([
          fetchPinnedSectionItems(slug, 'holy_grail', `${VAULT_ITEM_CARD_SELECT}, owner:profiles!vault_items_owner_id_fkey(${PUBLIC_PROFILE_COLUMNS})`),
          query,
        ]);
        if (cancelled) return;
        const auto = (featured ?? []).map(i => ({ ...i, source: 'vault' }));
        setHolyGrail(mergePinned(pinned, auto, 6));
      } catch {
        if (!cancelled) setHolyGrail([]);
      } finally {
        if (!cancelled) setHolyGrailLoading(false);
      }
    };
    loadHolyGrail();
    return () => { cancelled = true; };
  }, [categoryId, slug]);

  // ─── Main Browse Grid ─────────────────────────────────────────────────────
  // Each call gets a unique id; state updates are skipped once a newer call
  // (or unmount) supersedes this one, so stale responses can't overwrite the grid.
  const listingsFetchIdRef = useRef(0);
  const fetchListings = useCallback(async (page = 1) => {
    if (!categoryId) return;
    const fetchId = ++listingsFetchIdRef.current;
    const isCurrent = () => listingsFetchIdRef.current === fetchId;
    setListingsLoading(true); setListingsError(null);

    const perPage = LISTINGS_PER_PAGE;
    const from = (page - 1) * perPage;

    try {
      // Query active listings, joining vault_items (inner so only listings with
      // matching vault items are returned) to apply the category filter.
      // The add-card flow stores the specific game/sport (e.g. NBA) in
      // franchise_id and the broad group (e.g. Sports) in category_id, while
      // older rows stored the specific id directly in category_id — so match
      // the resolved collection id against EITHER column.
      // When a subcategory is chosen, narrow the match to it (subcategories are
      // more specific children of the collection); otherwise match the whole
      // collection. Both use the same dual-column convention as the add-card
      // flow (specific id in franchise_id, broad group in category_id).
      const catMatch = filterSub || categoryId;

      let q = supabase.from('listings')
        .select(
          `*, ${LISTING_CARD_VAULT_EMBED_INNER}, seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, is_admin, is_sole_trader, business_name, business_logo_url, store_slug)`,
          { count: 'estimated' }
        )
        // Sold listings stay in the grid, badged "Sold" (not purchasable).
        .in('status', ['active', 'sold'])
        .or(`category_id.eq.${catMatch},franchise_id.eq.${catMatch}`, { referencedTable: 'vault_items' })
        .range(from, from + perPage - 1);

      // Era pills carry a short label (e.g. "Topps Chrome") while real set
      // names are fuller strings ("2023-24 Topps Chrome Basketball"), so match
      // on a substring rather than exact equality.
      if (activeEra) q = q.ilike('vault_items.set_name', `%${activeEra}%`);
      if (filterCondition) q = q.eq('vault_items.condition', filterCondition);
      if (filterVariant) q = q.ilike('vault_items.variant', `%${filterVariant}%`);

      if (filterType === 'For Sale') {
        q = q.in('listing_type', ['fixed', 'auction']);
      } else if (filterType === 'For Trade') {
        q = q.eq('listing_type', 'trade');
      }

      if (filterSort === '-created') { q = q.order('created_at', { ascending: false }); }
      else if (filterSort === 'price') { q = q.order('price_aud'); }
      else if (filterSort === '-price') { q = q.order('price_aud', { ascending: false }); }
      else { q = q.order('created_at', { ascending: false }); }

      const { data, error, count } = await q;

      if (!isCurrent()) return;
      if (error) throw error;

      setListings(page === 1 ? (data ?? []) : prev => [...prev, ...(data ?? [])]);
      setTotalListings(count ?? 0);
      setListingsPage(page);
    } catch (err) {
      if (isCurrent()) setListingsError('Failed to load listings. Please try again.');
    } finally {
      if (isCurrent()) setListingsLoading(false);
    }
  }, [categoryId, activeEra, filterType, filterCondition, filterVariant, filterSort, filterSub]);

  useEffect(() => {
    if (categoryId) fetchListings(1);
  }, [fetchListings, categoryId]);

  const clearFilters = () => {
    setFilterType('All');
    setFilterCondition('');
    setFilterVariant('');
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

  const hasActiveFilters = filterType !== 'All' || filterCondition || filterVariant || filterSort !== '-created' || filterSub || filterBrand || filterSeries;

  if (!config) return null;

  const { Icon, heroGradient, heroTextDark, accentHex, tagline, name, seoTitle, seoDescription, seoIntro, holyGrailLabel, holyGrailDesc, showGradedSection, showTrendingSection } = config;

  const textColor = heroTextDark ? 'text-gray-900' : 'text-white';
  const textMuted = heroTextDark ? 'text-gray-700' : 'text-white/80';

  // Unknown collection slug → render the 404 in place (keeps the requested URL
  // rather than redirecting to a fake /not-found path).
  if (rawSlug && !config) return <NotFoundPage />;

  return (
    <>
      <SEOHead title={seoTitle} description={seoDescription} />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
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

      {/* ── ERA STICKY PILL BAR ──────────────────────────────────────────────── */}
      {/* top-[70px] = mobile header (py-3 + h-[44px] icon ≈ 68px + 1px border)  */}
      {/* lg:top-[120px] = desktop: Row 1 (68px) + Row 2 nav (48px) + border (1px) */}
      {eras && eras.length > 0 && (
        <section className="border-b border-border bg-background/95 backdrop-blur-md sticky top-[70px] lg:top-[120px] z-20 shadow-sm">
          <div className="container mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3">

              {/* All / reset */}
              <button
                onClick={clearFilters}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl transition-all duration-200 min-w-[56px] ${
                  !activeEra
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <span className="text-xs font-extrabold leading-tight">All</span>
                <span className="text-[10px] font-normal leading-tight opacity-70">Eras</span>
              </button>

              {eras.map(era => (
                <button
                  key={era.name}
                  onClick={() => handleEraClick(era.name)}
                  title={era.hint || undefined}
                  className={`group flex-shrink-0 relative overflow-hidden flex flex-col items-start px-4 py-2 rounded-xl transition-all duration-200 min-w-[100px] ${
                    activeEra === era.name
                      ? `bg-gradient-to-r ${era.gradient} text-white shadow-md scale-[1.03]`
                      : 'bg-muted text-foreground hover:scale-[1.02]'
                  }`}
                >
                  {activeEra !== era.name && (
                    <span className={`absolute inset-0 bg-gradient-to-r ${era.gradient} opacity-[0.07] pointer-events-none`} />
                  )}
                  <span className="relative text-xs font-extrabold leading-tight">{era.name}</span>
                  <span className={`relative text-[10px] font-normal leading-tight mt-0.5 ${
                    activeEra === era.name ? 'text-white/80' : 'text-muted-foreground'
                  }`}>
                    {era.years}
                  </span>
                </button>
              ))}

            </div>
          </div>
        </section>
      )}

      <div className="container mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10 space-y-16">

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
                  <GradedIcon className="w-5 h-5 text-white" />
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
                      <GradedIcon className="w-8 h-8 opacity-30" />
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
        <section ref={browseGridRef} id="browse-grid" className="scroll-mt-[160px] lg:scroll-mt-[220px]">
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

                  <Select value={filterVariant || 'all'} onValueChange={v => setFilterVariant(v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-[160px] rounded-xl bg-background border-border font-medium">
                      <SelectValue placeholder="Card Variant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Variants</SelectItem>
                      {getCardVariants(slug).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={filterCondition || 'all'} onValueChange={v => setFilterCondition(v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-[150px] rounded-xl bg-background border-border font-medium">
                      <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conditions</SelectItem>
                      <SelectItem value="mint">Mint</SelectItem>
                      <SelectItem value="near_mint">Near Mint</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="light_played">Light Played</SelectItem>
                      <SelectItem value="played">Played</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
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
                    <Select value={filterSub || 'all'} onValueChange={v => setFilterSub(v === 'all' ? '' : v)}>
                      <SelectTrigger className="w-[160px] rounded-xl bg-background border-border font-medium">
                        <SelectValue placeholder="Subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subcategories</SelectItem>
                        {subOpts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {brandOpts.length > 0 && (
                    <Select value={filterBrand || 'all'} onValueChange={v => setFilterBrand(v === 'all' ? '' : v)}>
                      <SelectTrigger className="w-[150px] rounded-xl bg-background border-border font-medium">
                        <SelectValue placeholder="Brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Brands</SelectItem>
                        {brandOpts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {seriesOpts.length > 0 && (
                    <Select value={filterSeries || 'all'} onValueChange={v => setFilterSeries(v === 'all' ? '' : v)}>
                      <SelectTrigger className="w-[150px] rounded-xl bg-background border-border font-medium">
                        <SelectValue placeholder="Series" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Series</SelectItem>
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
                {listings.map((listing, i) => (
                  <motion.div
                    key={listing.id}
                    variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  >
                    <MarketplaceListingCard listing={listing} priority={i < 2} />
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
