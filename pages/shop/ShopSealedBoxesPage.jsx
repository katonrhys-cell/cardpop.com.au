
import React, { useState, useEffect, useRef } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal, PackageX, Package } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';
import ProductCard from '@/components/ProductCard.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ShopSealedBoxesPage = () => {
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(null);
  
  // Filters and Sort State
  const [sort, setSort] = useState('created_at_desc');
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
          .eq('product_type', 'sealed')
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
        if (isMounted) toast.error('Failed to load products.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRef.current = fetchProducts;
    const timer = setTimeout(() => {
      fetchProducts();
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sort, minPrice, maxPrice]);

  useEffect(() => {
    // Scoped to this page's own product_type so a change to a different
    // category (e.g. singles) doesn't refetch every open sealed-boxes page.
    const channel = supabase
      .channel('shop-sealed-boxes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_products', filter: 'product_type=eq.sealed' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddToCart = (product) => {
    // Build a proper cart product/variant from the real shop_products columns
    // (price_aud / stock_quantity), mirroring the product detail page.
    const priceInCents = Math.round((Number(product.price_aud) || 0) * 100);
    const cartProduct = {
      id: product.id,
      source: 'shop',
      type: 'shop',
      title: product.title,
      price: priceInCents / 100,
      image: product.images?.[0] || product.image_url || product.card_image || null,
      grading_company: product.grading_company || null,
      grade: product.grade || null,
    };
    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      manage_inventory: product.stock_quantity != null,
      inventory_quantity: product.stock_quantity,
    };
    addToCart(cartProduct, cartVariant, 1, product.stock_quantity ?? 999);
    toast.success(`${product.title || 'Item'} added to cart`);
  };

  const handleClearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    // Must match a SelectItem value (and the initial state) or the Sort control
    // blanks out — '-created' matched nothing.
    setSort('created_at_desc');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Sealed Boxes | CardPop Shop" description="Shop official sealed booster boxes and products. Fast shipping across Australia." />

      {/* Header Section */}
      <section className="bg-secondary border-b border-border py-12 px-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="max-w-[90rem] mx-auto">
          <Button variant="ghost" asChild className="mb-6 pl-0 hover:bg-transparent hover:text-primary text-secondary-foreground/80">
            <Link to="/shop"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Shop</Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl hidden sm:block">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-bold font-serif text-secondary-foreground mb-2">Sealed Boxes</h1>
              <p className="text-secondary-foreground/70 text-lg">Pristine, unopened products straight from the manufacturer.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 mt-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
        
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
                  className="rounded-xl h-12 bg-background border-border focus-visible:ring-primary"
                />
                <span className="text-muted-foreground font-medium">-</span>
                <Input 
                  type="number" 
                  placeholder="Max" 
                  value={maxPrice} 
                  onChange={e => setMaxPrice(e.target.value)} 
                  className="rounded-xl h-12 bg-background border-border focus-visible:ring-primary"
                />
              </div>
            </div>
            
            <Button
              variant="outline" 
              className="w-full h-12 rounded-xl font-bold hover:bg-secondary hover:text-secondary-foreground border-border" 
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
                <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl bg-background border-border font-medium focus:ring-primary">
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
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  priority={i < 2}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-muted/30 rounded-3xl border border-border border-dashed">
              <PackageX className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-2xl font-bold mb-2 text-foreground">No boxes found</h3>
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

export default ShopSealedBoxesPage;
