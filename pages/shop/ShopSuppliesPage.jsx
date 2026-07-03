import React, { useEffect, useState, useRef } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PackageX, Search, Layers, Truck, ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';
import { SUPPLY_CATEGORIES } from '@/utils/supplyCategories.js';

const SupplyCard = ({ product, onAddToCart }) => {
  const outOfStock = product.in_stock === false;
  const image = product.images?.[0] || product.image_url || null;

  return (
    <div className={`bg-card border border-border rounded-2xl overflow-hidden flex flex-col group ${outOfStock ? 'opacity-75' : ''}`}>
      <div className="relative aspect-[4/3] bg-muted/40">
        {image ? (
          <img src={image} alt={product.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
        )}
        {outOfStock && (
          <Badge variant="outline" className="absolute top-3 left-3 bg-background/90 text-destructive border-destructive/30 font-bold">
            Out of Stock
          </Badge>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1 gap-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{product.category}</p>
        <h3 className="font-bold text-foreground leading-snug flex-1">{product.title}</h3>
        <p className="text-lg font-bold text-foreground tabular-nums">
          ${Number(product.price_aud ?? 0).toFixed(2)}
          <span className="text-xs font-normal text-muted-foreground ml-1">inc. GST</span>
        </p>
        <Button
          onClick={() => onAddToCart(product)}
          disabled={outOfStock}
          className="w-full rounded-xl font-bold mt-1"
          size="sm"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {outOfStock ? 'Unavailable' : 'Add to Cart'}
        </Button>
      </div>
    </div>
  );
};

const ShopSuppliesPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [shippingRules, setShippingRules] = useState(null);
  const { addToCart } = useCart();
  const fetchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiServerClient.fetch('/supplies/settings/public')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setShippingRules(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
          .eq('is_supply', true)
          .limit(100);

        if (category !== 'all') query = query.eq('category', category);
        if (searchTerm) query = query.ilike('title', `%${searchTerm.replace(/'/g, '')}%`);

        query = query
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        if (!cancelled) {
          setProducts((data || []).map(p => ({ ...p, source: 'shop', type: 'shop' })));
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load supplies.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [category, searchTerm]);

  useEffect(() => {
    const channel = supabase
      .channel('shop-supplies')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_products' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddToCart = (product) => {
    if (product.in_stock === false) {
      toast.error(`${product.title} is currently out of stock`);
      return;
    }
    const priceInCents = Math.round((Number(product.price_aud) || 0) * 100);
    const cartProduct = {
      id: product.id,
      source: 'shop',
      type: 'shop',
      title: product.title,
      price: priceInCents / 100,
      image: product.images?.[0] || product.image_url || null,
    };
    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      // Dropshipped supplies use the in_stock flag, not a counted quantity
      manage_inventory: false,
    };
    addToCart(cartProduct, cartVariant, 1)
      .then(() => toast.success('Added to cart'))
      .catch(e => toast.error(e.message));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <SEOHead
        title="Card Supplies | CardPop"
        description="Sleeves, toploaders, binders, storage and grading supplies for trading card collectors. GST-inclusive prices with fast shipping across Australia."
      />

      <section className="bg-card border-b border-border py-16 text-center">
        <div className="container-default">
          <Layers className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Card Supplies</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to protect, store, grade and ship your collection.
          </p>
          {shippingRules && (
            <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold">
              <Truck className="w-4 h-4" />
              Free shipping on supply orders over ${Number(shippingRules.freeShippingThresholdAud).toFixed(0)} —
              flat ${Number(shippingRules.flatShippingFeeAud).toFixed(2)} under
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-2 flex-wrap">
            {['all', ...SUPPLY_CATEGORIES].map(cat => (
              <Button
                key={cat}
                variant={category === cat ? 'default' : 'outline'}
                size="sm"
                className="rounded-full font-bold"
                onClick={() => setCategory(cat)}
              >
                {cat === 'all' ? 'All Supplies' : cat}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search supplies..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-card border-border"
            />
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
                <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map(product => (
              <SupplyCard key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border border-dashed">
            <PackageX className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
            <p className="text-xl font-bold mb-2">No supplies found</p>
            <p className="text-muted-foreground">Try a different category or search term.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default ShopSuppliesPage;
