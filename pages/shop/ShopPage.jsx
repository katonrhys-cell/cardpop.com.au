
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
import ShopAffiliateSection from '@/components/shop/ShopAffiliateSection.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import { PUBLIC_SHOP_STATUSES, preorderCartFields, hasUnlimitedStock } from '@/utils/shopStock.js';
import { useRefreshOnReturn } from '@/hooks/useRefreshOnReturn.js';
import { useShopFacets } from '@/hooks/useShopFacets.js';
import { filterFacetRows, matchesSearch, sortFacetRows, fetchShopProductsByIds } from '@/utils/shopFacets.js';
import ShopFilterPanel from '@/components/shop/ShopFilterPanel.jsx';
import { toast } from 'sonner';

const PAGE_LIMIT = 50;
// Across the whole catalogue, Category leads; Type/pockets only make sense
// inside one category, so they're left to the category pages.
const FACET_KEYS = ['category', 'price', 'availability', 'brand', 'colour', 'sale'];

const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('created_at_desc');
  // Seed the search box from ?q so a whole-site search handoff (e.g. the
  // "Browse all → Shop" link on /search) pre-fills and filters the shop.
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const { addToCart } = useCart();
  const fetchRef = useRef(null);
  const pageRef = useRef(0);
  const facets = useShopFacets({ scopeKey: 'all', keys: FACET_KEYS });
  const selectionKey = JSON.stringify(facets.selection);
  // Only a filtered grid reads the facet rows — don't refetch the unfiltered
  // grid just because they finished loading.
  const filterRows = facets.activeCount > 0 ? facets.rows : null;

  useEffect(() => {
    let cancelled = false;

    const run = async (page = 0, { append = false } = {}) => {
      if (append) setLoadingMore(true); else setLoading(true);
      setError(null);
      const from = page * PAGE_LIMIT;
      const stamp = (rows) => rows.map(p => ({ ...p, source: 'shop', type: 'shop' }));
      const commit = (rows) => {
        pageRef.current = page;
        setProducts(prev => (append ? [...prev, ...rows] : rows));
      };
      try {
        // Filtered: filter + sort the facet rows here, then fetch full rows
        // for the requested page of matches only.
        if (filterRows) {
          const matched = sortFacetRows(
            filterFacetRows(filterRows, JSON.parse(selectionKey)).filter((r) => matchesSearch(r, searchTerm)),
            sort === 'created_at_desc' ? 'newest' : sort,
          );
          const pageIds = matched.slice(from, from + PAGE_LIMIT);
          const rows = await fetchShopProductsByIds(supabase, pageIds.map((r) => r.id));
          if (!cancelled) {
            setHasMore(matched.length > from + PAGE_LIMIT);
            commit(stamp(rows));
          }
          return;
        }

        let query = supabase
          .from('shop_products')
          .select('*')
          .in('status', PUBLIC_SHOP_STATUSES)
          .range(from, from + PAGE_LIMIT - 1);

        if (searchTerm) {
          query = query.ilike('title', `%${escapeLike(searchTerm)}%`);
        }

        if (sort === 'price_asc') query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });
        // Every sort needs a unique tie-breaker: without one, rows with equal
        // prices or timestamps can come back in a different order per page, so
        // the same product shows up twice across pages (or never at all).
        query = query.order('id', { ascending: true });

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        if (!cancelled) {
          setHasMore((data || []).length === PAGE_LIMIT);
          commit(stamp(data || []));
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load shop products.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    fetchRef.current = run;
    // Hold while a filter in the URL can't be resolved yet (no unfiltered flash).
    if (!facets.waiting) run(0, { append: false });
    return () => { cancelled = true; };
  }, [sort, searchTerm, selectionKey, filterRows, facets.waiting]);

  // Stock and price changes reach a returning visitor on the next look at the
  // tab; no realtime channel is held open for the grid (see useRefreshOnReturn).
  useRefreshOnReturn(() => fetchRef.current?.(0, { append: false }));

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchRef.current?.(pageRef.current + 1, { append: true });
  };

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
      ...preorderCartFields(product),
    };
    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      // Pre-orders are unlimited, so the cart doesn't cap them by stock.
      manage_inventory: !hasUnlimitedStock(product) && product.stock_quantity != null,
      inventory_quantity: product.stock_quantity,
    };
    addToCart(cartProduct, cartVariant, 1, product.stock_quantity ?? 999)
      .then(() => toast.success('Added to cart'))
      .catch(e => toast.error(e.message));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <SEOHead title="The Shop | CardPop" description="Shop trading card supplies: sleeves, toploaders, binders, storage, display and shipping. Fast shipping across Australia." />

      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-8 md:pt-10 w-full">
        <div className="flex items-center gap-3 mb-1.5">
          <ShoppingBag className="w-7 h-7 text-primary shrink-0" aria-hidden="true" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Card Supplies</h1>
        </div>
        <p className="text-muted-foreground mb-5">
          Sleeves, toploaders, binders, storage boxes, display cases and shipping supplies to protect, store and display your collection.
        </p>
        <h2 className="sr-only">Shop by Category</h2>
        <ShopCategoryBrowse />
      </section>

      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-8 pb-12 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-xl font-bold sm:mr-auto">All Products</h2>
          <div className="relative w-full sm:w-72 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              name="shop-search"
              aria-label="Search products"
              placeholder="Search products..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-card border-border"
            />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort products" className="w-full sm:w-[190px] h-10 rounded-xl bg-card border-border">
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

        <ShopFilterPanel
          options={facets.options}
          rows={facets.rows}
          selection={facets.selection}
          onChange={facets.setFacet}
          onClear={facets.clearFacets}
        />

        {error ? (
          <div className="text-center py-20 text-destructive bg-destructive/5 rounded-3xl border border-destructive/20">
            <p className="font-bold text-lg">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => fetchRef.current?.(0, { append: false })}>Retry</Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  priority={i < 2}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-10">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl font-bold px-8"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load more products'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border border-dashed">
            <PackageX className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
            <p className="text-xl font-bold mb-2">No products found</p>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        )}

        <ShopAffiliateSection />
      </section>
    </div>
  );
};

export default ShopPage;
