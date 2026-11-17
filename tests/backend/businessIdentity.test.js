import { describe, it, expect } from 'vitest';
import { businessIdentityLine, businessIdentityShort, cleanBusinessIdentity, hasBusinessIdentity } from '../../utils/businessIdentity.js';
import { TERMS_SECTIONS, TERMS_UPDATED, TERMS_UPDATED_LABEL } from '../../data/termsOfService.js';
import { MARKETPLACE_PROTECTION } from '../../utils/buyerProtectionPolicy.js';
import { SHOP_RETURN_POLICY } from '../../utils/shopReturnPolicy.js';
import { TIER_PRICES_AUD } from '../../config/subscription.js';

describe('business identity (legal name + ABN)', () => {
  it('publishes the name and a checksum-valid ABN and nothing else', () => {
    expect(cleanBusinessIdentity({
      legal_name: '  Example Cards   Pty Ltd ', abn: '51824753556',
      address: '1 Private St', phone: '0400 000 000', email: 'a@b.c', footer_note: 'x',
    })).toEqual({ legal_name: 'Example Cards Pty Ltd', abn: '51 824 753 556' });
  });

  it('never shows a blank, half-typed or invalid ABN', () => {
    for (const abn of ['', '5182475355', '12 345 678 901', null, undefined]) {
      expect(businessIdentityLine({ legal_name: 'Example Pty Ltd', abn })).toBeNull();
      expect(businessIdentityShort({ legal_name: 'Example Pty Ltd', abn })).toBeNull();
      expect(hasBusinessIdentity({ abn })).toBe(false);
    }
    expect(businessIdentityLine(null)).toBeNull();
    expect(businessIdentityLine('51824753556')).toBeNull();
  });

  it('words the line with and without a distinct legal name', () => {
    expect(businessIdentityLine({ legal_name: 'Example Pty Ltd', abn: '51 824 753 556' }))
      .toBe('CardPop Australia™ is operated by Example Pty Ltd (ABN 51 824 753 556).');
    expect(businessIdentityLine({ legal_name: 'CardPop', abn: '51824753556' })).toBe('CardPop Australia™ — ABN 51 824 753 556.');
    expect(businessIdentityShort({ legal_name: 'Example Pty Ltd', abn: '51824753556' })).toBe('Example Pty Ltd · ABN 51 824 753 556');
    expect(businessIdentityShort({ legal_name: '', abn: '51824753556' })).toBe('ABN 51 824 753 556');
  });
});

describe('terms of service document', () => {
  const text = JSON.stringify(TERMS_SECTIONS);

  it('quotes every policy figure from its source', () => {
    expect(text).toContain(`within ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days of delivery`);
    expect(text).toContain(`within ${MARKETPLACE_PROTECTION.hardCapDaysFromPurchase} days of purchase`);
    expect(text).toContain(`within ${SHOP_RETURN_POLICY.windowDays} days of delivery`);
    expect(text).toContain(`$${TIER_PRICES_AUD.pro} a year`);
    expect(text).toContain(`$${TIER_PRICES_AUD.ultimate} a year`);
  });

  it('is a real document: numbered sections, each with content, and the consumer-law carve-out', () => {
    expect(TERMS_SECTIONS.length).toBeGreaterThanOrEqual(15);
    TERMS_SECTIONS.forEach((section, i) => {
      expect(section.h2.startsWith(`${i + 1}. `)).toBe(true);
      expect((section.paras?.length || 0) + (section.items?.length || 0)).toBeGreaterThan(0);
    });
    expect(text).toMatch(/Australian Consumer Law/);
    expect(text.split(/\s+/).length).toBeGreaterThan(1500);
    // Honest copy rules from docs/adsense-readiness.md.
    expect(text).not.toMatch(/escrow|thousands of|premier/i);
  });

  it('carries a real updated date', () => {
    expect(TERMS_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TERMS_UPDATED_LABEL).toContain(TERMS_UPDATED.slice(0, 4));
  });
});
