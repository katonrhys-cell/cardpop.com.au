import { describe, it, expect } from 'vitest';
import { checkAustralianAddress, AU_STATES } from '../../../src/utils/addressValidation.js';

describe('checkAustralianAddress', () => {
  it('accepts an address in every Australian state and territory', () => {
    for (const state of AU_STATES) {
      expect(checkAustralianAddress({ state, postcode: '2000' })).toEqual({ valid: true });
    }
  });

  it('accepts a lowercase state and any spelling of the country', () => {
    for (const country of ['AU', 'aus', 'Australia', undefined, '']) {
      expect(checkAustralianAddress({ state: 'nsw', postcode: '2000', country })).toEqual({ valid: true });
    }
  });

  it('refuses an overseas state or province', () => {
    expect(checkAustralianAddress({ state: 'TX', postcode: '73301' }).reason).toBe('state');
    expect(checkAustralianAddress({ state: 'ON', postcode: '1234' }).reason).toBe('state');
  });

  it('refuses an explicitly non-Australian country even when the rest looks local', () => {
    // New Zealand shares no state codes with Australia, but a spoofed payload
    // could pair a valid-looking AU state with an overseas country.
    expect(checkAustralianAddress({ state: 'NSW', postcode: '2000', country: 'NZ' }).reason).toBe('country');
    expect(checkAustralianAddress({ state: 'NSW', postcode: '2000', country: 'United States' }).reason).toBe('country');
  });

  it('refuses a postcode that is not four digits', () => {
    for (const postcode of ['200', '20000', 'SW1A', '2000 ', undefined, '']) {
      const result = checkAustralianAddress({ state: 'NSW', postcode });
      if (postcode === '2000 ') expect(result.valid).toBe(true); // trimmed
      else expect(result.reason).toBe('postcode');
    }
  });

  it('refuses an empty address rather than defaulting to valid', () => {
    expect(checkAustralianAddress({}).valid).toBe(false);
    expect(checkAustralianAddress().valid).toBe(false);
  });
});
