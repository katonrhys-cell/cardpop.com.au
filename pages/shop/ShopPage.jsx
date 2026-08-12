
import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import ShopCategoryBrowse from '@/components/ShopCategoryBrowse.jsx';
import { escapeLike } from '@/src/utils/escapeLike.js';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageX, SlidersHorizontal, Search, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard.jsx';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import ShopAffiliateSection from '@/components/shop/ShopAffiliateSection.jsx';
import { fetchOfficialStoreListings, mergeShopAndListings, OFFICIAL_LISTING_SOURCE } from '@/lib/officialStoreListings.js';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';

const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('created_at_desc');
  // Seed the search box from ?q so a whole-site search handoff (e.g. the
  // "Browse all → Shop" link on /search) pre-fills and filters the shop.
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
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
          query = query.ilike('title', `%${escapeLike(searchTerm)}%`);
        }

        if (sort === 'price_asc') query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        // The platform account's own marketplace listings are shop products
        // too — union them into the grid (fetch resolves to [] on failure so
        // the shop never blanks because of the listings side).
        const [{ data, error: fetchError }, officialListings] = await Promise.all([
          query,
          fetchOfficialStoreListings(supabase, { searchTerm }),
        ]);
        if (fetchError) throw fetchError;

        if (!cancelled) {
          const shopRows = (data || []).map(p => ({ ...p, source: 'shop', type: 'shop' }));
          setProducts(mergeShopAndListings(shopRows, officialListings, sort));
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load shop products.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [sort, searchTerm]);

  useEffect(() => {
    // Scoped to active products — this page already only ever queries
    // status='active', so a change to a draft/archived product shouldn't
    // trigger every open shop page to refetch.
    const channel = supabase
      .channel('shop-products')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_products', filter: 'status=eq.active' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddToCart = (product) => {
    // Build the cart product/variant the same way the product detail page does,
    // using the real shop_products columns (price_aud / stock_quantity). The grid
    // previously passed no variant, so the cart fell back to the raw row (no
    // price_in_cents → $0) and read stockQuantity (camelCase, always undefined).
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
    addToCart(cartProduct, cartVariant, 1, product.stock_quantity ?? 999)
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

      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-12 w-full">
        <h2 className="text-2xl font-bold mb-6">Shop by Category</h2>
        <ShopCategoryBrowse />
      </section>

      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-12 w-full">
        <h2 className="text-2xl font-bold mb-6">All Products</h2>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              name="shop-search"
              aria-label="Search products"
              placeholder="Search products..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-11 rounded-xl bg-card border-border"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort products" className="w-full sm:w-[200px] h-11 rounded-xl bg-card border-border">
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
            {products.map((product, i) => (
              product.source === OFFICIAL_LISTING_SOURCE ? (
                <MarketplaceListingCard
                  key={`listing-${product.id}`}
                  listing={product}
                  priority={i < 2}
                />
              ) : (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  priority={i < 2}
                />
              )
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border border-dashed">
            <PackageX className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
            <p className="text-xl font-bold mb-2">No products found</p>
            <p className="text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        )}

        <ShopAffiliateSection />
      </section>
    </div>
  );
};

export default ShopPage;
