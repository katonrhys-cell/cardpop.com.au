import { describe, it, expect } from 'vitest';
import { shopPriceInfo, shopSellingPrice, shopFromPriceInfo } from '@/utils/shopPricing.js';

describe('shopPriceInfo', () => {
  it('sells at the regular price with no sale, and strikes nothing through when it equals the RRP', () => {
    const info = shopPriceInfo({ price_aud: 14.95, retail_price_aud: 14.95 });
    expect(info).toMatchObject({ price: 14.95, onSale: false, was: null, percentOff: null });
  });

  it('applies a sale price below the regular price and strikes the RRP through', () => {
    const info = shopPriceInfo({ price_aud: 14.95, retail_price_aud: 14.95, sale_price_aud: 11.95 });
    expect(info).toMatchObject({ price: 11.95, regular: 14.95, sale: 11.95, was: 14.95, wasIsRrp: true, onSale: true, percentOff: 20 });
  });

  it('ignores a sale price that is zero, blank, or not below the regular price', () => {
    for (const sale of [0, '', null, 14.95, 20]) {
      const info = shopPriceInfo({ price_aud: 14.95, sale_price_aud: sale });
      expect(info.onSale).toBe(false);
      expect(info.price).toBe(14.95);
    }
  });

  it('strikes through the regular price when there is no RRP', () => {
    const info = shopPriceInfo({ price_aud: 10, sale_price_aud: 8 });
    expect(info).toMatchObject({ price: 8, was: 10, wasIsRrp: false, onSale: true });
  });

  it('keeps showing an RRP above the regular price even without a sale', () => {
    const info = shopPriceInfo({ price_aud: 9, retail_price_aud: 12 });
    expect(info).toMatchObject({ price: 9, was: 12, wasIsRrp: true, onSale: false });
  });

  it('a variant that inherits the product price inherits the product sale', () => {
    const product = { price_aud: 14.95, sale_price_aud: 12 };
    expect(shopSellingPrice(product, { id: 'v1', price_aud: null })).toBe(12);
  });

  it('a variant with its own price uses only its own sale price', () => {
    const product = { price_aud: 14.95, sale_price_aud: 12 };
    expect(shopSellingPrice(product, { id: 'v1', price_aud: 16.95 })).toBe(16.95);
    expect(shopSellingPrice(product, { id: 'v1', price_aud: 16.95, sale_price_aud: 13.95 })).toBe(13.95);
  });

  it('shopFromPriceInfo picks the cheapest active variant', () => {
    const product = {
      price_aud: 14.95,
      variants: [
        { id: 'a', price_aud: 16.95, status: 'active' },
        { id: 'b', price_aud: null, sale_price_aud: 9.95, status: 'active' },
        { id: 'c', price_aud: 1, status: 'archived' },
      ],
    };
    expect(shopFromPriceInfo(product).price).toBe(9.95);
  });
});
