import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utils/supabaseClient.js', () => ({ supabase: { from: vi.fn() }, default: { from: vi.fn() } }));
vi.mock('../../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../../src/utils/emailService.js', () => ({ sendOrderShipped: vi.fn(), sendOrderDelivered: vi.fn() }));

import { decideDelivery } from '../../../src/services/deliverySweepService.js';

const day = (n) => new Date(Date.UTC(2026, 9, 1 + n, 12));

describe('decideDelivery', () => {
  const shipped = (n) => ({ status: 'shipped', shipped_at: day(n).toISOString(), delivered_at: null });

  it('records a carrier delivery at the scan time', () => {
    const d = decideDelivery(shipped(0), { delivered: true, deliveredAt: day(2) }, day(3));
    expect(d).toMatchObject({ action: 'deliver', source: 'carrier' });
    expect(d.deliveredAt).toEqual(day(2));
  });

  it('waits while the carrier says in transit and the parcel is under 10 days old', () => {
    expect(decideDelivery(shipped(0), { delivered: false, status: 'In transit' }, day(5)).action).toBe('wait');
  });

  it('auto-delivers 10 days after posting when the carrier is silent', () => {
    expect(decideDelivery(shipped(0), null, day(9)).action).toBe('wait');
    const d = decideDelivery(shipped(0), null, day(10));
    expect(d).toMatchObject({ action: 'deliver', source: 'auto' });
    expect(d.deliveredAt).toEqual(day(10));
  });

  it('skips orders that are not shipped or already delivered', () => {
    expect(decideDelivery({ status: 'payment_confirmed' }, null, day(30)).action).toBe('skip');
    expect(decideDelivery({ status: 'shipped', delivered_at: day(1).toISOString() }, null, day(30)).action).toBe('skip');
  });
});
