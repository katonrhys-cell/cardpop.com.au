import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isCardCountryAllowed, allowedCardCountries } from '../../../src/utils/cardCountryPolicy.js';

const ENV_KEY = 'ALLOWED_CARD_COUNTRIES';

describe('cardCountryPolicy', () => {
  const original = process.env[ENV_KEY];
  beforeEach(() => { delete process.env[ENV_KEY]; });
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it('allows Australia and nothing else by default', () => {
    expect(allowedCardCountries()).toEqual(['AU']);
    expect(isCardCountryAllowed('AU')).toBe(true);
    expect(isCardCountryAllowed('US')).toBe(false);
    expect(isCardCountryAllowed('NZ')).toBe(false);
    expect(isCardCountryAllowed('GB')).toBe(false);
  });

  it('is case- and whitespace-insensitive about the code Stripe reports', () => {
    expect(isCardCountryAllowed('au')).toBe(true);
    expect(isCardCountryAllowed(' Au ')).toBe(true);
  });

  it('ALLOWS an unknown country rather than refunding a good payment', () => {
    // Stripe reports no country for some methods (PayPal, various wallets).
    // Failing closed there would refund perfectly good domestic payments over a
    // field Stripe simply never populated.
    expect(isCardCountryAllowed(null)).toBe(true);
    expect(isCardCountryAllowed(undefined)).toBe(true);
    expect(isCardCountryAllowed('')).toBe(true);
  });

  it('accepts a widened list without a deploy', () => {
    process.env[ENV_KEY] = 'AU,NZ';
    expect(isCardCountryAllowed('NZ')).toBe(true);
    expect(isCardCountryAllowed('US')).toBe(false);
  });

  it('switches the check off entirely on "any"', () => {
    process.env[ENV_KEY] = 'any';
    expect(allowedCardCountries()).toEqual([]);
    expect(isCardCountryAllowed('US')).toBe(true);
  });

  it('falls back to Australia for a blank or junk value', () => {
    process.env[ENV_KEY] = '   ';
    expect(isCardCountryAllowed('US')).toBe(false);
    process.env[ENV_KEY] = ',,,';
    expect(isCardCountryAllowed('US')).toBe(false);
  });
});
