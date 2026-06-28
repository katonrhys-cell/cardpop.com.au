
import React, { useEffect, useState, useRef, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';
import useVaultItemRealtimeSync from '@/hooks/useVaultItemRealtimeSync.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, AlertCircle, Users, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import { toast } from 'sonner';

const MarketplacePage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  } = useCategories();

  const [filterCat, setFilterCat]           = useState('');
  const [filterFranchise, setFilterFranchise] = useState('');
  const [filterMfr, setFilterMfr]           = useState('');
  const [filterTeam, setFilterTeam]         = useState('');
  const [filterSet, setFilterSet]           = useState('');
  const [filterParallel, setFilterParallel] = useState('');
  const [filterSubset, setFilterSubset]     = useState('');

  const [catOpts, setCatOpts]             = useState([]);
  const [franchiseOpts, setFranchiseOpts] = useState([]);
  const [mfrOpts, setMfrOpts]             = useState([]);
  const [teamOpts, setTeamOpts]           = useState([]);
  const [setOpts, setSetOpts]             = useState([]);
  const [parallelOpts, setParallelOpts]   = useState([]);
  const [subsetOpts, setSubsetOpts]       = useState([]);

  const [catNames, setCatNames] = useState({});

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

  // Load root categories once
  useEffect(() => {
    getRootCategories().then(cats => {
      setCatOpts(cats);
      const map = {};
      cats.forEach(c => { map[c.id] = c.name; });
      setCatNames(map);
    });
  }, [getRootCategories]);

  // Cascade: category → franchises
  useEffect(() => {
    setFilterFranchise(''); setFilterMfr(''); setFilterTeam(''); setFilterSet(''); setFilterParallel(''); setFilterSubset('');
    setFranchiseOpts([]); setMfrOpts([]); setTeamOpts([]); setSetOpts([]); setParallelOpts([]); setSubsetOpts([]);
    if (filterCat) getFranchisesByCategory(filterCat).then(setFranchiseOpts);
  }, [filterCat, getFranchisesByCategory]);

  // Cascade: franchise → manufacturers + teams + sets + parallels
  useEffect(() => {
    setFilterMfr(''); setFilterTeam(''); setFilterSet(''); setFilterParallel(''); setFilterSubset('');
    setMfrOpts([]); setTeamOpts([]); setSetOpts([]); setParallelOpts([]); setSubsetOpts([]);
    if (filterFranchise) {
      getManufacturersByFranchise(filterFranchise).then(setMfrOpts);
      getTeamsByFranchise(filterFranchise).then(setTeamOpts);
      getSetsByFranchiseAndManufacturer(filterFranchise, '').then(setSetOpts);
      getParallelsByFranchise(filterFranchise).then(setParallelOpts);
    }
  }, [filterFranchise, getManufacturersByFranchise, getTeamsByFranchise, getSetsByFranchiseAndManufacturer, getParallelsByFranchise]);

  // Cascade: manufacturer → refine sets
  useEffect(() => {
    setFilterSet(''); setFilterSubset(''); setSubsetOpts([]);
    if (filterFranchise) {
      getSetsByFranchiseAndManufacturer(filterFranchise, filterMfr || '').then(setSetOpts);
    }
  }, [filterMfr, filterFranchise, getSetsByFranchiseAndManufacturer]);

  // Cascade: set → subsets
  useEffect(() => {
    setFilterSubset(''); setSubsetOpts([]);
    if (filterSet) getSubsetsBySet(filterSet).then(setSubsetOpts);
  }, [filterSet, getSubsetsBySet]);

  // Group sets by series
  const groupedSets = setOpts.reduce((acc, s) => {
    const g = s.series || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});
  const seriesGroups = Object.entries(groupedSets).sort(([a], [b]) => a.localeCompare(b));

  // Main listings fetch
  useEffect(() => {
    let cancelled = false;

    const run = async (showToast = false) => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('listings')
          .select('*, vault_item:vault_items!inner(*, vault_images(storage_path), parallel:parallels(id,name,color), subset:subsets(id,name)), seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)')
          .eq('status', 'active')
          .neq('listing_type', 'vault')
          .limit(100);

        // Apply hierarchy filters — most specific wins for the hierarchy levels,
        // but parallel and subset stack on top independently
        if (filterSet)            query = query.eq('vault_items.set_id', filterSet);
        else if (filterMfr)       query = query.eq('vault_items.manufacturer_id', filterMfr);
        else if (filterFranchise) query = query.eq('vault_items.franchise_id', filterFranchise);
        else if (filterCat)       query = query.eq('vault_items.category_id', filterCat);

        if (filterTeam)     query = query.eq('vault_items.team_id', filterTeam);
        if (filterParallel) query = query.eq('vault_items.parallel_id', filterParallel);
        if (filterSubset)   query = query.eq('vault_items.subset_id', filterSubset);

        if (debouncedSearch.trim()) query = query.ilike('vault_items.card_name', `%${debouncedSearch.trim()}%`);
        if (debouncedMin && !isNaN(debouncedMin)) query = query.gte('price_aud', Number(debouncedMin));
        if (debouncedMax && !isNaN(debouncedMax)) query = query.lte('price_aud', Number(debouncedMax));

        if (filterMode === 'Auction')   query = query.eq('listing_type', 'auction');
        else if (filterMode === 'BuyNow') query = query.eq('listing_type', 'fixed');
        else if (filterMode === 'ForTrade') query = query.eq('listing_type', 'trade');
        else if (filterMode === 'MakeOffer') query = query.eq('accepts_offers', true);

        if (filterRookie) query = query.contains('vault_items.cardVariants', ['Rookie Card (RC)']);

        if (sort === 'price_asc')  query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, error: fetchError } = await query;
        if (cancelled) return;
        if (fetchError) throw fetchError;

        setListings(data || []);
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
  }, [sort, filterMode, filterCat, filterFranchise, filterMfr, filterTeam, filterSet, filterParallel, filterSubset, debouncedSearch, debouncedMin, debouncedMax, filterRookie]);

  useVaultItemRealtimeSync(fetchRef, 'marketplace-listings');

  const clearFilters = () => {
    setFilterCat(''); setFilterFranchise(''); setFilterMfr(''); setFilterTeam(''); setFilterSet('');
    setFilterParallel(''); setFilterSubset('');
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
    const parts = [catName, frName, teamName, mfrName, setName, parallelName, subsetName].filter(Boolean);
    return parts.length ? `Filtering by: ${parts.join(' › ')}` : null;
  };

  const breadcrumbText = getBreadcrumb();
  const hasActiveFilters = filterCat || filterFranchise || filterMfr || filterTeam || filterSet || filterParallel || filterSubset || filterMode !== 'All' || filterRookie || search || minPrice || maxPrice;

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

        {/* Filter Panel */}
        <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-6 space-y-3">
          {/* Row 1: Search + Price */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search card name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min $"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className="w-24 h-10 rounded-xl bg-background border-border"
              />
              <span className="text-muted-foreground text-sm font-medium">–</span>
              <Input
                type="number"
                placeholder="Max $"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                className="w-24 h-10 rounded-xl bg-background border-border"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground ml-auto">
                <X className="w-4 h-4 mr-2" /> Clear All
              </Button>
            )}
          </div>

          {/* Row 2: 4-level cascade */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category */}
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger aria-label="Filter by category" className="w-full sm:w-[160px] bg-background border-border rounded-xl font-medium">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Franchise */}
            <Select value={filterFranchise} onValueChange={setFilterFranchise} disabled={!filterCat}>
              <SelectTrigger aria-label="Filter by franchise" className="w-full sm:w-[180px] bg-background border-border rounded-xl font-medium">
                <SelectValue placeholder={filterCat ? 'Franchise' : '— select category —'} />
              </SelectTrigger>
              <SelectContent>
                {franchiseOpts.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Manufacturer — only show if franchise has manufacturers */}
            {filterFranchise && mfrOpts.length > 0 && (
              <Select value={filterMfr} onValueChange={setFilterMfr}>
                <SelectTrigger aria-label="Filter by manufacturer" className="w-full sm:w-[200px] bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {mfrOpts.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {/* Team — only show if franchise has teams (sports) */}
            {filterFranchise && teamOpts.length > 0 && (
              <Select value={filterTeam} onValueChange={setFilterTeam}>
                <SelectTrigger aria-label="Filter by team" className="w-full sm:w-[200px] bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  {teamOpts.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {/* Set — only show if franchise selected and sets exist */}
            {filterFranchise && setOpts.length > 0 && (
              <Select value={filterSet} onValueChange={setFilterSet}>
                <SelectTrigger aria-label="Filter by set or release" className="w-full sm:w-[240px] bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Set / Release" />
                </SelectTrigger>
                <SelectContent>
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
            )}

            {/* Parallel — only show when franchise has parallels */}
            {filterFranchise && parallelOpts.length > 0 && (
              <Select value={filterParallel} onValueChange={setFilterParallel}>
                <SelectTrigger aria-label="Filter by parallel or variation" className="w-full sm:w-[200px] bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Parallel / Variation" />
                </SelectTrigger>
                <SelectContent>
                  {parallelOpts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.print_run ? ` /${p.print_run}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Subset — only show when a set is selected and it has subsets */}
            {filterSet && subsetOpts.length > 0 && (
              <Select value={filterSubset} onValueChange={setFilterSubset}>
                <SelectTrigger aria-label="Filter by subset or insert" className="w-full sm:w-[200px] bg-background border-border rounded-xl font-medium">
                  <SelectValue placeholder="Subset / Insert" />
                </SelectTrigger>
                <SelectContent>
                  {subsetOpts.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

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
            <Button
              variant="outline"
              className={`rounded-full px-5 font-bold ${filterRookie ? 'bg-amber-500 text-white shadow-md border-none hover:bg-amber-600' : 'bg-background hover:bg-amber-500 hover:text-white hover:border-amber-500'}`}
              onClick={() => setFilterRookie(r => !r)}
            >
              🏅 Rookie Cards
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map(listing => (
              <MarketplaceListingCard key={`${listing.source}-${listing.id}`} listing={listing} />
            ))}
          </div>
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
      </section>
    </div>
  );
};

export default MarketplacePage;
