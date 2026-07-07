
import React, { useEffect, useState, useRef, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, AlertCircle, Users, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import RookieJerseyIcon from '@/components/icons/RookieJerseyIcon.jsx';
import { toast } from 'sonner';

// Sentinel for the "Any …" option in each dropdown — Radix Select can't use ''
const ANY = '__any__';

// Headline players offered as a quick filter. `term` is matched against the
// card name (ilike), so keep it to the distinctive part of the name where
// spelling/diacritics vary across sets.
const POPULAR_PLAYERS = [
  { label: 'LeBron James',          term: 'LeBron James' },
  { label: 'Stephen Curry',         term: 'Stephen Curry' },
  { label: 'Victor Wembanyama',     term: 'Wembanyama' },
  { label: 'Michael Jordan',        term: 'Michael Jordan' },
  { label: 'Kobe Bryant',           term: 'Kobe Bryant' },
  { label: 'Giannis Antetokounmpo', term: 'Giannis' },
  { label: 'Luka Dončić',           term: 'Luka Don' },
  { label: 'Kevin Durant',          term: 'Kevin Durant' },
  { label: 'Jayson Tatum',          term: 'Jayson Tatum' },
  { label: 'Anthony Edwards',       term: 'Anthony Edwards' },
];

// Renders select items split into labelled groups
const GroupedSelectItems = ({ groups, getItemLabel }) => (
  groups.map(([label, items], gi) => (
    <SelectGroup key={label}>
      {gi > 0 && <SelectSeparator />}
      <SelectLabel>{label}</SelectLabel>
      {items.map(item => (
        <SelectItem key={item.id} value={item.id}>
          {getItemLabel ? getItemLabel(item) : item.name}
        </SelectItem>
      ))}
    </SelectGroup>
  ))
);

const MarketplacePage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 24;

  const [sort, setSort] = useState('created_at_desc');
  const [filterMode, setFilterMode] = useState('All');
  const [filterRookie, setFilterRookie] = useState(false);

  // 6-level hierarchy filters
  const {
    getRootCategories,
    getFranchisesByCategory,
    getManufacturersByFranchise,
    getTeamsByFranchise,
    getSetsByFranchiseAndManufacturer,
    getParallelsByFranchise,
    getSubsetsBySet,
    getAllFranchises,
    getAllManufacturers,
    getAllTeams,
    getAllSets,
    getAllParallels,
    getAllSubsets,
    buildNameMap,
  } = useCategories();

  const [filterCat, setFilterCat]           = useState('');
  const [filterFranchise, setFilterFranchise] = useState('');
  const [filterMfr, setFilterMfr]           = useState('');
  const [filterTeam, setFilterTeam]         = useState('');
  const [filterSet, setFilterSet]           = useState('');
  const [filterParallel, setFilterParallel] = useState('');
  const [filterSubset, setFilterSubset]     = useState('');
  const [filterPlayer, setFilterPlayer]     = useState('');

  const [catOpts, setCatOpts]             = useState([]);
  const [franchiseOpts, setFranchiseOpts] = useState([]);
  const [mfrOpts, setMfrOpts]             = useState([]);
  const [teamOpts, setTeamOpts]           = useState([]);
  const [setOpts, setSetOpts]             = useState([]);
  const [parallelOpts, setParallelOpts]   = useState([]);
  const [subsetOpts, setSubsetOpts]       = useState([]);

  const [catNames, setCatNames] = useState({});
  // id → name for every category (roots + franchises) — used to label the
  // groups when a dropdown shows its full unscoped list
  const [allNames, setAllNames] = useState({});

  // Search and price
  const [search, setSearch]     = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedMin, setDebouncedMin]       = useState('');
  const [debouncedMax, setDebouncedMax]       = useState('');

  const fetchRef = useRef(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedMin(minPrice); setDebouncedMax(maxPrice); }, 400);
    return () => clearTimeout(t);
  }, [minPrice, maxPrice]);

  // Load root categories + full category name map once
  useEffect(() => {
    getRootCategories().then(cats => {
      setCatOpts(cats);
      const map = {};
      cats.forEach(c => { map[c.id] = c.name; });
      setCatNames(map);
    });
    buildNameMap().then(setAllNames);
  }, [getRootCategories, buildNameMap]);

  // Franchise options: scoped to the selected category, otherwise all franchises.
  // Every level stays selectable even when its parent hasn't been chosen.
  useEffect(() => {
    setFilterFranchise('');
    (filterCat ? getFranchisesByCategory(filterCat) : getAllFranchises()).then(setFranchiseOpts);
  }, [filterCat, getFranchisesByCategory, getAllFranchises]);

  // Manufacturer / team / parallel options: scoped to franchise, otherwise all
  useEffect(() => {
    setFilterMfr(''); setFilterTeam(''); setFilterParallel('');
    if (filterFranchise) {
      getManufacturersByFranchise(filterFranchise).then(setMfrOpts);
      getTeamsByFranchise(filterFranchise).then(setTeamOpts);
      getParallelsByFranchise(filterFranchise).then(setParallelOpts);
    } else {
      getAllManufacturers().then(setMfrOpts);
      getAllTeams().then(setTeamOpts);
      getAllParallels().then(setParallelOpts);
    }
  }, [filterFranchise, getManufacturersByFranchise, getTeamsByFranchise, getParallelsByFranchise, getAllManufacturers, getAllTeams, getAllParallels]);

  // Set options: scoped to franchise (and refined by manufacturer), otherwise all
  useEffect(() => {
    setFilterSet('');
    (filterFranchise
      ? getSetsByFranchiseAndManufacturer(filterFranchise, filterMfr || '')
      : getAllSets(filterMfr || '')
    ).then(setSetOpts);
  }, [filterMfr, filterFranchise, getSetsByFranchiseAndManufacturer, getAllSets]);

  // Subset options: scoped to the selected set, otherwise all
  useEffect(() => {
    setFilterSubset('');
    (filterSet ? getSubsetsBySet(filterSet) : getAllSubsets()).then(setSubsetOpts);
  }, [filterSet, getSubsetsBySet, getAllSubsets]);

  // Group sets by series when scoped to a franchise; by franchise when unscoped
  const groupedSets = setOpts.reduce((acc, s) => {
    const g = (filterFranchise ? s.series : allNames[s.category_id]) || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});
  const seriesGroups = Object.entries(groupedSets).sort(([a], [b]) => a.localeCompare(b));

  // Group an unscoped option list by its franchise name for readability
  const groupByFranchise = (opts) => {
    const acc = {};
    opts.forEach(o => {
      const g = allNames[o.franchise_id] || 'Other';
      if (!acc[g]) acc[g] = [];
      acc[g].push(o);
    });
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
  };

  // Map the "Any …" sentinel back to an empty filter value
  const clearable = (setter) => (v) => setter(v === ANY ? '' : v);

  // Main listings fetch
  useEffect(() => {
    let cancelled = false;

    const run = async (showToast = false) => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('listings')
          .select('*, vault_item:vault_items!inner(*, vault_images(storage_path)), seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)', { count: 'exact' })
          // Show sold items too (badged "Sold") — they stay on the marketplace
          // until an admin archives them. Only 'archived' is hidden here.
          .in('status', ['active', 'sold'])
          .neq('listing_type', 'vault')
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        // Apply hierarchy filters — most specific wins for the hierarchy levels,
        // but parallel and subset stack on top independently
        if (filterSet)            query = query.eq('vault_items.set_id', filterSet);
        else if (filterMfr)       query = query.eq('vault_items.manufacturer_id', filterMfr);
        else if (filterFranchise) query = query.eq('vault_items.franchise_id', filterFranchise);
        else if (filterCat)       query = query.eq('vault_items.category_id', filterCat);

        if (filterTeam)     query = query.eq('vault_items.team_id', filterTeam);
        if (filterParallel) query = query.eq('vault_items.parallel_id', filterParallel);
        if (filterSubset)   query = query.eq('vault_items.subset_id', filterSubset);

        if (filterPlayer) query = query.ilike('vault_items.card_name', `%${filterPlayer}%`);
        if (debouncedSearch.trim()) query = query.ilike('vault_items.card_name', `%${debouncedSearch.trim()}%`);
        if (debouncedMin && !isNaN(debouncedMin)) query = query.gte('price_aud', Number(debouncedMin));
        if (debouncedMax && !isNaN(debouncedMax)) query = query.lte('price_aud', Number(debouncedMax));

        if (filterMode === 'Auction')   query = query.eq('listing_type', 'auction');
        else if (filterMode === 'BuyNow') query = query.eq('listing_type', 'fixed');
        else if (filterMode === 'ForTrade') query = query.eq('accepts_trade', true);
        else if (filterMode === 'MakeOffer') query = query.eq('accepts_offers', true);

        // is_rookie is set by the add-card form (attribute tick or RC variant)
        if (filterRookie) query = query.eq('vault_items.is_rookie', true);

        if (sort === 'price_asc')  query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, count, error: fetchError } = await query;
        if (cancelled) return;
        if (fetchError) throw fetchError;

        setListings(data || []);
        setTotalCount(count || 0);
        if (showToast) toast.success('Marketplace data refreshed');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load marketplace listings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [page, sort, filterMode, filterCat, filterFranchise, filterMfr, filterTeam, filterSet, filterParallel, filterSubset, filterPlayer, debouncedSearch, debouncedMin, debouncedMax, filterRookie]);

  // Reset to the first page whenever the filters/sort change so the user never
  // lands on an out-of-range page (the stale-fetch is cancelled by the guard).
  useEffect(() => {
    setPage(0);
  }, [sort, filterMode, filterCat, filterFranchise, filterMfr, filterTeam, filterSet, filterParallel, filterSubset, filterPlayer, debouncedSearch, debouncedMin, debouncedMax, filterRookie]);

  // Realtime subscription to vault_items changes to refresh listings
  useEffect(() => {
    const channel = supabase
      .channel('marketplace-vault-items')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vault_items' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const clearFilters = () => {
    setFilterCat(''); setFilterFranchise(''); setFilterMfr(''); setFilterTeam(''); setFilterSet('');
    setFilterParallel(''); setFilterSubset(''); setFilterPlayer('');
    setFilterMode('All'); setFilterRookie(false);
    setSearch(''); setMinPrice(''); setMaxPrice('');
  };

  const getBreadcrumb = () => {
    const setName      = setOpts.find(s => s.id === filterSet)?.name;
    const mfrName      = mfrOpts.find(m => m.id === filterMfr)?.name;
    const teamName     = teamOpts.find(t => t.id === filterTeam)?.name;
    const frName       = franchiseOpts.find(f => f.id === filterFranchise)?.name;
    const catName      = catNames[filterCat];
    const parallelName = parallelOpts.find(p => p.id === filterParallel)?.name;
    const subsetName   = subsetOpts.find(s => s.id === filterSubset)?.name;
    const playerName   = POPULAR_PLAYERS.find(p => p.term === filterPlayer)?.label;
    const parts = [catName, frName, teamName, mfrName, setName, parallelName, subsetName, playerName].filter(Boolean);
    return parts.length ? `Filtering by: ${parts.join(' › ')}` : null;
  };

  const breadcrumbText = getBreadcrumb();
  const hasActiveFilters = filterCat || filterFranchise || filterMfr || filterTeam || filterSet || filterParallel || filterSubset || filterPlayer || filterMode !== 'All' || filterRookie || search || minPrice || maxPrice;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans pb-20">
      <SEOHead
        title="Buy & Sell Trading Cards Online Australia | CardPop Marketplace"
        description="Browse thousands of Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports cards listed by Australian sellers. Filter by game, grade, price and more. Free to list — buy and sell trading cards online in Australia."
        canonicalUrl="https://cardpop.com.au/marketplace"
      />

      <section className="bg-card border-b border-border py-12 md:py-20 text-center">
        <div className="container-default">
          <Users className="w-10 h-10 md:w-12 md:h-12 text-primary mx-auto mb-4 md:mb-6" />
          <h1 className="text-3xl md:text-5xl font-bold mb-4">The Marketplace</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover cards directly from other collectors' vaults alongside official CardPop listings.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 w-full flex-1">

        <div className="flex flex-col lg:flex-row gap-8">

        {/* Left sidebar: Search + category filters */}
        <aside className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-muted/30 border border-border p-4 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Search &amp; Filter</h2>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground h-8 px-2">
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                name="marketplace-search"
                aria-label="Search card name"
                placeholder="Search card name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border"
              />
            </div>

            {/* Price range */}
            <div>
              <label htmlFor="marketplace-min-price" className="block text-xs font-semibold text-muted-foreground mb-1.5">Price range</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="marketplace-min-price"
                  name="marketplace-min-price"
                  aria-label="Minimum price"
                  placeholder="Min $"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  className="flex-1 h-10 rounded-xl bg-background border-border"
                />
                <span className="text-muted-foreground text-sm font-medium">–</span>
                <Input
                  type="number"
                  name="marketplace-max-price"
                  aria-label="Maximum price"
                  placeholder="Max $"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  className="flex-1 h-10 rounded-xl bg-background border-border"
                />
              </div>
            </div>

            {/* Popular players */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Popular players</label>
              <Select value={filterPlayer} onValueChange={clearable(setFilterPlayer)}>
                <SelectTrigger aria-label="Filter by player" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Player" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any player</SelectItem>
                  {POPULAR_PLAYERS.map(p => (
                    <SelectItem key={p.term} value={p.term}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category cascade — every level is always open and selectable;
                picking a parent just narrows the options below it */}
            <div className="space-y-3 pt-1">
              <label htmlFor="marketplace-category" className="block text-xs font-semibold text-muted-foreground">Browse by category</label>
              {/* Category */}
              <Select value={filterCat} onValueChange={clearable(setFilterCat)}>
                <SelectTrigger id="marketplace-category" aria-label="Filter by category" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any category</SelectItem>
                  {catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Franchise */}
              <Select value={filterFranchise} onValueChange={clearable(setFilterFranchise)}>
                <SelectTrigger aria-label="Filter by franchise" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Franchise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any franchise</SelectItem>
                  {filterCat
                    ? franchiseOpts.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)
                    : <GroupedSelectItems groups={(() => {
                        const acc = {};
                        franchiseOpts.forEach(f => {
                          const g = catNames[f.parent_id] || 'Other';
                          if (!acc[g]) acc[g] = [];
                          acc[g].push(f);
                        });
                        return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
                      })()} />}
                </SelectContent>
              </Select>

              {/* Manufacturer */}
              <Select value={filterMfr} onValueChange={clearable(setFilterMfr)}>
                <SelectTrigger aria-label="Filter by manufacturer" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any manufacturer</SelectItem>
                  {filterFranchise
                    ? mfrOpts.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)
                    : <GroupedSelectItems groups={groupByFranchise(mfrOpts)} />}
                </SelectContent>
              </Select>

              {/* Team */}
              <Select value={filterTeam} onValueChange={clearable(setFilterTeam)}>
                <SelectTrigger aria-label="Filter by team" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any team</SelectItem>
                  {filterFranchise
                    ? teamOpts.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                    : <GroupedSelectItems groups={groupByFranchise(teamOpts)} />}
                </SelectContent>
              </Select>

              {/* Set / Release */}
              <Select value={filterSet} onValueChange={clearable(setFilterSet)}>
                <SelectTrigger aria-label="Filter by set or release" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Set / Release" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any set</SelectItem>
                  {seriesGroups.map(([series, items], gi) => (
                    <SelectGroup key={series}>
                      {gi > 0 && <SelectSeparator />}
                      <SelectLabel>{series}</SelectLabel>
                      {items.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

              {/* Parallel / Variation */}
              <Select value={filterParallel} onValueChange={clearable(setFilterParallel)}>
                <SelectTrigger aria-label="Filter by parallel or variation" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Parallel / Variation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any parallel</SelectItem>
                  {filterFranchise
                    ? parallelOpts.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.print_run ? ` /${p.print_run}` : ''}
                        </SelectItem>
                      ))
                    : <GroupedSelectItems
                        groups={groupByFranchise(parallelOpts)}
                        getItemLabel={p => `${p.name}${p.print_run ? ` /${p.print_run}` : ''}`}
                      />}
                </SelectContent>
              </Select>

              {/* Subset / Insert */}
              <Select value={filterSubset} onValueChange={clearable(setFilterSubset)}>
                <SelectTrigger aria-label="Filter by subset or insert" className="w-full bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Subset / Insert" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any subset</SelectItem>
                  {filterSet
                    ? subsetOpts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                    : <GroupedSelectItems groups={(() => {
                        const acc = {};
                        subsetOpts.forEach(s => {
                          const g = s.set?.name || 'Other';
                          if (!acc[g]) acc[g] = [];
                          acc[g].push(s);
                        });
                        return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
                      })()} />}
                </SelectContent>
              </Select>
            </div>

            {/* Card attributes */}
            <div className="pt-1">
              <span className="block text-xs font-semibold text-muted-foreground mb-2">Card attributes</span>
              <label
                htmlFor="marketplace-rookie"
                className="flex items-center gap-2.5 cursor-pointer rounded-xl border border-border bg-background px-3 py-2.5 font-medium text-sm hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id="marketplace-rookie"
                  checked={filterRookie}
                  onCheckedChange={v => setFilterRookie(v === true)}
                />
                <RookieJerseyIcon className="w-4 h-4 shrink-0" /> Rookie Card
              </label>
            </div>
          </div>
        </aside>

        {/* Main content: listing type toggles + sort + grid */}
        <div className="flex-1 min-w-0">

        {breadcrumbText && (
          <p className="text-sm font-bold text-primary mb-6 bg-primary/5 inline-block px-3 py-1 rounded-md">
            {breadcrumbText}
          </p>
        )}

        {/* Listing type + sort row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filterMode === 'All' ? 'default' : 'outline'}
              className={`rounded-full px-5 font-bold ${filterMode === 'All' ? 'text-white shadow-md' : 'font-medium bg-background hover:bg-primary hover:text-white'}`}
              onClick={() => setFilterMode('All')}
            >
              All Listings
            </Button>
            <Button
              variant="outline"
              className={`rounded-full px-5 font-bold ${filterMode === 'Auction' ? 'bg-brand-charcoal hover:bg-brand-charcoal/90 text-white shadow-md border-none' : 'bg-background hover:bg-brand-charcoal hover:text-white hover:border-brand-charcoal'}`}
              onClick={() => setFilterMode('Auction')}
            >
              Auction
            </Button>
            <Button
              variant="outline"
              className={`rounded-full px-5 font-bold ${filterMode === 'BuyNow' ? 'bg-[hsl(var(--vault-sale))] hover:bg-[hsl(var(--vault-sale))]/90 text-white shadow-md border-none' : 'bg-background hover:bg-[hsl(var(--vault-sale))] hover:text-white hover:border-[hsl(var(--vault-sale))]'}`}
              onClick={() => setFilterMode('BuyNow')}
            >
              Buy Now
            </Button>
            <Button
              variant="outline"
              className={`rounded-full px-5 font-bold ${filterMode === 'MakeOffer' ? 'bg-amber-700 hover:bg-amber-800 text-white shadow-md border-none' : 'bg-background hover:bg-amber-700 hover:text-white hover:border-amber-700'}`}
              onClick={() => setFilterMode('MakeOffer')}
            >
              Make an Offer
            </Button>
            <Button
              variant="outline"
              className={`rounded-full px-5 font-bold ${filterMode === 'ForTrade' ? 'bg-[hsl(var(--vault-trade))] hover:bg-[hsl(var(--vault-trade))]/90 text-white shadow-md border-none' : 'bg-background hover:bg-[hsl(var(--vault-trade))] hover:text-white hover:border-[hsl(var(--vault-trade))]'}`}
              onClick={() => setFilterMode('ForTrade')}
            >
              For Trade
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Refresh listings" onClick={() => fetchRef.current?.(true)} disabled={loading} className="rounded-full h-10 w-10 shrink-0 bg-muted/50 hover:bg-muted">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort listings" className="w-[180px] h-10 rounded-xl bg-background border-border font-medium">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="created_at_desc">Newest Listings</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-3xl border border-destructive/20 text-destructive">
            <AlertCircle className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">Connection Error</h3>
            <p className="mb-6">{error}</p>
            <Button onClick={() => fetchRef.current?.(true)} className="rounded-xl font-bold">Try Again</Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col space-y-4 bg-card border border-border rounded-2xl p-4">
                <Skeleton className="aspect-[4/5] w-full rounded-xl" />
                <Skeleton className="h-5 w-1/3 rounded-md" />
                <Skeleton className="h-6 w-3/4 rounded-md" />
                <Skeleton className="h-10 w-full rounded-xl mt-auto" />
              </div>
            ))}
          </div>
        ) : listings.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map(listing => (
                <MarketplaceListingCard key={`${listing.source}-${listing.id}`} listing={listing} />
              ))}
            </div>
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <Button
                  variant="outline"
                  className="rounded-xl font-bold"
                  disabled={page === 0}
                  onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)}
                </span>
                <Button
                  variant="outline"
                  className="rounded-xl font-bold"
                  disabled={(page + 1) * PAGE_SIZE >= totalCount}
                  onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border shadow-sm">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <p className="text-foreground text-2xl font-bold mb-3 tracking-tight">No items available</p>
            <p className="text-muted-foreground max-w-sm text-center mb-8">
              There are currently no items matching your filter criteria.
            </p>
            <div className="flex flex-col items-center gap-4 mb-8">
              <p className="text-sm font-medium text-muted-foreground">Try these suggestions:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-full">
                  Clear All Filters
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearch('Charizard')} className="rounded-full">
                  Charizard
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearch('Pikachu')} className="rounded-full">
                  Pikachu
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearch('Black Lotus')} className="rounded-full">
                  Black Lotus
                </Button>
              </div>
            </div>
            <Button onClick={clearFilters} variant="outline" className="rounded-xl font-bold">
              View All Listings
            </Button>
          </div>
        )}
        </div>{/* end main content */}
        </div>{/* end two-column layout */}
      </section>
    </div>
  );
};

export default MarketplacePage;
