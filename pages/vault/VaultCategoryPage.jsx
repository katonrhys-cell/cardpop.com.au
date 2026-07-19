
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import ProductGrid from '@/components/ProductGrid.jsx';
import PaginationControls from '@/components/PaginationControls.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import RookieJerseyIcon from '@/components/icons/RookieJerseyIcon.jsx';
import { X } from 'lucide-react';

const LISTING_MODES = [
  { value: 'All', label: 'All Listings' },
  { value: 'auction', label: 'Auction' },
  { value: 'fixed', label: 'Buy Now' },
  { value: 'offer', label: 'Make an Offer' },
  { value: 'trade', label: 'For Trade' },
];

const VaultCategoryPage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Independent Filters
  const [filterCat, setFilterCat] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterMode, setFilterMode] = useState('All');
  const [filterRookie, setFilterRookie] = useState(false);
  
  // Filter Options Data
  const [catOpts, setCatOpts] = useState([]);
  const [subOpts, setSubOpts] = useState([]);
  const [brandOpts, setBrandOpts] = useState([]);
  const [seriesOpts, setSeriesOpts] = useState([]);

  // categories, subcategories, brands, series no longer exist — use empty arrays
  useEffect(() => {
    setCatOpts([]);
    setSubOpts([]);
    setBrandOpts([]);
    setSeriesOpts([]);
  }, []);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setError(null);
      try {
        const perPage = 16;
        const from = (page - 1) * perPage;

        if (filterMode !== 'All') {
          // Query through listings table to filter by listing_type / accepts_offers
          let listingsQuery = supabase
            .from('listings')
            .select('vault_item_id, id, price_aud')
            .eq('status', 'active');

          if (filterMode === 'offer') {
            listingsQuery = listingsQuery.eq('accepts_offers', true);
          } else {
            listingsQuery = listingsQuery.eq('listing_type', filterMode);
          }

          const { data: listingRows, error: listingErr } = await listingsQuery;
          if (listingErr) throw listingErr;

          const vaultItemIds = (listingRows || []).map(r => r.vault_item_id).filter(Boolean);

          if (vaultItemIds.length === 0) {
            setListings([]);
            setTotalItems(0);
            setTotalPages(1);
            setLoading(false);
            return;
          }

          // Create a map of vault_item_id -> listing for quick lookup
          const listingMap = {};
          (listingRows || []).forEach(r => {
            listingMap[r.vault_item_id] = { id: r.id, price_aud: r.price_aud };
          });

          let query = supabase
            .from('vault_items')
            .select('*', { count: 'exact' })
            .in('id', vaultItemIds)
            .eq('is_public', true)
            .neq('listing_type', 'Private')
            .order('created_at', { ascending: false })
            .range(from, from + perPage - 1);

          if (filterCat) query = query.eq('category_id', filterCat);
          if (filterRookie) query = query.eq('is_rookie', true);

          const { data, count, error } = await query;
          if (error) throw error;

          // Attach listing data to vault items
          const itemsWithListings = (data || []).map(item => ({
            ...item,
            listing: listingMap[item.id]
          }));

          setListings(itemsWithListings);
          setTotalItems(count || 0);
          setTotalPages(Math.ceil((count || 0) / perPage));
        } else {
          // Fetch all listings to get vault_item mappings
          const { data: allListings, error: allListingsErr } = await supabase
            .from('listings')
            .select('vault_item_id, id, price_aud')
            .eq('status', 'active');
          if (allListingsErr) throw allListingsErr;

          const listingMap = {};
          (allListings || []).forEach(r => {
            listingMap[r.vault_item_id] = { id: r.id, price_aud: r.price_aud };
          });

          let query = supabase
            .from('vault_items')
            .select('*', { count: 'exact' })
            .eq('is_public', true)
            .neq('listing_type', 'Private')
            .order('created_at', { ascending: false })
            .range(from, from + perPage - 1);

          if (filterCat) query = query.eq('category_id', filterCat);
          if (filterRookie) query = query.eq('is_rookie', true);

          const { data, count, error } = await query;
          if (error) throw error;

          // Attach listing data to vault items
          const itemsWithListings = (data || []).map(item => ({
            ...item,
            listing: listingMap[item.id]
          }));

          setListings(itemsWithListings);
          setTotalItems(count || 0);
          setTotalPages(Math.ceil((count || 0) / perPage));
        }
      } catch (err) {
        console.error('Failed to load vault listings:', err);
        setError('Unable to load vault listings right now. Please try again shortly.');
        setListings([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [filterCat, filterSub, filterBrand, filterSeries, filterMode, filterRookie, page]);

  const clearFilters = () => {
    setFilterCat('');
    setFilterSub('');
    setFilterBrand('');
    setFilterSeries('');
    setFilterMode('All');
    setFilterRookie(false);
    setPage(1);
  };

  return (
    <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEOHead 
        title="Public Vault Listings | CardPop" 
        description="Browse public vault listings from collectors around the world." 
        canonicalUrl={typeof window !== 'undefined' ? window.location.href : ''} 
      />
      
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-serif text-foreground mb-2">
          Public Vault Listings
        </h1>
        <p className="text-muted-foreground text-lg">
          {totalItems} items available
        </p>
      </div>

      {/* Listing Type Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {LISTING_MODES.map(mode => (
          <Button
            key={mode.value}
            variant={filterMode === mode.value ? 'default' : 'outline'}
            className={`rounded-full px-5 font-bold ${
              filterMode === mode.value
                ? mode.value === 'auction'
                  ? 'bg-brand-charcoal hover:bg-brand-charcoal/90 text-white shadow-md border-none'
                  : mode.value === 'fixed'
                  ? 'bg-[hsl(var(--vault-sale))] hover:bg-[hsl(var(--vault-sale))]/90 text-white shadow-md border-none'
                  : mode.value === 'offer'
                  ? 'bg-amber-700 hover:bg-amber-800 text-white shadow-md border-none'
                  : mode.value === 'trade'
                  ? 'bg-[hsl(var(--vault-trade))] hover:bg-[hsl(var(--vault-trade))]/90 text-white shadow-md border-none'
                  : 'text-white shadow-md'
                : 'bg-background'
            }`}
            onClick={() => { setFilterMode(mode.value); setPage(1); }}
          >
            {mode.label}
          </Button>
        ))}
        <Button
          variant="outline"
          className={`rounded-full px-5 font-bold ${filterRookie ? 'bg-amber-400 text-amber-900 shadow-md border-none hover:bg-amber-400' : 'bg-background hover:text-amber-700 hover:border-amber-400'}`}
          onClick={() => { setFilterRookie(r => !r); setPage(1); }}
        >
          <RookieJerseyIcon className="w-4 h-4 mr-1.5" /> Rookie Cards
        </Button>
      </div>

      {/* Category Filters */}
      <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-8 flex flex-wrap items-center gap-3">
        <Select value={filterCat} onValueChange={(v) => { setFilterCat(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>{catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        {(filterCat || filterSub || filterBrand || filterSeries || filterMode !== 'All' || filterRookie) && (
          <Button variant="ghost" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground ml-auto">
            <X className="w-4 h-4 mr-2" /> Clear Filters
          </Button>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        {error ? (
          <div className="bg-card border border-destructive/20 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-1">Failed to load listings</h3>
            <p className="text-muted-foreground max-w-md">{error}</p>
          </div>
        ) : (
          <ProductGrid items={listings} loading={loading} isVault={true} />
        )}

        <PaginationControls
          currentPage={page} 
          totalPages={totalPages} 
          onPageChange={setPage} 
        />
      </div>
    </div>
  );
};

export default VaultCategoryPage;
