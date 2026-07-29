import { describe, it, expect } from 'vitest';
import {
  parseCardNumber,
  leadingCardNumber,
  cardNumbersMatch,
  cardNumbersConflict,
} from '@/utils/cardNumber.js';

describe('parseCardNumber', () => {
  it('splits the card number from the set total', () => {
    expect(parseCardNumber('4/102')).toEqual({ value: '4', total: '102' });
  });

  it('strips leading zeros and punctuation', () => {
    expect(parseCardNumber('004/102')).toEqual({ value: '4', total: '102' });
    expect(parseCardNumber('#25')).toEqual({ value: '25', total: '' });
  });

  it('handles set-code numbers with no total', () => {
    expect(parseCardNumber('SWSH114')).toEqual({ value: 'swsh114', total: '' });
    expect(parseCardNumber('TG12/TG30')).toEqual({ value: 'tg12', total: 'tg30' });
  });

  it('is safe on missing input', () => {
    expect(parseCardNumber(null)).toEqual({ value: '', total: '' });
    expect(parseCardNumber(undefined)).toEqual({ value: '', total: '' });
    expect(parseCardNumber('')).toEqual({ value: '', total: '' });
  });
});

describe('leadingCardNumber', () => {
  it('returns the card number without the total', () => {
    expect(leadingCardNumber('4/102')).toBe('4');
    expect(leadingCardNumber('004/102')).toBe('4');
    expect(leadingCardNumber('SWSH114')).toBe('swsh114');
  });

  it('returns an empty string when unreadable', () => {
    expect(leadingCardNumber(null)).toBe('');
    expect(leadingCardNumber('---')).toBe('');
  });
});

describe('cardNumbersMatch', () => {
  it('matches the same card written differently', () => {
    expect(cardNumbersMatch('4/102', '4')).toBe(true);
    expect(cardNumbersMatch('004/102', '4/102')).toBe(true);
    expect(cardNumbersMatch('#4', '4')).toBe(true);
  });

  it('distinguishes the same number from different sets', () => {
    // Both are card 4 — of different sets. A leading-digits-only comparison
    // calls these equal, which lets a wrong-set candidate corroborate a match.
    expect(cardNumbersMatch('4/102', '4/165')).toBe(false);
  });

  it('does not match different numbers', () => {
    expect(cardNumbersMatch('4/102', '11/102')).toBe(false);
  });

  it('treats an unreadable number as not a match', () => {
    expect(cardNumbersMatch('4/102', null)).toBe(false);
    expect(cardNumbersMatch(null, '4')).toBe(false);
    expect(cardNumbersMatch(null, null)).toBe(false);
  });
});

describe('cardNumbersConflict', () => {
  it('reports a positive disagreement', () => {
    expect(cardNumbersConflict('4/102', '11')).toBe(true);
    expect(cardNumbersConflict('4/102', '4/165')).toBe(true);
  });

  it('is false when the numbers agree', () => {
    expect(cardNumbersConflict('4/102', '4')).toBe(false);
  });

  it('is false when either side is unknown — unknown is not a conflict', () => {
    // A candidate with no number on record must stay eligible; only a number
    // that positively disagrees disqualifies it.
    expect(cardNumbersConflict('4/102', null)).toBe(false);
    expect(cardNumbersConflict(null, '4')).toBe(false);
  });
});
