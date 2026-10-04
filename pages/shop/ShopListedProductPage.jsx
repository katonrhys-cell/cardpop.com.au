import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';
import { shopCategorySlug, shopLineSlug, shopProductBasePath, shopSlugRedirectTarget } from '@/utils/shopProductUrl.js';
import ProductDetailPage from '@/pages/ProductDetailPage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * /shop/<category>/<slug> for a shop product with no catalogue copy of its own
 * (CardPop house products, and any Palms Off row the static catalogue doesn't
 * cover). The catalogue pages (ShopProductPage / ShopBinderProductPage) render
 * this when the slug isn't one of theirs.
 *
 * The slug is a product slug, or a colour line's slug (utils/shopProductUrl.js
 * drops the "-<colour>" suffix) — then ?colour= picks the sibling. A product
 * reached under the wrong category redirects to its real URL rather than
 * serving a duplicate page, and a slug the product used to have (renamed in
 * Admin → Products — the DB trigger records it in shop_product_slug_redirects)
 * redirects to its current URL so indexed links keep working.
 */
const ShopListedProductPage = ({ categorySlug, productSlug }) => {
  const { search } = useLocation();
  const [state, setState] = useState({ loading: true, row: null, redirect: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, row: null, redirect: null });
    (async () => {
      const colour = new URLSearchParams(search).get('colour');
      const columns = 'id, slug, category, colour, family_sku';
      // Exact product slug first, then a colour line (siblings' slugs are
      // "<line>-<colour>").
      let { data: rows } = await supabase
        .from('shop_products').select(columns)
        .in('status', PUBLIC_SHOP_STATUSES)
        .eq('slug', productSlug);
      if (!rows?.length) {
        ({ data: rows } = await supabase
          .from('shop_products').select(columns)
          .in('status', PUBLIC_SHOP_STATUSES)
          .like('slug', `${productSlug.replace(/[%_\\]/g, '\\$&')}-%`)
          .not('family_sku', 'is', null));
        rows = (rows || []).filter((r) => shopLineSlug(r) === productSlug);
      }
      if (!rows?.length) {
        const { data: redirects } = await supabase
          .from('shop_product_slug_redirects')
          .select('old_slug, product:shop_products(id, slug, category, colour, family_sku)')
          .like('old_slug', `${productSlug.replace(/[%_\\]/g, '\\$&')}%`);
        const redirect = shopSlugRedirectTarget(redirects, productSlug, colour);
        if (!cancelled) setState({ loading: false, row: null, redirect });
        return;
      }
      const row = (colour && rows?.find((r) => r.colour && shopLineSlug(r) === productSlug
        && r.slug.endsWith(`-${colour}`))) || rows?.[0] || null;
      if (!cancelled) setState({ loading: false, row, redirect: null });
    })().catch(() => { if (!cancelled) setState({ loading: false, row: null, redirect: null }); });
    return () => { cancelled = true; };
  }, [categorySlug, productSlug, search]);

  if (state.loading) {
    return (
      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-12 grid md:grid-cols-2 gap-10">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }
  if (state.redirect) return <Navigate to={state.redirect} replace />;
  if (!state.row) return <NotFoundPage />;

  const base = shopProductBasePath(state.row);
  if (shopCategorySlug(state.row) !== categorySlug && base) {
    return <Navigate to={`${base}${search}`} replace />;
  }

  return <ProductDetailPage key={state.row.id} source="shop" id={state.row.id} canonicalPath={base} />;
};

export default ShopListedProductPage;
