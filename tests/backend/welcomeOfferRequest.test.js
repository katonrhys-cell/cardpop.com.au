import { describe, it, expect } from 'vitest';
import { welcomeOfferUserId } from '../../src/utils/welcomeOfferRequest.js';

const UUID = '3f2c81ea-9d4b-4a17-b6c8-51e0a7d94b62';

describe('welcomeOfferUserId', () => {
  it('reads the signup page shape', () => {
    expect(welcomeOfferUserId({ userId: UUID })).toBe(UUID);
  });

  it('reads the database-webhook envelope', () => {
    expect(welcomeOfferUserId({
      type: 'INSERT',
      table: 'profiles',
      schema: 'public',
      record: { id: UUID, username: 'ash' },
      old_record: null,
    })).toBe(UUID);
  });

  it('trims and lower-cases so both callers key the rate limiter identically', () => {
    expect(welcomeOfferUserId({ userId: `  ${UUID.toUpperCase()} ` })).toBe(UUID);
    expect(welcomeOfferUserId({ record: { id: UUID.toUpperCase() } })).toBe(UUID);
  });

  it('prefers an explicit userId over a record id', () => {
    expect(welcomeOfferUserId({ userId: UUID, record: { id: '00000000-0000-0000-0000-000000000000' } })).toBe(UUID);
  });

  it('returns null for anything that is not a uuid', () => {
    for (const body of [undefined, null, {}, { userId: 'nope' }, { userId: 123 }, { record: {} }, { record: { id: 'nope' } }]) {
      expect(welcomeOfferUserId(body)).toBeNull();
    }
  });
});
