
import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { useCart } from '@/hooks/useCart.jsx';
import ProductCard from '@/components/ProductCard.jsx';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

const BrowseListingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sort, setSort] = useState('created_at_desc');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('listings')
          .select('*, vault_item:vault_items(*, vault_images(*), categories(*)), seller:profiles!seller_id(*)')
          .or('status.eq.active,status.eq.For Sale')
          .limit(24);

        if (searchParams.get('q')) {
          const q = searchParams.get('q').replace(/'/g, '');
          // listings has a `title` column (not `name`) — searching the
          // non-existent column errored out the whole grid.
          query = query.ilike('title', `%${q}%`);
        }

        if (category && category !== 'all') {
          query = query.eq('category', category);
        }

        const sortAsc = sort === 'price_asc';
        const sortDesc = sort === 'price_desc';
        if (sortAsc) query = query.order('price_aud', { ascending: true });
        else if (sortDesc) query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        setProducts(data || []);
      } catch (error) {
        toast.error('Failed to load listings');
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [searchParams, category, sort]);

  const handleCategoryChange = (val) => {
    setCategory(val);
    const params = new URLSearchParams(searchParams);
    if (val !== 'all') params.set('category', val);
    else params.delete('category');
    setSearchParams(params);
  };

  const handleAddToCart = (product, variant) => {
    // listings store the price in `price_aud` (dollars); `product.price` was
    // always undefined, so every cart line landed at $0.00.
    const priceInCents = Math.round((Number(product.price_aud) || 0) * 100);
    const cartProduct = {
      id: product.id,
      type: 'listing',
      title: product.title || product.vault_item?.card_name || 'Trading Card',
      price: priceInCents / 100,
      image: product.images?.[0] || product.vault_item?.vault_images?.[0]?.image_url || null,
      year: product.year || product.card_year || null,
      set: product.set || product.card_set || product.era || product.collection || null,
      grading_company: product.grading_company || product.gradingCompany || null,
      grade: product.grade || null,
    };

    // A marketplace listing is a single 1-of-1 vault item — cap the quantity at 1.
    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      manage_inventory: true,
      inventory_quantity: 1,
    };

    addToCart(cartProduct, cartVariant, 1, 1);
    toast.success('Added to cart');
  };

  const handleViewDetails = (id) => {
    navigate(`/product/${id}`);
  };

  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <SEOHead title="Browse Listings | CardPop" description="Browse all trading card listings on CardPop — Pokemon, Magic, Yu-Gi-Oh, sports cards and more." />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">Browse Cards</h1>
            <p className="text-muted-foreground mt-1">Discover rare cards from the official store and community vaults.</p>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 lg:hidden border-border bg-card shadow-sm h-11 w-11"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="hidden lg:block w-64 shrink-0 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 font-bold mb-4 pb-3 border-b border-border text-foreground">
                <Filter className="w-4 h-4" /> Filters
              </div>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Category</label>
                  <Select value={category} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Pokemon">Pokemon</SelectItem>
                      <SelectItem value="Magic">Magic: The Gathering</SelectItem>
                      <SelectItem value="Yu-Gi-Oh">Yu-Gi-Oh</SelectItem>
                      <SelectItem value="Sports">Sports Cards</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Sort By</label>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at_desc">Newest First</SelectItem>
                      <SelectItem value="price_asc">Price: Low to High</SelectItem>
                      <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                    <Skeleton className="aspect-[4/5] w-full rounded-xl bg-background" />
                    <Skeleton className="h-4 w-2/3 bg-background" />
                    <Skeleton className="h-4 w-1/2 bg-background" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border border-dashed rounded-2xl shadow-sm">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2 text-foreground">No cards found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your search or filters.</p>
                <Button onClick={() => { setCategory('all'); setSearchParams({}); }}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAddToCart={handleAddToCart}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold">
              <Filter className="w-4 h-4" /> Filters
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Category</label>
              <Select value={category} onValueChange={(v) => { handleCategoryChange(v); setMobileFiltersOpen(false); }}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Pokemon">Pokemon</SelectItem>
                  <SelectItem value="Magic">Magic: The Gathering</SelectItem>
                  <SelectItem value="Yu-Gi-Oh">Yu-Gi-Oh</SelectItem>
                  <SelectItem value="Sports">Sports Cards</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Sort By</label>
              <Select value={sort} onValueChange={(v) => { setSort(v); setMobileFiltersOpen(false); }}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">Newest First</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BrowseListingsPage;
