import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import StarRating from '@/components/shop/StarRating.jsx';
import { formatAverageRating } from '@/utils/productReviews.js';

/**
 * Verified-buyer reviews of a shop product. `stats` / `reviews` come from
 * hooks/useShopReviews.js (the page calls the hook once so the same data also
 * feeds the Product structured data). Renders nothing until the first review is
 * published, other than a short prompt — the markup on the page and the markup
 * in the JSON-LD must agree.
 */
const ProductReviews = ({ title, stats, reviews, loading }) => {
  if (loading) return null;
  const count = Number(stats?.review_count) || 0;
  const average = formatAverageRating(stats?.average_rating);

  return (
    <section className="mt-14" id="reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-2xl font-bold text-foreground">Customer reviews</h2>

      {count === 0 || !average ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No reviews yet. Bought the {title}? Once your order has shipped you can review it from{' '}
          <Link to="/account/orders" className="font-semibold text-foreground underline underline-offset-2">Account → Orders</Link>.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-4xl font-bold text-foreground tabular-nums">{average}</span>
            <div>
              <StarRating value={stats.average_rating} size="w-5 h-5" />
              <p className="text-sm text-muted-foreground">{count} review{count === 1 ? '' : 's'}</p>
            </div>
          </div>

          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border overflow-hidden">
            {reviews.map((r) => (
              <li key={r.id} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <StarRating value={r.rating} />
                  <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'd MMM yyyy')}</span>
                </div>
                {r.title && <p className="font-semibold text-foreground">{r.title}</p>}
                {r.body && <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{r.body}</p>}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{r.reviewer_name}</span>
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Verified purchase</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default ProductReviews;
