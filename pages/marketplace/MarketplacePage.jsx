
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, AlertCircle, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import { toast } from 'sonner';

const MarketplacePage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sort, setSort] = useState('created_at_desc');
  const [filterType, setFilterType] = useState('All'); 
  
  // Category Filter States
  const { buildNameMap, getCategories, getSubcategoriesByCategory } = useCategories();
  const [nameMap, setNameMap] = useState({});
  const [filterCat, setFilterCat] = useState('');
  const [filterSub, setFilterSub] = useState('');

  const [catOpts, setCatOpts] = useState([]);
  const [subOpts, setSubOpts] = useState([]);

  const isMounted = useRef(true);

  // Initialize Name Map and Categories
  useEffect(() => {
    const init = async () => {
      const map = await buildNameMap();
      if(isMounted.current) setNameMap(map);
      const rootCats = await getCategories();
      if(isMounted.current) setCatOpts(rootCats);
    };
    init();
  }, [buildNameMap, getCategories]);

  // Cascading Dropdown Handlers
  useEffect(() => {
    if (filterCat) getSubcategoriesByCategory(filterCat).then(setSubOpts);
    else { setSubOpts([]); setFilterSub(''); }
  }, [filterCat, getSubcategoriesByCategory]);

  const fetchListings = useCallback(async (showToast = false) => {
    if (!isMounted.current) return;
    setLoading(true);
    setError(null);
    try {
      // Build listings query (listings table covers shop_products + vault listings)
      let query = supabase
        .from('listings')
        .select('*, vault_item:vault_items(*, vault_images(*), categories(*)), seller:profiles!seller_id(*)')
        .limit(100);

      if (filterCat) query = query.eq('vault_item.categories.id', filterCat);
      if (filterSub) query = query.eq('category_id', filterSub);

      // filterBrand and filterSeries removed (brands/series tables no longer exist)

      if (filterType === 'For Sale') {
        query = query.in('status', ['For Sale', 'active']);
      } else if (filterType === 'For Trade') {
        query = query.eq('status', 'For Trade');
      } else if (filterType === 'Both') {
        query = query.eq('status', 'For Sale & Trade');
      } else {
        query = query.in('status', ['For Sale', 'active', 'For Trade', 'For Sale & Trade']);
      }

      if (sort === 'price_asc') query = query.order('price_aud', { ascending: true });
      else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;
      if (!isMounted.current) return;
      if (fetchError) throw fetchError;

      setListings(data || []);
      if (showToast) toast.success('Marketplace data refreshed');
    } catch (err) {
      if (isMounted.current) setError(err.message || 'Failed to load marketplace listings.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [sort, filterType, filterCat, filterSub]);

  useEffect(() => {
    isMounted.current = true;
    fetchListings();
    return () => { isMounted.current = false; };
  }, [fetchListings]);

  const clearFilters = () => {
    setFilterCat('');
    setFilterSub('');
    setFilterType('All');
  };

  const getBreadcrumbPath = () => {
    const parts = [
      nameMap[filterCat],
      nameMap[filterSub]
    ].filter(Boolean);
    if (parts.length === 0) return null;
    return `Filtering by: ${parts.join(' > ')}`;
  };

  const breadcrumbText = getBreadcrumbPath();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans pb-20">
      <Helmet><title>Collector Marketplace | CardPop</title></Helmet>

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <Users className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The Marketplace</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover cards directly from other collectors' vaults alongside official CardPop listings.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 w-full flex-1">
        
        {/* Category Filter Panel */}
        <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-6 flex flex-wrap items-center gap-3">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>{catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterSub} onValueChange={setFilterSub} disabled={!filterCat}>
            <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Subcategories" /></SelectTrigger>
            <SelectContent>{subOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          {(filterCat || filterSub || filterType !== 'All') && (
            <Button variant="ghost" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground ml-auto">
              <X className="w-4 h-4 mr-2" /> Clear All Filters
            </Button>
          )}
        </div>

        {breadcrumbText && (
          <p className="text-sm font-bold text-primary mb-6 bg-primary/5 inline-block px-3 py-1 rounded-md">
            {breadcrumbText}
          </p>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant={filterType === 'All' ? 'default' : 'outline'} 
              className={`rounded-full px-5 ${filterType === 'All' ? 'font-bold shadow-md' : 'font-medium bg-background'}`}
              onClick={() => setFilterType('All')}
            >
              All Listings
            </Button>
            <Button 
              variant={filterType === 'For Sale' ? 'default' : 'outline'} 
              className={`rounded-full px-5 ${filterType === 'For Sale' ? 'bg-[hsl(var(--vault-sale))] hover:bg-[hsl(var(--vault-sale))]/90 text-white font-bold shadow-md border-none' : 'font-medium bg-background hover:text-[hsl(var(--vault-sale))] hover:border-[hsl(var(--vault-sale))]'}`}
              onClick={() => setFilterType('For Sale')}
            >
              For Sale
            </Button>
            <Button 
              variant={filterType === 'For Trade' ? 'default' : 'outline'} 
              className={`rounded-full px-5 ${filterType === 'For Trade' ? 'bg-[hsl(var(--vault-trade))] hover:bg-[hsl(var(--vault-trade))]/90 text-white font-bold shadow-md border-none' : 'font-medium bg-background hover:text-[hsl(var(--vault-trade))] hover:border-[hsl(var(--vault-trade))]'}`}
              onClick={() => setFilterType('For Trade')}
            >
              For Trade
            </Button>
            <Button 
              variant={filterType === 'Both' ? 'default' : 'outline'} 
              className={`rounded-full px-5 ${filterType === 'Both' ? 'bg-[hsl(var(--vault-both))] hover:bg-[hsl(var(--vault-both))]/90 text-black font-bold shadow-md border-none' : 'font-medium bg-background hover:text-[hsl(var(--vault-both))] hover:border-[hsl(var(--vault-both))]'}`}
              onClick={() => setFilterType('Both')}
            >
              Sale & Trade
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => fetchListings(true)} disabled={loading} className="rounded-full h-10 w-10 shrink-0 bg-muted/50 hover:bg-muted">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px] h-10 rounded-xl bg-background border-border font-medium">
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
            <p className="mb-6 opacity-80">{error}</p>
            <Button onClick={() => fetchListings(true)} className="rounded-xl font-bold">Try Again</Button>
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
