import { describe, it, expect, beforeEach, vi } from 'vitest';

// lib/analytics.js keeps module-level state (purchase dedupe, ads config), so
// every test imports a fresh copy.
const fresh = async () => {
  vi.resetModules();
  return import('@/lib/analytics.js');
};

const events = () => window.dataLayer.filter((c) => c[0] === 'event').map((c) => ({ name: c[1], params: c[2] }));

beforeEach(() => {
  delete window.gtag;
  delete window.dataLayer;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('installGtag', () => {
  it('queues Consent Mode defaults with ad storage denied until the visitor accepts', async () => {
    const { installGtag } = await fresh();
    installGtag();
    const consent = window.dataLayer.find((c) => c[0] === 'consent' && c[1] === 'default')[2];
    expect(consent).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  });

  it('grants ad storage once marketing cookies are accepted', async () => {
    const { installGtag } = await fresh();
    const { setConsent, CONSENT_ALL } = await import('@/lib/consent.js');
    installGtag();
    setConsent(CONSENT_ALL);
    const update = window.dataLayer.find((c) => c[0] === 'consent' && c[1] === 'update')[2];
    expect(update).toMatchObject({ ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
  });
});

describe('ecommerce events', () => {
  it('is a no-op without the gtag stub (dev, localhost, e2e)', async () => {
    const { trackViewItem, trackAddToCart } = await fresh();
    expect(() => { trackViewItem({ id: 'x', name: 'Card', price: 10 }); trackAddToCart({ id: 'x', name: 'Card', price: 10 }); }).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });

  it('sends view_item with an AUD value and a normalised item', async () => {
    const { installGtag, trackViewItem } = await fresh();
    installGtag();
    trackViewItem({ id: 'l1', name: 'Charizard', price: 120, type: 'listing', seller_id: 's1', category: 'pokemon' });
    const [e] = events().filter((x) => x.name === 'view_item');
    expect(e.params.currency).toBe('AUD');
    expect(e.params.value).toBe(120);
    expect(e.params.items[0]).toMatchObject({ item_id: 'l1', item_name: 'Charizard', price: 120, quantity: 1, item_category: 'Marketplace', item_category2: 'pokemon', affiliation: 's1' });
  });

  it('reads the cart variant price for add_to_cart and multiplies by quantity', async () => {
    const { installGtag, trackAddToCart } = await fresh();
    installGtag();
    trackAddToCart({ id: 'p1', title: 'Sleeves', type: 'shop' }, { sale_price_in_cents: 1250, title: 'Red' }, 3);
    const [e] = events().filter((x) => x.name === 'add_to_cart');
    expect(e.params.value).toBe(37.5);
    expect(e.params.items[0]).toMatchObject({ item_name: 'Sleeves', price: 12.5, quantity: 3, item_category: 'Shop', item_variant: 'Red' });
  });

  it('sends begin_checkout from raw cart entries', async () => {
    const { installGtag, trackBeginCheckout } = await fresh();
    installGtag();
    trackBeginCheckout([{ product: { id: 'a', name: 'A', price: 5 }, quantity: 2 }, { product: { id: 'b', name: 'B', price: 7.5 }, quantity: 1 }]);
    const [e] = events().filter((x) => x.name === 'begin_checkout');
    expect(e.params.value).toBe(17.5);
    expect(e.params.items).toHaveLength(2);
  });
});

describe('trackPurchase', () => {
  it('fires once per Stripe session id even if the confirmation page reloads', async () => {
    const { installGtag, trackPurchase } = await fresh();
    installGtag();
    const order = { transactionId: 'cs_test_1', value: 54.2, items: [{ id: 'x', name: 'Card', price: 50, quantity: 1 }] };
    expect(trackPurchase(order)).toBe(true);
    expect(trackPurchase(order)).toBe(false);
    const purchases = events().filter((x) => x.name === 'purchase');
    expect(purchases).toHaveLength(1);
    expect(purchases[0].params).toMatchObject({ transaction_id: 'cs_test_1', currency: 'AUD', value: 54.2 });

    // A fresh module (new page load) still respects the session marker.
    const again = await fresh();
    again.installGtag();
    expect(again.trackPurchase(order)).toBe(false);
  });

  it('does not fire without a transaction id', async () => {
    const { installGtag, trackPurchase } = await fresh();
    installGtag();
    expect(trackPurchase({ value: 10 })).toBe(false);
    expect(events().filter((x) => x.name === 'purchase')).toHaveLength(0);
  });

  it('never sends a Google Ads conversion while the ids are unset', async () => {
    const { installGtag, trackPurchase } = await fresh();
    const { setConsent, CONSENT_ALL } = await import('@/lib/consent.js');
    installGtag();
    setConsent(CONSENT_ALL);
    trackPurchase({ transactionId: 'cs_2', value: 1 });
    expect(events().filter((x) => x.name === 'conversion')).toHaveLength(0);
  });
});
