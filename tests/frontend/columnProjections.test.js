import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://storage.test/object/public/vault-images/${p}` } }) }) } },
}));

import { LISTING_CARD_COLUMNS, LISTING_SELLER_EMBED } from '@/lib/listingColumns.js';
import { SHOP_CARD_COLUMNS } from '@/utils/shopColumns.js';
import { PROFILE_CARD_COLUMNS, PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { BLOG_CARD_COLUMNS } from '@/pages/blog/BlogPage.jsx';
import { EVENT_CARD_COLUMNS, buildEventsQuery } from '@/pages/community/CommunityEventsPage.jsx';
import { cardThumbUrl, THUMBNAILS_SINCE, THUMB_SUFFIX } from '@/utils/imageUrl.js';
import { listingToCollectionItem } from '@/pages/PublicCollectionsPage.jsx';

// The browse grids used to select `*`. These lists are the payload contract:
// what a card renders, and nothing the viewer shouldn't see.

const cols = (s) => s.split(',').map((c) => c.trim());

describe('LISTING_CARD_COLUMNS', () => {
  it('carries what the listing card and offer/cart rules read', () => {
    for (const c of ['id', 'seller_id', 'listing_type', 'status', 'price_aud', 'price_min_aud', 'price_max_aud',
      'accepts_offers', 'accepts_trade', 'offers_open_at', 'offers_close_at', 'shipping_cost_aud', 'slug', 'sold_at', 'created_at']) {
      expect(cols(LISTING_CARD_COLUMNS)).toContain(c);
    }
  });

  it("leaves the seller's private auction floor and moderation fields out", () => {
    for (const c of ['reserve_price_aud', 'flagged', 'flag_reason', '*']) {
      expect(cols(LISTING_CARD_COLUMNS)).not.toContain(c);
    }
    expect(LISTING_SELLER_EMBED).toMatch(/^seller:profiles!seller_id\(/);
  });
});

describe('SHOP_CARD_COLUMNS', () => {
  it('has every field the product card, URL builder and JSON-LD read', () => {
    for (const c of ['id', 'title', 'price_aud', 'retail_price_aud', 'stock_quantity', 'status', 'images', 'image_url',
      'slug', 'category', 'brand', 'sku', 'barcode', 'family_sku', 'colour', 'has_variants', 'preorder_eta', 'created_at']) {
      expect(cols(SHOP_CARD_COLUMNS)).toContain(c);
    }
  });

  it('never ships the long description to a grid', () => {
    expect(cols(SHOP_CARD_COLUMNS)).not.toContain('description');
  });
});

describe('PROFILE_CARD_COLUMNS', () => {
  it('is a strict subset of the client-readable profile columns', () => {
    const allowed = new Set(cols(PUBLIC_PROFILE_COLUMNS));
    for (const c of cols(PROFILE_CARD_COLUMNS)) expect(allowed.has(c)).toBe(true);
    expect(cols(PROFILE_CARD_COLUMNS).length).toBeLessThan(cols(PUBLIC_PROFILE_COLUMNS).length);
  });

  it('has what the seller / profile cards render', () => {
    for (const c of ['id', 'username', 'display_name', 'avatar_url', 'profile_photo_or_character', 'is_verified', 'is_admin',
      'is_sole_trader', 'business_name', 'business_logo_url', 'store_slug', 'rating', 'reviews_count', 'location_state',
      'location_suburb', 'bio', 'personal_collection', 'is_active', 'is_public', 'is_deleted', 'created_at']) {
      expect(cols(PROFILE_CARD_COLUMNS)).toContain(c);
    }
  });
});

describe('BLOG_CARD_COLUMNS and EVENT_CARD_COLUMNS', () => {
  it('the blog index never downloads article bodies', () => {
    expect(cols(BLOG_CARD_COLUMNS)).toContain('excerpt');
    expect(cols(BLOG_CARD_COLUMNS)).not.toContain('content');
    expect(cols(BLOG_CARD_COLUMNS)).not.toContain('content_html');
  });

  it('the events page scopes the query to the date window and keeps undated events', () => {
    const calls = [];
    const q = new Proxy({}, { get: (_t, prop) => (...args) => { calls.push([prop, ...args]); return q; } });
    const client = { from: (t) => { calls.push(['from', t]); return q; } };
    buildEventsQuery(client, { startDate: '2026-10-10', endDate: '2027-10-10' });
    expect(calls).toContainEqual(['from', 'events_public']);
    expect(calls).toContainEqual(['select', EVENT_CARD_COLUMNS]);
    expect(calls).toContainEqual(['or', 'start_date.is.null,and(start_date.gte.2026-10-10,start_date.lte.2027-10-10)']);
    expect(calls.some(([m]) => m === 'limit')).toBe(true);
    expect(cols(EVENT_CARD_COLUMNS)).not.toContain('seo_keywords');
  });

  it('keeps the calendar to approved events and the past view to finished or archived ones', () => {
    const calls = [];
    const q = new Proxy({}, { get: (_t, prop) => (...args) => { calls.push([prop, ...args]); return q; } });
    const client = { from: () => q };
    buildEventsQuery(client, { startDate: '2026-10-10', endDate: '2027-10-10' });
    expect(calls).toContainEqual(['eq', 'status', 'approved']);

    calls.length = 0;
    buildEventsQuery(client, { startDate: '2024-10-16', endDate: '2026-10-16', past: true, today: '2026-10-17' });
    expect(calls).toContainEqual(['or', 'status.eq.completed,and(start_date.gte.2024-10-16,start_date.lte.2026-10-16)']);
    expect(calls).toContainEqual(['order', 'start_date', { ascending: false }]);
    expect(calls.some(([m, a]) => m === 'eq' && a === 'status')).toBe(false);

    // A blank end date in past mode is capped at today, never open-ended.
    calls.length = 0;
    buildEventsQuery(client, { startDate: '', endDate: '', past: true, today: '2026-10-17' });
    expect(calls).toContainEqual(['or', 'status.eq.completed,start_date.lte.2026-10-17']);
  });

  it('refuses a malformed date rather than interpolating it into the filter', () => {
    const calls = [];
    const q = new Proxy({}, { get: (_t, prop) => (...args) => { calls.push([prop, ...args]); return q; } });
    buildEventsQuery({ from: () => q }, { startDate: "2026-10-10')", endDate: 'next year' });
    expect(calls.some(([m]) => m === 'or')).toBe(false);
  });
});

describe('cardThumbUrl', () => {
  it('serves the companion thumbnail for uploads that have one and the full image otherwise', () => {
    const fresh = `u/${THUMBNAILS_SINCE + 1000}.webp`;
    const old = `u/${THUMBNAILS_SINCE - 1000}.jpg`;
    expect(cardThumbUrl(fresh)).toContain(THUMB_SUFFIX);
    expect(cardThumbUrl(old)).toContain(old);
    expect(cardThumbUrl(old)).not.toContain(THUMB_SUFFIX);
    expect(cardThumbUrl(null)).toBeNull();
  });
});

describe('listingToCollectionItem', () => {
  it('reads the card from the embedded vault_item and the price/status from the listing', () => {
    const item = listingToCollectionItem({
      id: 'l1', status: 'sold', price_aud: '12.5', listing_type: 'fixed', accepts_trade: true,
      seller: { username: 'ada' },
      vault_item: { card_name: 'Charizard', collection: 'Pokémon', grading_company: 'PSA', condition: 'NM', card_image: `u/${THUMBNAILS_SINCE + 5}.webp` },
    });
    expect(item).toMatchObject({ name: 'Charizard', collectionType: 'Pokémon', grade: 'PSA', price: 12.5, isSold: true, ownerName: 'ada', isForSale: true, isForTrade: true });
    expect(item.link).toBe('/marketplace/l1/charizard');
    expect(item.image).toContain(THUMB_SUFFIX);
  });
});
