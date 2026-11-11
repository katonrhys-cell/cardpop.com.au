import { vi, describe, it, expect, beforeEach } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { rpc: (...a) => rpc(...a) } }));

import { recordEventView, fetchEventViewStats, formatViews, looksAutomated } from '@/lib/eventViews.js';

const ID = '11111111-1111-4111-8111-111111111111';
const human = { userAgent: 'Mozilla/5.0 (iPhone) Safari', webdriver: false };
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const NOW = new Date('2026-11-11T02:00:00Z');

beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });

describe('recordEventView', () => {
  it('sends one view, then not again the same day in the same browser', async () => {
    const storage = memory();
    expect(await recordEventView(ID, { storage, nav: human, now: NOW })).toBe(true);
    expect(await recordEventView(ID, { storage, nav: human, now: NOW })).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('record_event_view', { p_event_id: ID });
  });

  it('counts again the next day', async () => {
    const storage = memory();
    await recordEventView(ID, { storage, nav: human, now: NOW });
    expect(await recordEventView(ID, { storage, nav: human, now: new Date('2026-11-12T02:00:00Z') })).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('skips crawlers, automation and legacy (non-UUID) events', async () => {
    expect(await recordEventView(ID, { storage: memory(), nav: { userAgent: 'Googlebot/2.1' }, now: NOW })).toBe(false);
    expect(await recordEventView(ID, { storage: memory(), nav: { userAgent: 'x', webdriver: true }, now: NOW })).toBe(false);
    expect(await recordEventView('static-event-3', { storage: memory(), nav: human, now: NOW })).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('never throws, even if the call fails or storage is blocked', async () => {
    rpc.mockRejectedValueOnce(new Error('offline'));
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    await expect(recordEventView(ID, { storage: blocked, nav: human, now: NOW })).resolves.toBe(false);
  });
});

describe('fetchEventViewStats', () => {
  it('maps rows by event id and treats numbers defensively', async () => {
    rpc.mockResolvedValueOnce({ data: [{ event_id: ID, total: '120', last_7: 14, last_30: 60 }], error: null });
    expect(await fetchEventViewStats([ID, ID, 'nope'])).toEqual({ [ID]: { total: 120, last7: 14, last30: 60 } });
    expect(rpc).toHaveBeenCalledWith('event_view_stats', { p_event_ids: [ID] });
  });

  it('returns {} on error or with nothing to ask about, without calling', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await fetchEventViewStats([ID])).toEqual({});
    rpc.mockClear();
    expect(await fetchEventViewStats([])).toEqual({});
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('formats counts', () => {
    expect(formatViews(1)).toBe('1 view');
    expect(formatViews(0)).toBe('0 views');
    expect(formatViews(1234)).toBe('1,234 views');
  });
  it('treats a missing navigator as automated', () => {
    expect(looksAutomated(null)).toBe(true);
  });
});
