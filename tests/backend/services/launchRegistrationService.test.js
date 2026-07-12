import { vi, describe, it, expect, beforeEach } from 'vitest';

// Per-table result queues: each supabase query (however it terminates) shifts
// the next result off its table's queue, so tests script exact call sequences.
const h = vi.hoisted(() => ({ queues: {} }));
const mockSendLaunchWelcome = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/supabaseClient.js', () => {
  const nextResult = (table) => {
    const q = h.queues[table] || [];
    return Promise.resolve(q.length ? q.shift() : { data: null, error: null });
  };
  const makeBuilder = (table) => {
    const builder = {};
    for (const m of ['select', 'eq', 'ilike', 'insert', 'update']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(() => nextResult(table));
    builder.single = vi.fn(() => nextResult(table));
    builder.then = (onFulfilled, onRejected) => nextResult(table).then(onFulfilled, onRejected);
    return builder;
  };
  const supabase = { from: vi.fn((table) => makeBuilder(table)) };
  return { supabase, default: supabase };
});
vi.mock('../../../src/utils/emailService.js', () => ({
  sendLaunchWelcome: mockSendLaunchWelcome,
}));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { registerLaunchInterest } from '../../../src/services/launchRegistrationService.js';

const TABLE = 'launch_registrations';

beforeEach(() => {
  vi.clearAllMocks();
  h.queues = {};
  mockSendLaunchWelcome.mockResolvedValue(true);
});

describe('registerLaunchInterest — validation', () => {
  it('rejects a missing email', async () => {
    await expect(registerLaunchInterest({})).rejects.toThrow(/valid email/i);
    expect(mockSendLaunchWelcome).not.toHaveBeenCalled();
  });

  it('rejects an email with no @', async () => {
    await expect(registerLaunchInterest({ email: 'nope' })).rejects.toThrow(/valid email/i);
  });
});

describe('registerLaunchInterest — new registration', () => {
  it('inserts, sends the welcome email, and stamps it', async () => {
    h.queues[TABLE] = [
      { data: null, error: null },                              // select existing → none
      { data: { id: 'r1', welcome_email_sent_at: null }, error: null }, // insert → row
      { data: null, error: null },                              // update stamp
    ];

    const res = await registerLaunchInterest({ email: '  USER@Example.COM ', firstName: ' Ash ', source: 'launch_modal' });

    expect(res).toEqual({ created: true, emailed: true });
    expect(mockSendLaunchWelcome).toHaveBeenCalledWith({ to: 'user@example.com', name: 'Ash' });
  });

  it('coerces an unknown source to the default (does not throw)', async () => {
    h.queues[TABLE] = [
      { data: null, error: null },
      { data: { id: 'r2', welcome_email_sent_at: null }, error: null },
      { data: null, error: null },
    ];
    const res = await registerLaunchInterest({ email: 'a@b.com', source: 'evil' });
    expect(res.created).toBe(true);
  });

  it('does not stamp email when the send fails', async () => {
    mockSendLaunchWelcome.mockResolvedValue(false);
    h.queues[TABLE] = [
      { data: null, error: null },
      { data: { id: 'r3', welcome_email_sent_at: null }, error: null },
    ];
    const res = await registerLaunchInterest({ email: 'a@b.com' });
    expect(res).toEqual({ created: true, emailed: false });
  });
});

describe('registerLaunchInterest — idempotency', () => {
  it('does not re-send when the address already has a welcome stamp', async () => {
    h.queues[TABLE] = [
      { data: { id: 'r4', welcome_email_sent_at: '2026-01-01T00:00:00Z' }, error: null },
    ];
    const res = await registerLaunchInterest({ email: 'a@b.com' });
    expect(res).toEqual({ created: false, emailed: false });
    expect(mockSendLaunchWelcome).not.toHaveBeenCalled();
  });

  it('treats a unique-violation race on insert as already-registered', async () => {
    h.queues[TABLE] = [
      { data: null, error: null },                       // select → none
      { data: null, error: { code: '23505' } },          // insert → duplicate
    ];
    const res = await registerLaunchInterest({ email: 'a@b.com' });
    expect(res).toEqual({ created: false, emailed: false });
    expect(mockSendLaunchWelcome).not.toHaveBeenCalled();
  });
});
