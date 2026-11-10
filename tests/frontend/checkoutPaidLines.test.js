import { describe, it, expect, beforeEach } from 'vitest';
import { cartLineKey, rememberPaidLines, takePaidLines } from '@/lib/checkoutPaidLines.js';

describe('checkoutPaidLines', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('keys a line the way useCart.removeFromCart does (variant id, else product id)', () => {
    expect(cartLineKey({ product: { id: 'p1' } })).toBe('p1');
    expect(cartLineKey({ product: { id: 'p1' }, variant: { id: 'v1' } })).toBe('v1');
  });

  it('hands back exactly the lines that were paid for, once', () => {
    rememberPaidLines([{ product: { id: 'shop-1' } }, { product: { id: 'shop-2' }, variant: { id: 'var-2' } }]);
    expect(takePaidLines()).toEqual(['shop-1', 'var-2']);
    expect(takePaidLines()).toBeNull();
  });

  it('answers null (caller clears the whole cart) when nothing usable was recorded', () => {
    expect(takePaidLines()).toBeNull();
    window.sessionStorage.setItem('cardpop:checkout:paid-lines', 'not json');
    expect(takePaidLines()).toBeNull();
    rememberPaidLines([]);
    expect(takePaidLines()).toBeNull();
  });
});
