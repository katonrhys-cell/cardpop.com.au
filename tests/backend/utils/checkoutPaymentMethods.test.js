import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkoutPaymentMethodTypes } from '../../../src/utils/checkoutPaymentMethods.js';

const ENV_KEY = 'STRIPE_PAYMENT_METHOD_TYPES';

describe('checkoutPaymentMethodTypes', () => {
  const original = process.env[ENV_KEY];
  beforeEach(() => { delete process.env[ENV_KEY]; });
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it('pins card and PayPal by default — no BNPL', () => {
    const types = checkoutPaymentMethodTypes();
    expect(types).toEqual(['card', 'paypal']);
    // The point of pinning: Afterpay's ~6% would sell an ordinary order at a
    // loss against a card-rate processing fee.
    expect(types).not.toContain('afterpay_clearpay');
  });

  it('accepts an env override so an inactive method can be dropped without a deploy', () => {
    process.env[ENV_KEY] = 'card';
    expect(checkoutPaymentMethodTypes()).toEqual(['card']);
  });

  it('trims and lowercases a hand-typed override', () => {
    process.env[ENV_KEY] = ' Card , PayPal ';
    expect(checkoutPaymentMethodTypes()).toEqual(['card', 'paypal']);
  });

  it('hands control back to the Stripe dashboard on "auto"', () => {
    process.env[ENV_KEY] = 'auto';
    expect(checkoutPaymentMethodTypes()).toBeNull();
  });

  it('falls back to the default for blank or junk values', () => {
    process.env[ENV_KEY] = '   ';
    expect(checkoutPaymentMethodTypes()).toEqual(['card', 'paypal']);
    process.env[ENV_KEY] = ',,,';
    expect(checkoutPaymentMethodTypes()).toEqual(['card', 'paypal']);
  });

  it('returns a fresh array each call — a caller mutating it cannot poison the default', () => {
    const first = checkoutPaymentMethodTypes();
    first.push('afterpay_clearpay');
    expect(checkoutPaymentMethodTypes()).toEqual(['card', 'paypal']);
  });
});
