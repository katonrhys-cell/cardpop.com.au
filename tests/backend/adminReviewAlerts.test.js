import { vi, describe, it, expect, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ admins: [], insertError: null, inserted: null }));
const mockSend = vi.hoisted(() => vi.fn(async () => true));
const mockRecipients = vi.hoisted(() => vi.fn(async () => ['admin@cardpop.com.au', 'owner@example.com']));

vi.mock('../../src/utils/supabaseClient.js', () => {
  const from = vi.fn((table) => {
    if (table === 'profiles') {
      const b = { select: () => b, eq: () => Promise.resolve({ data: state.admins, error: null }) };
      return b;
    }
    return { insert: vi.fn(async (rows) => { state.inserted = rows; return { error: state.insertError }; }) };
  });
  const client = { from };
  return { default: client, supabase: client };
});
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../src/utils/emailService.js', () => ({ sendAdminReviewAlert: mockSend }));
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmails: mockRecipients }));

import { alertAdminsToReview } from '../../src/services/adminReviewAlerts.js';

const alert = {
  type: 'store_submitted', title: 'New store submitted: Card Cave', body: 'Card Cave wants listing.',
  path: '/admin/store-directory', relatedId: '11111111-2222-3333-4444-555555555555',
  email: { subject: 'New card shop', intro: 'Waiting for approval.', rows: [['Store', 'Card Cave']] },
};

beforeEach(() => {
  state.admins = [{ id: 'a1' }, { id: 'a2' }];
  state.insertError = null;
  state.inserted = null;
  mockSend.mockClear();
});

describe('alertAdminsToReview', () => {
  it('bells every admin with a link to the queue and emails every admin address', async () => {
    const res = await alertAdminsToReview(alert);
    expect(res).toEqual({ belled: 2, emailed: true });
    expect(state.inserted).toEqual([
      expect.objectContaining({ user_id: 'a1', type: 'store_submitted', link: '/admin/store-directory', related_id: alert.relatedId }),
      expect.objectContaining({ user_id: 'a2', type: 'store_submitted' }),
    ]);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['admin@cardpop.com.au', 'owner@example.com'],
      subject: 'New card shop',
      path: '/admin/store-directory',
      rows: [['Store', 'Card Cave']],
    }));
  });

  it('still emails when the bell fails, and never throws', async () => {
    state.insertError = { message: 'invalid input value for enum' };
    const res = await alertAdminsToReview(alert);
    expect(res).toEqual({ belled: 0, emailed: true });
    mockSend.mockRejectedValueOnce(new Error('resend down'));
    await expect(alertAdminsToReview(alert)).resolves.toEqual({ belled: 0, emailed: false });
  });

  it('only emails when a trigger already bells (bell: false)', async () => {
    const res = await alertAdminsToReview({ ...alert, bell: false });
    expect(res).toEqual({ belled: 0, emailed: true });
    expect(state.inserted).toBeNull();
  });
});
