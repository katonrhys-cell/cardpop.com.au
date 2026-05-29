
import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';

const MarketFiltersPanel = ({ filters, setFilters, onClear }) => {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const activeFilterCount = Object.values(filters).filter(val => val !== '' && val !== 'all').length;

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Fetch main categories on mount
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const { data: res } = await supabase.from('categories').select('*').order('name');
        if (isMounted) setCategories(res || []);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };
    fetchCategories();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm sticky top-28">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
          <SlidersHorizontal className="w-5 h-5" /> Filters
        </h3>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 font-bold">
            {activeFilterCount} Active
          </Badge>
        )}
      </div>
      
      {/* Listing Status */}
      <div className="mb-6">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Listing Type</label>
        <Select value={filters.status || 'all'} onValueChange={(val) => handleFilterChange('status', val)}>
          <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border focus:ring-primary">
            <SelectValue placeholder="All Listings" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border">
            <SelectItem value="all" className="rounded-lg cursor-pointer">All Listings</SelectItem>
            <SelectItem value="sale" className="rounded-lg cursor-pointer">For Sale Only</SelectItem>
            <SelectItem value="trade" className="rounded-lg cursor-pointer">For Trade Only</SelectItem>
            <SelectItem value="both" className="rounded-lg cursor-pointer">For Sale & Trade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Category */}
      <div className="mb-6">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Category</label>
        {loadingCategories ? (
          <Skeleton className="w-full h-11 rounded-xl" />
        ) : (
          <Select value={filters.category || 'all'} onValueChange={(val) => handleFilterChange('category', val)}>
            <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border focus:ring-primary">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border">
              <SelectItem value="all" className="rounded-lg cursor-pointer">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.name} className="rounded-lg cursor-pointer">
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Condition */}
      <div className="mb-6">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Condition</label>
        <Select value={filters.condition || 'all'} onValueChange={(val) => handleFilterChange('condition', val)}>
          <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border focus:ring-primary">
            <SelectValue placeholder="All Conditions" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border">
            <SelectItem value="all" className="rounded-lg cursor-pointer">All Conditions</SelectItem>
            <SelectItem value="mint" className="rounded-lg cursor-pointer">Mint</SelectItem>
            <SelectItem value="near_mint" className="rounded-lg cursor-pointer">Near Mint</SelectItem>
            <SelectItem value="excellent" className="rounded-lg cursor-pointer">Excellent</SelectItem>
            <SelectItem value="good" className="rounded-lg cursor-pointer">Good</SelectItem>
            <SelectItem value="fair" className="rounded-lg cursor-pointer">Fair</SelectItem>
            <SelectItem value="poor" className="rounded-lg cursor-pointer">Poor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Price Range */}
      <div className="mb-8">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Value Range (USD)</label>
        <div className="flex items-center gap-3">
          <Input 
            type="number" 
            placeholder="Min" 
            value={filters.minPrice || ''} 
            onChange={e => handleFilterChange('minPrice', e.target.value)} 
            className="rounded-xl h-11 bg-background border-border focus-visible:ring-primary"
          />
          <span className="text-muted-foreground font-medium">-</span>
          <Input 
            type="number" 
            placeholder="Max" 
            value={filters.maxPrice || ''} 
            onChange={e => handleFilterChange('maxPrice', e.target.value)} 
            className="rounded-xl h-11 bg-background border-border focus-visible:ring-primary"
          />
        </div>
      </div>
      
      <Button 
        variant="outline" 
        className="w-full h-11 rounded-xl font-bold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors border-border" 
        onClick={onClear}
        disabled={activeFilterCount === 0}
      >
        <X className="w-4 h-4 mr-2" />
        Clear Filters
      </Button>
    </div>
  );
};

export default MarketFiltersPanel;
