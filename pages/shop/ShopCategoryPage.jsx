import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { SHOP_CARD_COLUMNS } from '@/utils/shopColumns.js';
import { useCategory } from '@/contexts/CategoryContext.jsx';
import { getCategoryBySlug, getBreadcrumbs } from '@/utils/categoryUtils.js';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';
import { generateMetaTitle, generateMetaDescription, generateBreadcrumbStructuredData } from '@/utils/seoUtils.js';
import { escapeLike } from '@/src/utils/escapeLike.js';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import ProductGrid from '@/components/ProductGrid.jsx';
import PaginationControls from '@/components/PaginationControls.jsx';
import ShopAffiliateSection from '@/components/shop/ShopAffiliateSection.jsx';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag, Search, SlidersHorizontal } from 'lucide-react';
import { useCart } from '@/hooks/useCart.jsx';
import { useRefreshOnReturn } from '@/hooks/useRefreshOnReturn.js';
import { PUBLIC_SHOP_STATUSES, preorderCartFields, hasUnlimitedStock } from '@/utils/shopStock.js';
import { filterFacetRows, matchesSearch, sortFacetRows, fetchShopProductsByIds } from '@/utils/shopFacets.js';
import { useShopFacets } from '@/hooks/useShopFacets.js';
import ShopFilterPanel from '@/components/shop/ShopFilterPanel.jsx';
import { shopProductPath } from '@/utils/shopProductUrl.js';
import { shopProductIdentifiersLd } from '@/utils/productIdentifiers.js';
import { toast } from 'sonner';

const SITE_ORIGIN = 'https://cardpop.com.au';
const PER_PAGE = 16;

