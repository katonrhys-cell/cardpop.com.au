
import React, { useEffect, useState, useRef } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageX, SlidersHorizontal, Search, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';

const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('created_at_desc');
  const [searchTerm, setSearchTerm] = useState('');
  const { addToCart } = useCart();
  const fetchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('shop_products')
          .select('*')
          .eq('status', 'active')
          .limit(50);

        if (searchTerm) {
          query = query.ilike('title', `%${searchTerm.replace(/'/g, '')}%`);
        }

        if (sort === 'price_asc') query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        if (!cancelled) {
          setProducts((data || []).map(p => ({ ...p, source: 'shop', type: 'shop' })));
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load shop products.');
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [sort, searchTerm]);

  const handleAddToCart = (product, variant) => {
    addToCart(product, variant, 1, product.stockQuantity ?? 999)
      .then(() => toast.success('Added to cart'))
      .catch(e => toast.error(e.message));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <SEOHead title="The Shop | CardPop" description="Shop official CardPop sealed products, singles and accessories. Fast shipping across Australia." />

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <ShoppingBag className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The Card Shop</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Curated premium sealed boxes, rare singles, and exclusive drops sourced and verified by our experts.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-11 rounded-xl bg-card border-border"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl bg-card border-border">
                <SlidersHorizontal className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at_desc">Newest Arrivals</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="text-center py-20 text-destructive bg-destructive/5 rounded-3xl border border-destructive/20">
            <p className="font-bold text-lg">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => fetchRef.current?.()}>Retry</Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border border-dashed">
            <PackageX className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
            <p className="text-xl font-bold mb-2">No products found</p>
            <p className="text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default ShopPage;
