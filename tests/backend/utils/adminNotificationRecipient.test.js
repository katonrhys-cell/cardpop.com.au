import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getAdminNotificationEmail } from '../../../src/utils/adminNotificationRecipient.js';

// select('key, value').in('key', [...]) resolves to { data }.
function mockRows(result) {
  mockSupabase.from.mockImplementation(() => ({
    select: () => ({ in: () => Promise.resolve(result) }),
  }));
}

beforeEach(() => vi.clearAllMocks());

describe('getAdminNotificationEmail', () => {
  it('prefers the dedicated notification_email', async () => {
    mockRows({ data: [
      { key: 'notification_email', value: 'notifications@cardpop.com.au' },
      { key: 'contact_email', value: 'support@cardpop.com.au' },
    ], error: null });
    expect(await getAdminNotificationEmail()).toBe('notifications@cardpop.com.au');
  });

  it('falls back to contact_email when notification_email is blank', async () => {
    mockRows({ data: [
      { key: 'notification_email', value: '   ' },
      { key: 'contact_email', value: 'support@cardpop.com.au' },
    ], error: null });
    expect(await getAdminNotificationEmail()).toBe('support@cardpop.com.au');
  });

  it('falls back to the default inbox when nothing is configured', async () => {
    mockRows({ data: [], error: null });
    expect(await getAdminNotificationEmail()).toBe('notifications@cardpop.com.au');
  });

  it('returns the default inbox on a read error rather than throwing', async () => {
    mockSupabase.from.mockImplementation(() => { throw new Error('db down'); });
    expect(await getAdminNotificationEmail()).toBe('notifications@cardpop.com.au');
  });
});
