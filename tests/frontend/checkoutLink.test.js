import { describe, it, expect } from 'vitest';
import {
  MERCHANT_CHECKOUT_LINK_TEMPLATE, CHECKOUT_LINK_MAX_QUANTITY,
  parseCheckoutLinkParams, isUuid, normaliseSku, shopRowToCartLine, listingRowToCartLine,
} from '@/utils/checkoutLink.js';
import { toCartVariant } from '@/utils/shopVariants.js';
import { preorderCartFields, hasUnlimitedStock } from '@/utils/shopStock.js';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('MERCHANT_CHECKOUT_LINK_TEMPLATE', () => {
  it("carries Google's required {id} placeholder and the optional {quantity}, on our checkout page", () => {
    expect(MERCHANT_CHECKOUT_LINK_TEMPLATE).toContain('{id}');
    expect(MERCHANT_CHECKOUT_LINK_TEMPLATE).toContain('{quantity}');
    expect(MERCHANT_CHECKOUT_LINK_TEMPLATE.startsWith('https://cardpop.com.au/checkout?')).toBe(true);
  });
});

describe('parseCheckoutLinkParams', () => {
  const params = (s) => new URLSearchParams(s);

  it('returns null without an id', () => {
    expect(parseCheckoutLinkParams(params(''))).toBeNull();
    expect(parseCheckoutLinkParams(params('id=%20'))).toBeNull();
    expect(parseCheckoutLinkParams(params('quantity=2'))).toBeNull();
  });

  it('ignores an un-substituted placeholder', () => {
    expect(parseCheckoutLinkParams(params('id={id}&quantity={quantity}'))).toBeNull();
  });

  it('reads the id and clamps the quantity', () => {
    expect(parseCheckoutLinkParams(params('id=CP-ABC&quantity=3'))).toEqual({ id: 'CP-ABC', quantity: 3, isUuid: false });
    expect(parseCheckoutLinkParams(params('id=CP-ABC'))).toMatchObject({ quantity: 1 });
    expect(parseCheckoutLinkParams(params('id=CP-ABC&quantity=0'))).toMatchObject({ quantity: 1 });
    expect(parseCheckoutLinkParams(params('id=CP-ABC&quantity=-4'))).toMatchObject({ quantity: 1 });
    expect(parseCheckoutLinkParams(params('id=CP-ABC&quantity=abc'))).toMatchObject({ quantity: 1 });
    expect(parseCheckoutLinkParams(params('id=CP-ABC&quantity=999'))).toMatchObject({ quantity: CHECKOUT_LINK_MAX_QUANTITY });
  });

  it('flags a UUID id', () => {
    expect(parseCheckoutLinkParams(params(`id=${UUID}`))).toMatchObject({ id: UUID, isUuid: true });
  });

  it('rejects an absurdly long id', () => {
    expect(parseCheckoutLinkParams(params(`id=${'x'.repeat(200)}`))).toBeNull();
  });
});

describe('isUuid / normaliseSku', () => {
  it('recognises UUIDs case-insensitively', () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid(UUID.toUpperCase())).toBe(true);
    expect(isUuid('CP-ABC')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
  it('upper-cases and trims SKUs', () => {
    expect(normaliseSku('  cp-abc ')).toBe('CP-ABC');
  });
});

describe('shopRowToCartLine', () => {
  const row = { id: UUID, title: 'Binder', price_aud: 34.95, stock_quantity: 5, status: 'active', images: ['shop/a.webp'] };

  it('builds the cart product + variant the product pages build', () => {
    const line = shopRowToCartLine(row, { quantity: 2, resolveImage: (p) => `https://cdn/${p}` });
    expect(line.product).toEqual({ id: UUID, source: 'shop', type: 'shop', title: 'Binder', price: 34.95, image: 'https://cdn/shop/a.webp' });
    expect(line.variant).toEqual({ id: UUID, price_in_cents: 3495, manage_inventory: true, inventory_quantity: 5 });
    expect(line.quantity).toBe(2);
    expect(line.availableQuantity).toBe(5);
  });

  it('falls back to image_url and an unmanaged stock when stock is null', () => {
    const line = shopRowToCartLine({ ...row, images: [], image_url: 'x.png', stock_quantity: null });
    expect(line.product.image).toBe('x.png');
    expect(line.variant.manage_inventory).toBe(false);
    expect(line.availableQuantity).toBe(999);
  });

  it('labels and uncaps a pre-order', () => {
    const line = shopRowToCartLine({ ...row, status: 'preorder', preorder_eta: 'Late November', stock_quantity: 0 }, {
      preorderFields: preorderCartFields, isUnlimited: hasUnlimitedStock,
    });
    expect(line.product).toMatchObject({ preorder: true, preorderEta: 'Late November' });
    expect(line.variant.manage_inventory).toBe(false);
  });

  it('uses the chosen colour variant for identity, price and stock', () => {
    const variant = { id: 'v1', sku: 'TOP-09-GRN', colour: 'Green', stock_quantity: 3, price_aud: 39.95, status: 'active' };
    const line = shopRowToCartLine(row, { variant, toCartVariant });
    expect(line.product.title).toBe('Binder — Green');
    expect(line.product.price).toBe(39.95);
    expect(line.variant).toMatchObject({ id: 'v1', variant_id: 'v1', sku: 'TOP-09-GRN', price_in_cents: 3995, inventory_quantity: 3 });
    expect(line.availableQuantity).toBe(3);
  });

  it('returns null for no row', () => {
    expect(shopRowToCartLine(null)).toBeNull();
  });
});

describe('listingRowToCartLine', () => {
  const listing = {
    id: UUID, status: 'active', listing_type: 'fixed', price_aud: 120,
    vault_item: { card_name: 'Pikachu', set_name: 'Jungle', grade: '9', grading_company: 'PSA', card_images: ['cards/p.jpg'] },
  };

  it('builds a quantity-1 listing line', () => {
    const line = listingRowToCartLine(listing, { resolveImage: (p) => `https://cdn/${p}` });
    expect(line.product).toMatchObject({ id: UUID, type: 'listing', source: 'marketplace', title: 'Pikachu', price: 120, image: 'https://cdn/cards/p.jpg', set: 'Jungle', grade: '9', grading_company: 'PSA' });
    expect(line.product.officialStore).toBeUndefined();
    expect(line.variant).toBeNull();
    expect(line.quantity).toBe(1);
  });

  it('marks an Official CardPop Store listing so the identity gate skips it', () => {
    expect(listingRowToCartLine({ ...listing, seller: { is_admin: true } }).product.officialStore).toBe(true);
  });

  it('refuses anything that is not an active buy-now listing', () => {
    expect(listingRowToCartLine(null)).toBeNull();
    expect(listingRowToCartLine({ ...listing, status: 'sold' })).toBeNull();
    expect(listingRowToCartLine({ ...listing, listing_type: 'auction' })).toBeNull();
    expect(listingRowToCartLine({ ...listing, listing_type: 'trade' })).toBeNull();
    expect(listingRowToCartLine({ ...listing, listing_type: 'expression_of_interest' })).toBeNull();
  });

  it('accepts object-shaped card images and a single card_image', () => {
    expect(listingRowToCartLine({ ...listing, vault_item: { card_name: 'A', card_images: [{ url: 'u.jpg' }] } }).product.image).toBe('u.jpg');
    expect(listingRowToCartLine({ ...listing, vault_item: { card_name: 'A', card_image: 'c.jpg' } }).product.image).toBe('c.jpg');
  });
});
