import { describe, it, expect } from 'vitest';
import {
  buildSellerAccountParams,
  isPayoutReady,
  payoutAccountName,
} from '../../../src/utils/sellerAccountShape.js';

describe('buildSellerAccountParams', () => {
  it('builds an AU Express account requesting card_payments + transfers', () => {
    const params = buildSellerAccountParams('user-1', { email: 'seller@x.com', displayName: 'Ash Cards' });
    expect(params).toMatchObject({
      type: 'express',
      country: 'AU',
      email: 'seller@x.com',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: { name: 'Ash Cards' },
      metadata: { cardpop_user_id: 'user-1' },
    });
  });

  it('omits email and business_profile when not supplied', () => {
    const params = buildSellerAccountParams('user-2');
    expect(params).not.toHaveProperty('email');
    expect(params).not.toHaveProperty('business_profile');
    expect(params.metadata.cardpop_user_id).toBe('user-2');
    // capabilities are always requested regardless of optional fields
    expect(params.capabilities.transfers.requested).toBe(true);
  });
});

describe('isPayoutReady', () => {
  it('is true only when payouts are enabled AND transfers is active', () => {
    expect(isPayoutReady({ payouts_enabled: true, capabilities: { transfers: 'active' } })).toBe(true);
  });

  it('is false when payouts are disabled', () => {
    expect(isPayoutReady({ payouts_enabled: false, capabilities: { transfers: 'active' } })).toBe(false);
  });

  it('is false when the transfers capability is not active', () => {
    expect(isPayoutReady({ payouts_enabled: true, capabilities: { transfers: 'pending' } })).toBe(false);
  });

  it('reads defensively — false for null/empty account', () => {
    expect(isPayoutReady(null)).toBe(false);
    expect(isPayoutReady(undefined)).toBe(false);
    expect(isPayoutReady({})).toBe(false);
  });
});

describe('payoutAccountName', () => {
  it('joins an individual first + last name', () => {
    expect(payoutAccountName({ individual: { first_name: 'Ash', last_name: 'Ketchum' } })).toBe('Ash Ketchum');
  });

  it('handles a first name only (no trailing space)', () => {
    expect(payoutAccountName({ individual: { first_name: 'Ash' } })).toBe('Ash');
  });

  it('falls back to the company legal name for a business account', () => {
    expect(payoutAccountName({ company: { name: 'Cardpop Pty Ltd' } })).toBe('Cardpop Pty Ltd');
  });

  it('prefers the individual name over the company name when both exist', () => {
    expect(payoutAccountName({
      individual: { first_name: 'Ash', last_name: 'Ketchum' },
      company: { name: 'Cardpop Pty Ltd' },
    })).toBe('Ash Ketchum');
  });

  it('returns an empty string when Stripe holds neither yet', () => {
    expect(payoutAccountName({})).toBe('');
    expect(payoutAccountName(null)).toBe('');
  });
});
