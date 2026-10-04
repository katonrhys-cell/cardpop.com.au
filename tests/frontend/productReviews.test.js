import { describe, it, expect } from 'vitest';
import {
  formatAverageRating, isGtin, productReviewsLd, reviewPoolKey, shopLinesOf,
} from '@/utils/productReviews.js';

describe('reviewPoolKey', () => {
  it('uses the family SKU so colour siblings share reviews', () => {
    expect(reviewPoolKey({ familySku: 'ZB-04', productId: 'p1' })).toBe('ZB-04');
  });
  it('falls back to the product id', () => {
    expect(reviewPoolKey({ familySku: '  ', productId: 'p1' })).toBe('p1');
    expect(reviewPoolKey({ productId: 'p1' })).toBe('p1');
  });
  it('is null with nothing to key on', () => {
    expect(reviewPoolKey({})).toBeNull();
    expect(reviewPoolKey()).toBeNull();
  });
});

describe('formatAverageRating', () => {
  it('formats to one decimal', () => {
    expect(formatAverageRating(4.666)).toBe('4.7');
    expect(formatAverageRating('5')).toBe('5.0');
  });
  it('is null when there is no rating', () => {
    expect(formatAverageRating(0)).toBeNull();
    expect(formatAverageRating(null)).toBeNull();
    expect(formatAverageRating('x')).toBeNull();
  });
});

describe('productReviewsLd', () => {
  const reviews = [
    { id: 'a', rating: 5, title: 'Great', body: 'Holds a lot', reviewer_name: 'Sam', created_at: '2026-10-01T03:00:00Z' },
    { id: 'b', rating: 4, reviewer_name: 'Alex', created_at: '2026-09-30T03:00:00Z' },
  ];

  it('emits nothing when there are no published reviews', () => {
    expect(productReviewsLd(null, [])).toEqual({});
    expect(productReviewsLd({ review_count: 0, average_rating: 0 }, [])).toEqual({});
  });

  it('emits aggregateRating and review entries that match what the page shows', () => {
    const ld = productReviewsLd({ review_count: 2, average_rating: 4.5 }, reviews);
    expect(ld.aggregateRating).toEqual({
      '@type': 'AggregateRating', ratingValue: '4.5', reviewCount: 2, bestRating: '5', worstRating: '1',
    });
    expect(ld.review).toHaveLength(2);
    expect(ld.review[0]).toMatchObject({
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Sam' },
      datePublished: '2026-10-01',
      name: 'Great',
      reviewBody: 'Holds a lot',
      reviewRating: { ratingValue: 5 },
    });
    expect(ld.review[1].reviewBody).toBeUndefined();
  });

  it('uses the full published count, not just the page of reviews loaded', () => {
    const ld = productReviewsLd({ review_count: 37, average_rating: 4.2 }, reviews);
    expect(ld.aggregateRating.reviewCount).toBe(37);
  });
});

describe('shopLinesOf', () => {
  it('returns shop lines only, one per product', () => {
    const order = {
      order_items: [
        { type: 'shop', id: 'p1', title: 'Binder' },
        { type: 'shop', id: 'p1', title: 'Binder' },
        { type: 'listing', id: 'l1', title: 'Card' },
        { type: 'shop', id: 'p2', title: 'Sleeves' },
        { type: 'shop', title: 'no id' },
      ],
    };
    expect(shopLinesOf(order).map((l) => l.id)).toEqual(['p1', 'p2']);
  });
  it('handles orders with no lines', () => {
    expect(shopLinesOf({ order_items: null })).toEqual([]);
    expect(shopLinesOf(undefined)).toEqual([]);
  });
});

describe('isGtin', () => {
  it('accepts GTIN-8, UPC-A, EAN-13 and GTIN-14 digit strings', () => {
    ['12345670', '396483852909', '1209202001436', '12345678901231'].forEach((g) => expect(isGtin(g)).toBe(true));
  });
  it('rejects other shapes', () => {
    ['', null, '123', '12345678901', 'abcdefgh', '1209202001436x'].forEach((g) => expect(isGtin(g)).toBe(false));
  });
});
