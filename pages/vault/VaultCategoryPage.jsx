
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import ProductGrid from '@/components/ProductGrid.jsx';
import PaginationControls from '@/components/PaginationControls.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Independent Filters
  const [filterCat, setFilterCat] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterMode, setFilterMode] = useState('All');
  
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
      try {
        const perPage = 16;
        const from = (page - 1) * perPage;

        if (filterMode !== 'All') {
          // Query through listings table to filter by listing_type / accepts_offers
          let listingsQuery = supabase
            .from('listings')
            .select('vault_item_id')
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

          let query = supabase
            .from('vault_items')
            .select('*, profiles:owner_id(name)', { count: 'exact' })
            .in('id', vaultItemIds)
            .order('created_at', { ascending: false })
            .range(from, from + perPage - 1);

          if (filterCat) query = query.eq('category_id', filterCat);

          const { data, count, error } = await query;
          if (error) throw error;

          setListings(data || []);
          setTotalItems(count || 0);
          setTotalPages(Math.ceil((count || 0) / perPage));
        } else {
          let query = supabase
            .from('vault_items')
            .select('*, profiles:owner_id(name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, from + perPage - 1);

          if (filterCat) query = query.eq('category_id', filterCat);

          const { data, count, error } = await query;
          if (error) throw error;

          setListings(data || []);
          setTotalItems(count || 0);
          setTotalPages(Math.ceil((count || 0) / perPage));
        }
      } catch (error) {
        console.error("Error fetching vault listings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [filterCat, filterSub, filterBrand, filterSeries, filterMode, page]);

  const clearFilters = () => {
    setFilterCat('');
    setFilterSub('');
    setFilterBrand('');
    setFilterSeries('');
    setFilterMode('All');
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
            className={`rounded-full px-5 font-medium ${
              filterMode === mode.value
                ? mode.value === 'auction'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md border-none'
                  : mode.value === 'fixed'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md border-none'
                  : mode.value === 'offer'
                  ? 'bg-brand-blue hover:bg-brand-blue/90 text-white font-bold shadow-md border-none'
                  : mode.value === 'trade'
                  ? 'bg-[hsl(var(--vault-trade))] hover:bg-[hsl(var(--vault-trade))]/90 text-white font-bold shadow-md border-none'
                  : 'font-bold shadow-md'
                : 'bg-background'
            }`}
            onClick={() => { setFilterMode(mode.value); setPage(1); }}
          >
            {mode.label}
          </Button>
        ))}
      </div>

      {/* Category Filters */}
      <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-8 flex flex-wrap items-center gap-3">
        <Select value={filterCat} onValueChange={(v) => { setFilterCat(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>{catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        {(filterCat || filterSub || filterBrand || filterSeries || filterMode !== 'All') && (
          <Button variant="ghost" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground ml-auto">
            <X className="w-4 h-4 mr-2" /> Clear Filters
          </Button>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <ProductGrid items={listings} loading={loading} isVault={true} />
        
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
