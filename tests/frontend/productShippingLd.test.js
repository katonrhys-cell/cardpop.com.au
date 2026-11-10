import { describe, it, expect } from 'vitest';
import {
  SHOP_SHIPPING_DEFAULTS,
  SHOP_DELIVERY_TIMES,
  shopShippingTerms,
  shopShippingRateAud,
  shopShippingDetailsLd,
  marketplaceShippingDetailsLd,
} from '../../utils/productShippingLd.js';
import { MARKETPLACE_PROTECTION } from '../../utils/buyerProtectionPolicy.js';

describe('shopShippingTerms', () => {
  it('reads the public settings shape, numbers or numeric strings', () => {
    expect(shopShippingTerms({ default_shipping_rate_aud: '12.5', free_shipping_threshold_aud: 80 }))
      .toEqual({ rateAud: 12.5, freeThresholdAud: 80 });
  });

  it('falls back per field to the checkout defaults', () => {
    expect(shopShippingTerms(null)).toEqual(SHOP_SHIPPING_DEFAULTS);
    expect(shopShippingTerms({ default_shipping_rate_aud: null, free_shipping_threshold_aud: 'free' }))
      .toEqual(SHOP_SHIPPING_DEFAULTS);
    expect(shopShippingTerms({ default_shipping_rate_aud: -1, free_shipping_threshold_aud: '' }))
      .toEqual(SHOP_SHIPPING_DEFAULTS);
    expect(shopShippingTerms({ default_shipping_rate_aud: 0 })).toEqual({ rateAud: 0, freeThresholdAud: 100 });
  });
});

describe('shopShippingRateAud', () => {
  it('charges the flat rate below the threshold and nothing from it', () => {
    expect(shopShippingRateAud(99.99)).toBe(15);
    expect(shopShippingRateAud(100)).toBe(0);
    expect(shopShippingRateAud(30, { rateAud: 9, freeThresholdAud: 25 })).toBe(0);
    expect(shopShippingRateAud(20, { rateAud: 9, freeThresholdAud: 25 })).toBe(9);
  });
});

describe('shopShippingDetailsLd', () => {
  it('is a Google-shaped OfferShippingDetails for Australia in business days', () => {
    const ld = shopShippingDetailsLd(30);
    expect(ld['@type']).toBe('OfferShippingDetails');
    expect(ld.shippingRate).toEqual({ '@type': 'MonetaryAmount', value: 15, currency: 'AUD' });
    expect(ld.shippingDestination).toEqual({ '@type': 'DefinedRegion', addressCountry: 'AU' });
    expect(ld.deliveryTime['@type']).toBe('ShippingDeliveryTime');
    expect(ld.deliveryTime.businessDays.dayOfWeek).toHaveLength(5);
    expect(ld.deliveryTime.handlingTime).toMatchObject({ minValue: 0, maxValue: SHOP_DELIVERY_TIMES.dispatchBusinessDays, unitCode: 'DAY' });
    expect(ld.deliveryTime.transitTime).toMatchObject({
      minValue: SHOP_DELIVERY_TIMES.transitMinBusinessDays, maxValue: SHOP_DELIVERY_TIMES.transitMaxBusinessDays, unitCode: 'DAY',
    });
  });

  it('quotes free shipping for a product over the threshold', () => {
    expect(shopShippingDetailsLd(150).shippingRate.value).toBe(0);
  });
});

describe('marketplaceShippingDetailsLd', () => {
  it("quotes the seller's postage and the Buyer Protection posting window", () => {
    const ld = marketplaceShippingDetailsLd('8.5');
    expect(ld.shippingRate.value).toBe(8.5);
    expect(ld.deliveryTime.handlingTime.maxValue).toBe(MARKETPLACE_PROTECTION.notShippedClaimAfterDays);
    expect(ld.deliveryTime.businessDays).toBeUndefined();
  });

  it('treats missing postage as free', () => {
    expect(marketplaceShippingDetailsLd(null).shippingRate.value).toBe(0);
  });
});
