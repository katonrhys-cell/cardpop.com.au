import { describe, it, expect } from 'vitest';
import { normalizeTrackingNumber, isValidTrackingNumber, trackingUrl, carrierLabel } from '@/utils/shipmentTracking.js';

describe('shipmentTracking', () => {
  it('normalises pasted tracking numbers', () => {
    expect(normalizeTrackingNumber(' 33ab 1234 5678 ')).toBe('33AB12345678');
    expect(normalizeTrackingNumber(null)).toBe('');
  });

  it('validates tracking numbers', () => {
    expect(isValidTrackingNumber('33AB12345678')).toBe(true);
    expect(isValidTrackingNumber('abc')).toBe(false);
    expect(isValidTrackingNumber('33AB<script>')).toBe(false);
  });

  it('builds carrier tracking links', () => {
    expect(trackingUrl('auspost', '33ab 123')).toBe('https://auspost.com.au/mypost/track/details/33AB123');
    expect(trackingUrl('startrack', 'XYZ1')).toBe('https://auspost.com.au/mypost/track/details/XYZ1');
    expect(trackingUrl('other', 'XYZ1')).toBeNull();
    expect(trackingUrl('auspost', '')).toBeNull();
  });

  it('labels unknown carriers as other', () => {
    expect(carrierLabel('auspost')).toBe('Australia Post');
    expect(carrierLabel('nope')).toBe('Other courier');
  });
});
