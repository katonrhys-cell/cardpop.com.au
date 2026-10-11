import { describe, it, expect } from 'vitest';
import { SHOP_RETURN_POLICY, shopMerchantReturnPolicyLd } from '@/utils/shopReturnPolicy.js';

// These values are registered in Google Merchant Center → Returns. If this test
// needs changing, change Merchant Center at the same time.
describe('shop return policy', () => {
  it('matches the Merchant Center settings', () => {
    expect(SHOP_RETURN_POLICY).toMatchObject({
      country: 'AU',
      windowDays: 14,
      refundProcessingDays: 7,
      acceptsChangeOfMind: true,
      acceptsExchanges: true,
      restockingFee: 0,
    });
  });

  it('emits a schema.org MerchantReturnPolicy with the same terms', () => {
    expect(shopMerchantReturnPolicyLd()).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'AU',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 14,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      itemCondition: 'https://schema.org/NewCondition',
      merchantReturnLink: 'https://cardpop.com.au/returns',
    });
  });
});
