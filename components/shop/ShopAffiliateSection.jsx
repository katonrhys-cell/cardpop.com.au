import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { escapeLike } from '@/src/utils/escapeLike.js';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Info, ShoppingBag } from 'lucide-react';

/**
 * Affiliate product strip shown at the bottom of the shop pages.
 *
 * These are external, commission-earning recommendations (starting with Amazon
 * Associates) — NOT CardPop inventory. Each card links straight out to the
 * retailer with rel="sponsored nofollow noopener" and opens in a new tab, and
 * the section carries the Amazon Associates disclosure required by the program.
 *
 * Rows are managed in the admin portal (Admin → Shop Affiliate Products).
 *   - `category` prop set  → shows products tagged with that category PLUS
 *                            untagged "general" products (category IS NULL).
 *   - `category` prop unset → shows all published products (the /shop page).
 */
const ShopAffiliateSection = ({ category = null, title = 'You might also like', limit = 8 }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('shop_affiliate_products')
          .select('*')
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(limit);

        // On a category page, show products tagged for this category plus the
        // untagged general ones. On the main shop page (no category), show all.
        if (category) {
          query = query.or(`category.ilike.%${escapeLike(category)}%,category.is.null`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!cancelled) setProducts(data || []);
      } catch {
        // Affiliate promos are non-critical — fail silently and render nothing
        // rather than surface an error on the shop page.
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [category, limit]);

  // Render nothing (no empty state) when there are no promos to show.
  if (!loading && products.length === 0) return null;

  return (
    <section className="border-t border-border mt-4 pt-12">
      <div className="flex items-center gap-2 mb-1.5">
        <ShoppingBag className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Handpicked products from around the web. As an Amazon Associate CardPop earns from qualifying purchases.
      </p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <a
              key={product.id}
              href={product.affiliate_url}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className="group flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <div className="relative aspect-square bg-white flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <ShoppingBag className="w-10 h-10 text-muted-foreground/40" />
                )}
                {product.badge && (
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground border-0 text-[10px]">
                    {product.badge}
                  </Badge>
                )}
              </div>

              <div className="flex flex-col flex-1 p-4">
                <h3 className="text-sm font-semibold line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                  {product.title}
                </h3>
                {product.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  {product.price_label ? (
                    <span className="text-base font-bold">{product.price_label}</span>
                  ) : <span />}
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    {product.cta_label || 'View'}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};

export default ShopAffiliateSection;
