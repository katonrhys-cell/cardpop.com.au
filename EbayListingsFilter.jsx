
import React from 'react';
import { SlidersHorizontal, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const EbayListingsFilter = ({ filters, setFilters, onClear }) => {
  const activeFilterCount = Object.values(filters).filter(val => val !== '' && val !== 'all' && val !== 'newlyListed').length;

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

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
      
      {/* Category */}
      <div className="mb-6">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Category</label>
        <Select value={filters.category} onValueChange={(val) => handleFilterChange('category', val)}>
          <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border focus:ring-primary">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border">
            <SelectItem value="all" className="rounded-lg cursor-pointer">All Categories</SelectItem>
            <SelectItem value="Trading Cards" className="rounded-lg cursor-pointer">Trading Cards (All)</SelectItem>
            <SelectItem value="Pokemon" className="rounded-lg cursor-pointer">Pokémon TCG</SelectItem>
            <SelectItem value="Magic" className="rounded-lg cursor-pointer">Magic: The Gathering</SelectItem>
            <SelectItem value="Yu-Gi-Oh" className="rounded-lg cursor-pointer">Yu-Gi-Oh!</SelectItem>
            <SelectItem value="Sports Cards" className="rounded-lg cursor-pointer">Sports Cards</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Condition */}
      <div className="mb-6">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Condition</label>
        <Select value={filters.condition} onValueChange={(val) => handleFilterChange('condition', val)}>
          <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border focus:ring-primary">
            <SelectValue placeholder="All Conditions" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border">
            <SelectItem value="all" className="rounded-lg cursor-pointer">All Conditions</SelectItem>
            <SelectItem value="New" className="rounded-lg cursor-pointer">New / Mint</SelectItem>
            <SelectItem value="Like New" className="rounded-lg cursor-pointer">Like New / Near Mint</SelectItem>
            <SelectItem value="Good" className="rounded-lg cursor-pointer">Good / Excellent</SelectItem>
            <SelectItem value="Fair" className="rounded-lg cursor-pointer">Fair</SelectItem>
            <SelectItem value="Used" className="rounded-lg cursor-pointer">Used / Played</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Price Range */}
      <div className="mb-6">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Price Range (USD)</label>
        <div className="flex items-center gap-3">
          <Input 
            type="number" 
            placeholder="Min" 
            value={filters.minPrice} 
            onChange={e => handleFilterChange('minPrice', e.target.value)} 
            className="rounded-xl h-11 bg-background border-border focus-visible:ring-primary"
          />
          <span className="text-muted-foreground font-medium">-</span>
          <Input 
            type="number" 
            placeholder="Max" 
            value={filters.maxPrice} 
            onChange={e => handleFilterChange('maxPrice', e.target.value)} 
            className="rounded-xl h-11 bg-background border-border focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Seller Rating */}
      <div className="mb-8">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Min Seller Rating</label>
        <Select value={filters.minRating} onValueChange={(val) => handleFilterChange('minRating', val)}>
          <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border focus:ring-primary">
            <SelectValue placeholder="Any Rating" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border">
            <SelectItem value="all" className="rounded-lg cursor-pointer">Any Rating</SelectItem>
            <SelectItem value="90" className="rounded-lg cursor-pointer flex items-center">
              90%+ Positive
            </SelectItem>
            <SelectItem value="95" className="rounded-lg cursor-pointer flex items-center">
              95%+ Positive
            </SelectItem>
            <SelectItem value="99" className="rounded-lg cursor-pointer flex items-center">
              99%+ Positive
            </SelectItem>
          </SelectContent>
        </Select>
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

export default EbayListingsFilter;
