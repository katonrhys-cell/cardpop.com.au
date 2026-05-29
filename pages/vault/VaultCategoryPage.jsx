
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import ProductGrid from '@/components/ProductGrid.jsx';
import PaginationControls from '@/components/PaginationControls.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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

        let query = supabase
          .from('vault_items')
          .select('*, profiles:owner_id(name)', { count: 'exact' })
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .range(from, from + perPage - 1);

        if (filterCat) query = query.eq('category_id', filterCat);
        if (filterSub) query = query.eq('subcategory_id', filterSub);
        if (filterBrand) query = query.eq('brand_id', filterBrand);
        if (filterSeries) query = query.eq('series_id', filterSeries);

        const { data, count, error } = await query;

        if (error) throw error;

        setListings(data || []);
        setTotalItems(count || 0);
        setTotalPages(Math.ceil((count || 0) / perPage));
      } catch (error) {
        console.error("Error fetching vault listings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [filterCat, filterSub, filterBrand, filterSeries, page]);

  const clearFilters = () => {
    setFilterCat('');
    setFilterSub('');
    setFilterBrand('');
    setFilterSeries('');
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

      {/* Independent Vault Filtering */}
      <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-8 flex flex-wrap items-center gap-3">
        <Select value={filterCat} onValueChange={(v) => { setFilterCat(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>{catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        
        <Select value={filterSub} onValueChange={(v) => { setFilterSub(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Subcategories" /></SelectTrigger>
          <SelectContent>{subOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={filterBrand} onValueChange={(v) => { setFilterBrand(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Brands" /></SelectTrigger>
          <SelectContent>{brandOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={filterSeries} onValueChange={(v) => { setFilterSeries(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Series" /></SelectTrigger>
          <SelectContent>{seriesOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        {(filterCat || filterSub || filterBrand || filterSeries) && (
          <Button variant="ghost" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground">
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
