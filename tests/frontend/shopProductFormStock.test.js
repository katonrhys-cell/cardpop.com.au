import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: null }) }));

import { stockEdited } from '@/components/ShopProductForm.jsx';

// Saving the edit form must not write back the stock that was loaded when it
// opened — sales made meanwhile would be restored (oversell).
describe('ShopProductForm stockEdited', () => {
  it('is false when the admin left stock as loaded', () => {
    expect(stockEdited('5', '5')).toBe(false);
    expect(stockEdited('05', '5')).toBe(false);
    expect(stockEdited('', '')).toBe(false);
  });

  it('is true when the admin changed stock', () => {
    expect(stockEdited('7', '5')).toBe(true);
    expect(stockEdited('0', '5')).toBe(true);
    expect(stockEdited('', '5')).toBe(true);
  });

  it('always sends stock for a new product or variant', () => {
    expect(stockEdited('3', null)).toBe(true);
    expect(stockEdited('0', undefined)).toBe(true);
  });
});
