import { describe, it, expect } from 'vitest';
import { syncWholesaleCost, costPairInSync } from '@/utils/wholesaleCost.js';

describe('syncWholesaleCost', () => {
  it('fills inc GST as the ex GST cost is typed', () => {
    expect(syncWholesaleCost({ ex: '', inc: '' }, 'ex', '1.00')).toEqual({ ex: '1.00', inc: '1.10' });
    expect(syncWholesaleCost({ ex: '', inc: '' }, 'ex', '4.5')).toEqual({ ex: '4.5', inc: '4.95' });
  });

  it('fills ex GST as the inc GST cost is typed', () => {
    expect(syncWholesaleCost({ ex: '', inc: '' }, 'inc', '66')).toEqual({ ex: '60.00', inc: '66' });
  });

  it('keeps following while the pair is still the worked-out one', () => {
    const a = syncWholesaleCost({ ex: '', inc: '' }, 'ex', '1');
    const b = syncWholesaleCost(a, 'ex', '12');
    expect(b).toEqual({ ex: '12', inc: '13.20' });
    expect(syncWholesaleCost(b, 'inc', '11')).toEqual({ ex: '10.00', inc: '11' });
  });

  it('clears the other side when the field is emptied', () => {
    expect(syncWholesaleCost({ ex: '1.00', inc: '1.10' }, 'ex', '')).toEqual({ ex: '', inc: '' });
  });

  it('leaves a deliberately different pair alone', () => {
    // GST-free supplier: ex = inc.
    expect(syncWholesaleCost({ ex: '5.00', inc: '5.00' }, 'ex', '6.00')).toEqual({ ex: '6.00', inc: '5.00' });
    expect(syncWholesaleCost({ ex: '5.00', inc: '5.00' }, 'ex', '')).toEqual({ ex: '', inc: '5.00' });
  });

  it('does not write a figure for something that is not an amount', () => {
    expect(syncWholesaleCost({ ex: '', inc: '' }, 'ex', '-')).toEqual({ ex: '-', inc: '' });
  });
});

describe('costPairInSync', () => {
  it('accepts either rounding direction', () => {
    expect(costPairInSync('1', '1.10')).toBe(true);
    expect(costPairInSync('0.45', '0.5')).toBe(true); // 0.50 / 1.1 = 0.4545
    expect(costPairInSync('5', '5')).toBe(false);
    expect(costPairInSync('', '5')).toBe(false);
  });
});
