import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/utils/formatCurrency.js';

describe('formatCurrency', () => {
  it('returns an empty string when currencyInfo is missing', () => {
    expect(formatCurrency(1000, null)).toBe('');
    expect(formatCurrency(1000, undefined)).toBe('');
  });

  it('returns an empty string when the price is null or undefined', () => {
    expect(formatCurrency(null, { symbol: '$' })).toBe('');
    expect(formatCurrency(undefined, { symbol: '$' })).toBe('');
  });

  it('formats cents to two decimal places with the symbol', () => {
    expect(formatCurrency(1234, { symbol: '$' })).toBe('$12.34');
    expect(formatCurrency(1000, { symbol: '$' })).toBe('$10.00');
  });

  it('falls back to the currency code when no symbol is given', () => {
    expect(formatCurrency(500, { code: 'AUD' })).toBe('AUD5.00');
  });

  it('defaults to € when neither symbol nor code is given', () => {
    expect(formatCurrency(250, {})).toBe('€2.50');
  });

  it('applies a template, substituting $1 with the amount', () => {
    expect(formatCurrency(1999, { template: '$1 AUD' })).toBe('19.99 AUD');
    expect(formatCurrency(1999, { symbol: '$', template: 'A$$1' })).toBe('A$19.99');
  });

  it('handles a zero price', () => {
    expect(formatCurrency(0, { symbol: '$' })).toBe('$0.00');
  });
});
