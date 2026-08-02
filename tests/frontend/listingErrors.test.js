import { describe, it, expect } from 'vitest';
import { isSellingEntitlementError, isListingQuotaError } from '@/utils/listingErrors.js';

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

describe('isListingQuotaError', () => {
  it('recognises the monthly quota trigger by its message marker', () => {
    expect(
      isListingQuotaError({
        code: 'P0001',
        message: 'LISTING_QUOTA_EXCEEDED: your plan allows 5 new listings per calendar month and you have used 5. Upgrade your membership to list more this month.',
      })
    ).toBe(true);
  });

  it('is not confused with the selling-entitlement (RLS) error', () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy for table "listings"' };
    expect(isListingQuotaError(rls)).toBe(false);
    expect(isSellingEntitlementError({ message: 'LISTING_QUOTA_EXCEEDED: limit reached' })).toBe(false);
  });

  it('rejects unrelated errors and missing input', () => {
    expect(isListingQuotaError({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(isListingQuotaError(null)).toBe(false);
    expect(isListingQuotaError(undefined)).toBe(false);
    expect(isListingQuotaError({})).toBe(false);
  });
});
