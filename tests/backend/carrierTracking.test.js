import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import {
  parseAusPostTracking, parseSendleTracking, isDeliveredDescription, lookupTracking, trackableCarriers,
} from '../../src/utils/carrierTracking.js';

describe('isDeliveredDescription', () => {
  it('recognises a delivery and rejects attempts / awaiting collection', () => {
    expect(isDeliveredDescription('Delivered')).toBe(true);
    expect(isDeliveredDescription('Delivered - Left in a safe place')).toBe(true);
    expect(isDeliveredDescription('Delivery attempted - card left')).toBe(false);
    expect(isDeliveredDescription('Awaiting collection at Post Office')).toBe(false);
    expect(isDeliveredDescription('In transit')).toBe(false);
    expect(isDeliveredDescription(null)).toBe(false);
  });
});

describe('parseAusPostTracking', () => {
  const payload = (events, status = 'In transit') => ({
    tracking_results: [{ tracking_id: '33ABC', status, trackable_items: [{ events }] }],
  });

  it('finds the Delivered scan and its time', () => {
    const r = parseAusPostTracking(payload([
      { description: 'Delivered', date: '2026-10-03T03:10:00+10:00' },
      { description: 'In transit', date: '2026-10-02T10:00:00+10:00' },
    ], 'Delivered'));
    expect(r.delivered).toBe(true);
    expect(r.deliveredAt.toISOString()).toBe('2026-10-02T17:10:00.000Z');
  });

  it('is not delivered on an attempted delivery', () => {
    const r = parseAusPostTracking(payload([{ description: 'Delivery attempted - card left', date: '2026-10-03T03:10:00+10:00' }]));
    expect(r.delivered).toBe(false);
    expect(r.status).toBe('In transit');
  });

  it('returns null for an empty or malformed response', () => {
    expect(parseAusPostTracking({})).toBeNull();
    expect(parseAusPostTracking(null)).toBeNull();
  });
});

describe('parseSendleTracking', () => {
  it('reads the state and the Delivered event time', () => {
    const r = parseSendleTracking({
      state: 'Delivered',
      tracking_events: [
        { event_type: 'Pickup', scan_time: '2026-10-01T00:00:00Z' },
        { event_type: 'Delivered', scan_time: '2026-10-03T01:00:00Z', description: 'Parcel delivered' },
      ],
    });
    expect(r.delivered).toBe(true);
    expect(r.deliveredAt.toISOString()).toBe('2026-10-03T01:00:00.000Z');
  });

  it('is not delivered while in transit', () => {
    expect(parseSendleTracking({ state: 'In Transit', tracking_events: [] })).toMatchObject({ delivered: false, status: 'In Transit' });
  });
});

describe('lookupTracking', () => {
  const env = { ...process.env };
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { process.env = { ...env }; });

  it('skips carriers with no credentials and unknown carriers', async () => {
    delete process.env.AUSPOST_API_KEY; delete process.env.SENDLE_ID;
    expect(trackableCarriers()).toEqual([]);
    expect(await lookupTracking('auspost', '33ABC')).toBeNull();
    expect(await lookupTracking('aramex', 'X')).toBeNull();
  });

  it('calls Australia Post with the account auth and parses the result', async () => {
    process.env.AUSPOST_API_KEY = 'k'; process.env.AUSPOST_ACCOUNT_NUMBER = 'acct'; process.env.AUSPOST_PASSWORD = 'pw';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ tracking_results: [{ status: 'Delivered', trackable_items: [{ events: [{ description: 'Delivered', date: '2026-10-03T03:10:00+10:00' }] }] }] }),
    });
    const r = await lookupTracking('startrack', '33ABC');
    expect(trackableCarriers()).toEqual(['auspost', 'startrack']);
    expect(r.delivered).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('digitalapi.auspost.com.au/shipments/v1/track?tracking_ids=33ABC');
    expect(init.headers['AUTH-KEY']).toBe('k');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('acct:pw').toString('base64')}`);
  });

  it('fails safe (null) on a non-2xx or a network error', async () => {
    process.env.SENDLE_ID = 'id'; process.env.SENDLE_API_KEY = 'key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    expect(await lookupTracking('sendle', 'S1')).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('boom'));
    expect(await lookupTracking('sendle', 'S1')).toBeNull();
  });
});