const ShopCategoryPage = () => {
  const { categorySlug, subcategorySlug, productTypeSlug } = useParams();
  const { hierarchy, loading: contextLoading } = useCategory();
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [searchTerm, setSearchTerm] = useState('');
  // The query uses a debounced copy so each keystroke doesn't fire a fetch.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const fetchRef = useRef(null);
  // Accessory categories (Card Sleeves, Top Loaders, …) are defined in the shop
  // config, not the marketplace `categories` hierarchy — resolve those first so
  // each dropdown item renders a real page. Fall back to the TCG hierarchy for
  // legacy slugs (pokemon, etc.).
  const { findCategory: findShopCategory } = useShopCategoryGroups();
  const shopCategory = findShopCategory(categorySlug);
  const pathInfo = getCategoryBySlug(hierarchy, categorySlug, subcategorySlug, productTypeSlug);
  const { category, subcategory, productType } = pathInfo || {};
  const categoryName = shopCategory?.name || subcategory?.name || category?.name;

  // Type / colour / price / availability… chips (see utils/shopFacets.js).
  const facets = useShopFacets({
    scope: (q) => (categoryName ? q.ilike('category', `%${escapeLike(categoryName)}%`) : q),
    scopeKey: categoryName || '',
    enabled: !contextLoading,
  });
  const selectionKey = JSON.stringify(facets.selection);
  const filtering = facets.activeCount > 0;
  // Only a filtered grid reads the facet rows — don't refetch the unfiltered
  // grid just because they finished loading.
  const filterRows = filtering ? facets.rows : null;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to the first page whenever the category path, sort, search or a
  // filter changes, so we never land on an out-of-range page showing zero products.
  useEffect(() => {
    setPage(1);
  }, [categorySlug, subcategorySlug, productTypeSlug, sort, debouncedSearch, selectionKey]);

  useEffect(() => {
    // Guards against a slower, older response overwriting a newer one (e.g.
    // switching category or typing a search while a fetch is in flight).
    let cancelled = false;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const from = (page - 1) * PER_PAGE;

        // Filtered: the facet rows already hold every product in the category,
        // so filter + sort them here and fetch full rows for this page only.
        if (filtering) {
          const matched = sortFacetRows(
            filterFacetRows(facets.rows, facets.selection).filter((r) => matchesSearch(r, debouncedSearch)),
            sort,
          );
          const pageRows = await fetchShopProductsByIds(supabase, matched.slice(from, from + PER_PAGE).map((r) => r.id));
          if (cancelled) return;
          setProducts(pageRows.map(p => ({ ...p, source: 'shop', type: 'shop' })));
          setTotalItems(matched.length);
          setTotalPages(Math.ceil(matched.length / PER_PAGE));
          return;
        }

        // Exact count: this page renders numbered page buttons (PaginationControls),
        // which need an accurate total — an estimated count would render buttons for
        // empty pages or hide real ones. The active shop catalogue per category is
        // small, so the exact count is inexpensive.
        let query = supabase
          .from('shop_products')
          // `estimated` is exact below PostgREST's 1,000-row cap (the whole
          // catalogue today) and stops costing a second scan beyond it.
          .select(SHOP_CARD_COLUMNS, { count: 'estimated' })
          .in('status', PUBLIC_SHOP_STATUSES);

        // shop_products stores a free-text category; match the resolved
        // subcategory/category name against it.
        if (categoryName) query = query.ilike('category', `%${escapeLike(categoryName)}%`);
        if (debouncedSearch) query = query.ilike('title', `%${escapeLike(debouncedSearch)}%`);

        if (sort === 'price_asc') query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else if (sort === 'oldest') query = query.order('created_at', { ascending: true });
        else query = query.order('created_at', { ascending: false });

        query = query.range(from, from + PER_PAGE - 1);

        const { data, count, error } = await query;
        if (cancelled) return;
        if (error) throw error;

        setProducts((data || []).map(p => ({ ...p, source: 'shop', type: 'shop' })));
        setTotalItems(count || 0);
        setTotalPages(Math.ceil((count || 0) / PER_PAGE));
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load shop category products:', error);
        toast.error('Failed to load products. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // A filter in the URL can only be resolved once the facets load — wait
    // rather than flash the unfiltered grid first.
    if (!contextLoading && !facets.waiting) {
      fetchRef.current = fetchProducts;
      fetchProducts();
    }
    return () => { cancelled = true; };
    // Depend on stable slug strings (not the derived path objects, which get new
    // identities every render and would re-run this effect needlessly). The
    // selection is tracked by value via selectionKey for the same reason.
  }, [categoryName, page, sort, debouncedSearch, contextLoading, selectionKey, filterRows, facets.waiting]);

  // Stock and price changes reach a returning visitor on the next look at the
  // tab; no realtime channel is held open for the grid (see useRefreshOnReturn).
  useRefreshOnReturn(() => fetchRef.current?.());

  const handleAddToCart = (product) => {
    // Build the cart product/variant from the real shop_products columns
    // (title / price_aud / stock_quantity), mirroring the other shop pages.
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
      .then(() => toast.success(`${product.title || 'Item'} added to cart`))
      .catch(e => toast.error(e.message));
  };

  const heroTitle = shopCategory?.name || productType?.name || subcategory?.name || category?.name || 'Shop Products';
  const heroGroup = shopCategory?.group;
  const heroDesc = shopCategory?.desc || category?.description || subcategory?.description
    || `Browse our range of ${heroTitle.toLowerCase()} — sourced, checked and shipped fast across Australia.`;
  const HeroIcon = shopCategory?.LeafIcon || shopCategory?.Icon || ShoppingBag;
  const heroGradient = shopCategory?.gradient || 'from-brand-red to-brand-charcoal';

  const breadcrumbs = shopCategory
    ? [
        { label: 'Home', path: '/' },
        { label: 'Shop', path: '/shop' },
        { label: shopCategory.name },
      ]
    : getBreadcrumbs(category, subcategory, productType, '/shop');

  const metaTitle = shopCategory
    ? `${shopCategory.name} - CardPop Shop`
    : generateMetaTitle(category, subcategory, productType) + ' - Official Store';
  const metaDesc = shopCategory
    ? `Shop ${shopCategory.name.toLowerCase()} and more ${shopCategory.group.toLowerCase()} supplies at CardPop. Fast, tracked shipping across Australia.`
    : generateMetaDescription(category, totalItems);

  const canonicalPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;

  // Structured data — a BreadcrumbList plus a CollectionPage whose ItemList
  // exposes the products on this page (name, image, price, link) so Google can
  // surface the category as a rich product listing.
  const absoluteImage = (p) => {
    const raw = p.images?.[0] || p.image_url || p.card_image || null;
    if (!raw) return undefined;
    try { return new URL(raw, SITE_ORIGIN).href; } catch { return undefined; }
  };
  const breadcrumbSchema = generateBreadcrumbStructuredData(
    breadcrumbs.map((c) => ({
      name: c.label,
      url: c.path ? `${SITE_ORIGIN}${c.path}` : canonicalUrl,
    }))
  );
  const collectionSchema = products.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: metaTitle,
    description: metaDesc,
    url: canonicalUrl,
    isPartOf: { '@type': 'WebSite', name: 'CardPop Australia™', url: SITE_ORIGIN },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: totalItems,
      itemListElement: products.map((p, i) => {
        const price = Number(p.price_aud ?? 0);
        const url = `${SITE_ORIGIN}${shopProductPath(p)}`;
        // Unpriced (e.g. coming soon): a Product without a real offer is
        // rejected by Google, so list the URL only.
        if (!(price > 0)) {
          return {
            '@type': 'ListItem',
            position: (page - 1) * PER_PAGE + i + 1,
            name: p.title || p.name || 'Trading Card Supply',
            url,
          };
        }
        const productSchema = {
          '@type': 'Product',
          name: p.title || p.name || 'Trading Card Supply',
          url,
          ...(absoluteImage(p) ? { image: absoluteImage(p) } : {}),
          // brand + sku/mpn + gtin: utils/productIdentifiers.js.
          ...shopProductIdentifiersLd(p),
          offers: {
            '@type': 'Offer',
            priceCurrency: 'AUD',
            price: price.toFixed(2),
            availability: p.status === 'preorder'
              ? 'https://schema.org/PreOrder'
              : (p.stock_quantity == null || p.stock_quantity > 0)
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url,
          },
        };
        return {
          '@type': 'ListItem',
          position: (page - 1) * PER_PAGE + i + 1,
          item: productSchema,
        };
      }),
    },
  } : null;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <SEOHead
        title={metaTitle}
        description={metaDesc}
        canonicalUrl={canonicalUrl}
        structuredData={[breadcrumbSchema, collectionSchema].filter(Boolean)}
      />

      {/* Header — left-aligned and compact, mirroring the main /shop (Card Supplies) page */}
      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-6 md:pt-8 w-full">
        <Breadcrumb items={breadcrumbs} />

        <div className="flex items-center gap-3 mb-1.5">
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${heroGradient} shadow-sm shrink-0`}
          >
            <HeroIcon className="w-5 h-5 text-white drop-shadow-sm" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {heroGroup && (
              <p className="text-xs font-bold uppercase tracking-widest text-primary leading-none mb-1">
                {heroGroup}
              </p>
            )}
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">{heroTitle}</h1>
          </div>
        </div>
        <p className="text-muted-foreground">{heroDesc}</p>
      </section>

      {/* Products */}
      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-8 pb-12 w-full flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-xl font-bold sm:mr-auto">
            All Products
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {totalItems} {totalItems === 1 ? 'product' : 'products'}
            </span>
          </h2>
          <div className="relative w-full sm:w-72 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              name="shop-category-search"
              aria-label={`Search ${heroTitle}`}
              placeholder={`Search ${heroTitle.toLowerCase()}...`}
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
              <SelectItem value="newest">Newest Arrivals</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
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

        <ProductGrid items={products} loading={loading || contextLoading} isVault={false} onAddToCart={handleAddToCart} />

        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />

        <ShopAffiliateSection category={categoryName || null} />
      </section>
    </div>
  );
};

export default ShopCategoryPage;
