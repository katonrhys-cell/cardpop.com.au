
import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal, PackageX, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';
import ProductCard from '@/components/ProductCard.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ShopSinglesPage = () => {
  const { addToCart } = useCart();
  
  const [products, setProducts] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filters and Sort State
  const [sort, setSort] = useState('created_at_desc');
  const [condition, setCondition] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    let isMounted = true;
    
    const fetchProducts = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('shop_products')
          .select('*', { count: 'exact' })
          .eq('status', 'active')
          .eq('product_type', 'single')
          .limit(48);

        if (minPrice && !isNaN(minPrice)) {
          query = query.gte('price_aud', Number(minPrice));
        }
        if (maxPrice && !isNaN(maxPrice)) {
          query = query.lte('price_aud', Number(maxPrice));
        }

        if (sort === 'price_asc') query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, count, error } = await query;
        if (error) throw error;

        if (isMounted) {
          setProducts((data || []).map(p => ({ ...p, source: 'shop', type: 'shop' })));
          setTotalItems(count || 0);
        }
      } catch (err) {
        console.error('Failed to fetch singles:', err);
        if (isMounted) toast.error('Failed to load products.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchProducts();
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sort, condition, minPrice, maxPrice]);

  const handleAddToCart = (product, variant) => {
    addToCart(product, variant, 1, product.stockQuantity || 1);
    toast.success(`${product.name || 'Item'} added to cart`);
  };

  const handleClearFilters = () => {
    setCondition('all');
    setMinPrice('');
    setMaxPrice('');
    setSort('-created');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Singles | CardPop Shop" description="Shop individual trading card singles from the CardPop official store. Find the exact card you need." />

      {/* Header Section */}
      <section className="bg-amber-900/5 dark:bg-amber-900/10 border-b border-amber-900/10 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" asChild className="mb-6 pl-0 hover:bg-transparent hover:text-amber-600 text-foreground/80">
            <Link to="/shop"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Shop</Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl hidden sm:block">
              <Layers className="w-10 h-10 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-bold font-serif text-foreground mb-2">Premium Singles</h1>
              <p className="text-muted-foreground text-lg">Rare, graded, and highly sought-after individual cards.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm sticky top-28">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-foreground">
              <SlidersHorizontal className="w-5 h-5" /> Filters
            </h3>
            
            {/* Price Range */}
            <div className="mb-8">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Price Range</label>
              <div className="flex items-center gap-3">
                <Input 
                  type="number" 
                  placeholder="Min" 
                  value={minPrice} 
                  onChange={e => setMinPrice(e.target.value)} 
                  className="rounded-xl h-12 bg-background border-border focus-visible:ring-amber-500"
                />
                <span className="text-muted-foreground font-medium">-</span>
                <Input 
                  type="number" 
                  placeholder="Max" 
                  value={maxPrice} 
                  onChange={e => setMaxPrice(e.target.value)} 
                  className="rounded-xl h-12 bg-background border-border focus-visible:ring-amber-500"
                />
              </div>
            </div>
            
            {/* Condition */}
            <div className="mb-8">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Condition</label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="w-full h-12 rounded-xl bg-background border-border focus:ring-amber-500">
                  <SelectValue placeholder="All Conditions" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  <SelectItem value="all" className="rounded-lg cursor-pointer">All Conditions</SelectItem>
                  <SelectItem value="Mint" className="rounded-lg cursor-pointer">Mint</SelectItem>
                  <SelectItem value="Near Mint" className="rounded-lg cursor-pointer">Near Mint</SelectItem>
                  <SelectItem value="Excellent" className="rounded-lg cursor-pointer">Excellent</SelectItem>
                  <SelectItem value="Good" className="rounded-lg cursor-pointer">Good</SelectItem>
                  <SelectItem value="Fair" className="rounded-lg cursor-pointer">Fair</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl font-bold hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 dark:hover:border-amber-900/50 transition-colors" 
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          </div>
        </aside>

        {/* Product Grid Area */}
        <div className="flex-1 min-w-0">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
            <span className="text-lg font-medium text-muted-foreground">
              Showing <span className="font-bold text-foreground">{totalItems}</span> results
            </span>
            
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-muted-foreground hidden sm:block">Sort by:</label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl bg-background border-border font-medium focus:ring-amber-500">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  <SelectItem value="created_at_desc" className="rounded-lg cursor-pointer">Newest Arrivals</SelectItem>
                  <SelectItem value="price_asc" className="rounded-lg cursor-pointer">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc" className="rounded-lg cursor-pointer">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col space-y-4">
                  <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-10 w-full mt-2 rounded-xl" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-muted/30 rounded-3xl border border-border border-dashed">
              <PackageX className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-2xl font-bold mb-2 text-foreground">No singles found</h3>
              <p className="text-muted-foreground max-w-md text-center mb-8 text-lg">
                We couldn't find any items matching your current filters.
              </p>
              <Button 
                onClick={handleClearFilters} 
                variant="outline" 
                className="h-12 px-8 rounded-xl font-bold bg-background shadow-sm hover:bg-secondary"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ShopSinglesPage;
