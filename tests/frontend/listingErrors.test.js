import { describe, it, expect } from 'vitest';
import { isSellingEntitlementError } from '@/utils/listingErrors.js';

describe('isSellingEntitlementError', () => {
  it('recognises the Postgres insufficient-privilege code', () => {
    expect(isSellingEntitlementError({ code: '42501', message: 'permission denied' })).toBe(true);
  });

  it('recognises an RLS violation by message when no code is present', () => {
    expect(
      isSellingEntitlementError({ message: 'new row violates row-level security policy for table "listings"' })
    ).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(isSellingEntitlementError({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(isSellingEntitlementError({ message: 'network error' })).toBe(false);
  });

  it('handles missing input safely', () => {
    expect(isSellingEntitlementError(null)).toBe(false);
    expect(isSellingEntitlementError(undefined)).toBe(false);
    expect(isSellingEntitlementError({})).toBe(false);
  });
});
