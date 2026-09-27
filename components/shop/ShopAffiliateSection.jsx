import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { escapeLike } from '@/src/utils/escapeLike.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, ShoppingBag, ShoppingCart } from 'lucide-react';

// Pull the first number out of a free-text price label ("$49.99" → 49.99,
// "From $19" → 19). Returns null when nothing numeric is present.
const parsePrice = (label) => {
  if (!label) return null;
  const match = String(label).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
};

// Whole-number "% off" from RRP → sale, or null when it can't be derived
// (missing/unparseable values, or the RRP isn't higher than the sale price).
const computeDiscount = (originalLabel, saleLabel) => {
  const original = parsePrice(originalLabel);
  const sale = parsePrice(saleLabel);
  if (original == null || sale == null || original <= sale) return null;
  const pct = Math.round((1 - sale / original) * 100);
  return pct > 0 ? pct : null;
};

/**
 * Affiliate product strip shown at the bottom of the shop pages.
 *
 * These are external, commission-earning recommendations (starting with Amazon
 * Associates) — NOT CardPop inventory. Each card links straight out to the
 * retailer with rel="sponsored nofollow noopener" and opens in a new tab, and
 * the section carries the Amazon Associates disclosure required by the program.
 *
 * Rows are managed in the admin portal (Admin → Shop Affiliate Products).
 * Placement is mutually exclusive, driven by each product's `category`:
 *   - `category` prop unset (the main /shop page) → shows only untagged
 *     products (category IS NULL).
 *   - `category` prop set (a category page) → shows only products tagged
 *     with that category name.
 */
const ShopAffiliateSection = ({ category = null, title = 'Amazon Super Steals', limit = 8 }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Ids whose external image failed to load (hotlink blocked, URL rotated) —
  // those fall back to the placeholder icon instead of a broken image.
  const [failedImages, setFailedImages] = useState(() => new Set());

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

        // Mutually exclusive placement: a category page shows only products
        // tagged for that category; the main shop page (no category) shows only
        // untagged products.
        if (category) {
          query = query.ilike('category', `%${escapeLike(category)}%`);
        } else {
          query = query.is('category', null);
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
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        CardPop scours the deals and reviews listings to find bargains for the trading card community.
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
          {products.map((product) => {
            const discount = computeDiscount(product.original_price_label, product.price_label);
            return (
            <div
              key={product.id}
              className="group flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <a
                href={product.affiliate_url}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                className="relative aspect-square bg-white flex items-center justify-center overflow-hidden"
                aria-label={product.title}
              >
                {product.image_url && !failedImages.has(product.id) ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImages((prev) => new Set(prev).add(product.id))}
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
                {discount != null && (
                  <Badge className="absolute top-2 right-2 bg-red-600 text-white border-0 text-[10px] font-bold">
                    {discount}% OFF
                  </Badge>
                )}
              </a>

              <div className="flex flex-col flex-1 p-4">
                <a
                  href={product.affiliate_url}
                  target="_blank"
                  rel="sponsored nofollow noopener noreferrer"
                  className="mb-1"
                >
                  <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {product.title}
                  </h3>
                </a>
                {product.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
                )}
                {(product.price_label || product.original_price_label) && (
                  <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 pt-2">
                    {product.price_label && (
                      <span className="text-base font-bold text-foreground">{product.price_label}</span>
                    )}
                    {product.original_price_label && (
                      <span className="text-xs text-muted-foreground line-through">
                        RRP {product.original_price_label}
                      </span>
                    )}
                  </div>
                )}
                <Button asChild size="sm" className={`w-full rounded-xl font-bold ${(product.price_label || product.original_price_label) ? 'mt-3' : 'mt-auto'}`}>
                  <a href={product.affiliate_url} target="_blank" rel="sponsored nofollow noopener noreferrer">
                    <ShoppingCart className="w-4 h-4 mr-2" /> Buy Now
                  </a>
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="text-xs text-muted-foreground mt-6 flex items-start gap-1.5 w-full">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            CardPop is a participant in the Amazon Services LLC Associates Program, an affiliate
            advertising program. As an Amazon Associate CardPop earns from qualifying purchases —
            at no extra cost to you. Prices and availability are accurate as of the time of viewing
            and are subject to change on Amazon.
          </span>
        </p>
      )}
    </section>
  );
};

export default ShopAffiliateSection;
