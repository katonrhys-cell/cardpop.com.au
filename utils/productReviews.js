// Pure helpers for shop product reviews (table: shop_product_reviews).

// GTIN-8 / UPC-A / EAN-13 / GTIN-14, digits only — what Google accepts.
export const isGtin = (value) => /^([0-9]{8}|[0-9]{12,14})$/.test(String(value || '').trim());

export const REVIEW_TITLE_MAX = 120;
export const REVIEW_BODY_MAX = 2000;

export const REVIEW_RATING_LABELS = {
  1: 'Poor',
  2: 'Below average',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
};

// Colour siblings share one pool of reviews: the line's family_sku, or the
// product's own id when it has no family. Mirrors the pool_key the DB insert
// trigger stamps on each review.
export const reviewPoolKey = ({ familySku, productId } = {}) => {
  const family = String(familySku || '').trim();
  return family || (productId ? String(productId) : null);
};

// One-decimal display of an average ("4.7"), or null when there is nothing yet.
export const formatAverageRating = (average) => {
  const n = Number(average);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : null;
};

// schema.org aggregateRating + review properties for a Product, or {} when the
// pool has no published reviews — Google ignores (and can penalise) rating
// markup with nothing visible on the page behind it, so this only emits what
// the ProductReviews section actually shows.
export const productReviewsLd = (stats, reviews = []) => {
  const count = Number(stats?.review_count) || 0;
  const average = formatAverageRating(stats?.average_rating);
  if (count < 1 || !average) return {};
  const shown = (reviews || []).filter((r) => r && r.rating >= 1 && r.rating <= 5);
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: average,
      reviewCount: count,
      bestRating: '5',
      worstRating: '1',
    },
    ...(shown.length > 0 ? {
      review: shown.slice(0, 10).map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.reviewer_name || 'CardPop buyer' },
        datePublished: String(r.created_at || '').slice(0, 10) || undefined,
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: '5', worstRating: '1' },
        ...(r.title ? { name: r.title } : {}),
        ...(r.body ? { reviewBody: r.body } : {}),
      })),
    } : {}),
  };
};

// Shop lines on an order (cart orders carry them in order_items), de-duplicated
// by product id — a review is per product, and an order can list one twice.
export const shopLinesOf = (order) => {
  const lines = Array.isArray(order?.order_items) ? order.order_items : [];
  const seen = new Set();
  return lines.filter((l) => {
    if (l?.type !== 'shop' || !l.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
};
