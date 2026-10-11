import { describe, it, expect } from 'vitest';
import {
  marketplaceGate, marketplaceSubtotalAud, identityRequiredForAmount, normaliseIdentityThreshold, hasMarketplaceLine,
} from '@/utils/marketplaceIdentity.js';

const listing = (price) => ({ product: { type: 'listing', price }, quantity: 1 });
const shop = (price, qty = 1) => ({ product: { type: 'shop', price }, quantity: qty });

describe('marketplaceSubtotalAud', () => {
  it('counts listings only, once each, and treats untyped lines as listings', () => {
    expect(marketplaceSubtotalAud([listing(100), shop(30, 4), { product: { price: 20 } }])).toBe(120);
  });
  it('accepts flat lines', () => {
    expect(marketplaceSubtotalAud([{ type: 'listing', price_aud: 12.5 }])).toBe(12.5);
  });
});

describe('normaliseIdentityThreshold', () => {
  it('defaults when unset or nonsense, keeps 0 and admin strings', () => {
    expect(normaliseIdentityThreshold(undefined)).toBe(500);
    expect(normaliseIdentityThreshold('abc')).toBe(500);
    expect(normaliseIdentityThreshold(-1)).toBe(500);
    expect(normaliseIdentityThreshold('250')).toBe(250);
    expect(normaliseIdentityThreshold(0)).toBe(0);
  });
});

describe('identityRequiredForAmount', () => {
  it('is inclusive at the threshold and always true at threshold 0', () => {
    expect(identityRequiredForAmount(499.99, 500)).toBe(false);
    expect(identityRequiredForAmount(500, 500)).toBe(true);
    expect(identityRequiredForAmount(1, 0)).toBe(true);
  });
});

describe('marketplaceGate', () => {
  it('is open for shop-only carts whoever the buyer is', () => {
    expect(marketplaceGate({ lines: [shop(900)], thresholdAud: 500, isAuthenticated: false })).toBe('open');
  });
  it('asks a guest for an account on any listing', () => {
    expect(marketplaceGate({ lines: [listing(10)], thresholdAud: 500, isAuthenticated: false })).toBe('account');
  });
  it('lets an unverified member buy under the threshold', () => {
    expect(marketplaceGate({ lines: [listing(10)], thresholdAud: 500, isAuthenticated: true, isIdentityVerified: false })).toBe('open');
  });
  it('asks for ID at or over the threshold unless verified', () => {
    expect(marketplaceGate({ lines: [listing(300), listing(200)], thresholdAud: 500, isAuthenticated: true, isIdentityVerified: false })).toBe('identity');
    expect(marketplaceGate({ lines: [listing(300), listing(200)], thresholdAud: 500, isAuthenticated: true, isIdentityVerified: true })).toBe('open');
  });
});

describe('Official CardPop Store listings', () => {
  const official = { product: { type: 'listing', price: 900, officialStore: true }, quantity: 1 };
  const community = { product: { type: 'listing', price: 900 }, quantity: 1 };

  it('are not marketplace lines: a guest meets no gate', () => {
    expect(hasMarketplaceLine([official])).toBe(false);
    expect(marketplaceSubtotalAud([official])).toBe(0);
    expect(marketplaceGate({ lines: [official], thresholdAud: 500, isAuthenticated: false, isIdentityVerified: false })).toBe('open');
  });

  it('do not count towards the identity threshold of a mixed cart', () => {
    const small = { product: { type: 'listing', price: 100 }, quantity: 1 };
    expect(marketplaceSubtotalAud([official, small])).toBe(100);
    expect(marketplaceGate({ lines: [official, small], thresholdAud: 500, isAuthenticated: true, isIdentityVerified: false })).toBe('open');
  });

  it('never loosen a community listing, alone or alongside an official one', () => {
    expect(marketplaceGate({ lines: [community], thresholdAud: 500, isAuthenticated: false, isIdentityVerified: false })).toBe('account');
    expect(marketplaceGate({ lines: [official, community], thresholdAud: 500, isAuthenticated: true, isIdentityVerified: false })).toBe('identity');
  });

  it('only a literal officialStore: true counts', () => {
    const spoof = { product: { type: 'listing', price: 900, officialStore: 'yes' }, quantity: 1 };
    expect(hasMarketplaceLine([spoof])).toBe(true);
  });
});
