import { vi, describe, it, expect, beforeEach } from 'vitest';

// stripeWebhookService imports a large web of collaborators at module load. Stub
// them all so we can unit-test the small exported helpers that aren't already
// exercised by the webhook integration tests (stripe.test.js /
// stripe-webhook-idempotency.test.js): getPlatformSetting, handlePaymentFailed
// and the release branches of handleCheckoutSessionExpired.
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockReleaseWelcomeDiscount = vi.hoisted(() => vi.fn());
const mockReleaseWalletCheckout = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/emailService.js', () => ({
  sendOrderConfirmed: vi.fn(), sendItemSold: vi.fn(), sendOrderAdminNotice: vi.fn(),
}));
vi.mock('../../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmails: vi.fn() }));
vi.mock('../../../src/services/payoutService.js', () => ({ payoutSeller: vi.fn() }));
vi.mock('../../../src/services/welcomeOfferService.js', () => ({
  markWelcomeDiscountRedeemed: vi.fn(), releaseWelcomeDiscount: mockReleaseWelcomeDiscount,
}));
vi.mock('../../../src/services/partnerService.js', () => ({ recordShopOrderReferral: vi.fn() }));
vi.mock('../../../src/services/walletService.js', () => ({
  debitWalletForOrder: vi.fn(), releaseWalletCheckout: mockReleaseWalletCheckout,
}));
vi.mock('../../../src/utils/newsletter.js', () => ({ subscribeToNewsletter: vi.fn() }));
vi.mock('../../../src/services/identityService.js', () => ({ namesMatch: vi.fn() }));

import {
  getPlatformSetting,
  handlePaymentFailed,
  handleCheckoutSessionExpired,
  notifyAdminOfOrder,
} from '../../../src/services/stripeWebhookService.js';
import { getAdminNotificationEmails } from '../../../src/utils/adminNotificationRecipient.js';
import { sendOrderAdminNotice } from '../../../src/utils/emailService.js';

function builder({ single = { data: null, error: null }, value = { data: null, error: null } } = {}) {
  const b = {};
  for (const m of ['select', 'update', 'insert', 'eq', 'order', 'limit']) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(single));
  b.then = (onF, onR) => Promise.resolve(value).then(onF, onR);
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => vi.clearAllMocks());

describe('getPlatformSetting', () => {
  it('returns the stored value when the setting row exists', async () => {
    queueFrom(builder({ single: { data: { value: 15 }, error: null } }));
    await expect(getPlatformSetting('gst_rate_pct', 10)).resolves.toBe(15);
    expect(mockSupabase.from).toHaveBeenCalledWith('platform_settings');
  });

  it('falls back to the default when no row exists', async () => {
    queueFrom(builder({ single: { data: null, error: null } }));
    await expect(getPlatformSetting('missing_key', 'fallback')).resolves.toBe('fallback');
  });

  it('returns a stored falsy value (false) rather than the default', async () => {
    // The reader keys off `value !== undefined`, so an explicit `false` must win
    // over the default — otherwise a disabled toggle would silently re-enable.
    queueFrom(builder({ single: { data: { value: false }, error: null } }));
    await expect(getPlatformSetting('gst_enabled', true)).resolves.toBe(false);
  });
});

describe('handlePaymentFailed', () => {
  it('marks the order for the failed payment intent as payment_failed', async () => {
    const orders = builder({ value: { data: null, error: null } });
    queueFrom(orders);

    await handlePaymentFailed({ id: 'pi_123' });

    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    expect(orders.update).toHaveBeenCalledWith({ status: 'payment_failed' });
    expect(orders.eq).toHaveBeenCalledWith('stripe_payment_intent_id', 'pi_123');
  });
});

describe('notifyAdminOfOrder', () => {
  it('emails every admin recipient and inserts an order_placed bell notification per admin', async () => {
    getAdminNotificationEmails.mockResolvedValue(['admin@cardpop.com.au']);
    const profiles = builder({ value: { data: [{ id: 'a1' }, { id: 'a2' }], error: null } });
    const notifications = builder({ value: { data: null, error: null } });
    queueFrom(profiles, notifications);

    await notifyAdminOfOrder({
      orderId: 'ord-1', buyerName: 'Jess', buyerEmail: 'jess@example.com',
      total: 42.5, itemsSummary: 'Charizard EX',
    });

    expect(sendOrderAdminNotice).toHaveBeenCalledWith(expect.objectContaining({
      to: ['admin@cardpop.com.au'], orderId: 'ord-1', total: 42.5,
    }));
    const rows = notifications.insert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    // The notifications table links via related_id — `entity_id` doesn't exist
    // and previously made Postgres reject every admin order notification.
    expect(rows[0]).toMatchObject({ user_id: 'a1', type: 'order_placed', related_id: 'ord-1' });
    expect(rows[0]).not.toHaveProperty('entity_id');
  });

  it('never throws when the email or the notification insert fails', async () => {
    getAdminNotificationEmails.mockResolvedValue(['admin@cardpop.com.au']);
    sendOrderAdminNotice.mockRejectedValueOnce(new Error('resend down'));
    const profiles = builder({ value: { data: [{ id: 'a1' }], error: null } });
    const notifications = builder({ value: { data: null, error: { message: 'insert rejected' } } });
    queueFrom(profiles, notifications);

    await expect(notifyAdminOfOrder({ orderId: 'ord-2', total: 10 })).resolves.toBeUndefined();
  });
});

describe('handleCheckoutSessionExpired', () => {
  it('cancels pending orders and does not touch the discount/wallet releases for a plain session', async () => {
    queueFrom(builder({ value: { data: [{ id: 'o1' }], error: null } }));

    await handleCheckoutSessionExpired({ id: 'cs_1', metadata: {} });

    expect(mockReleaseWelcomeDiscount).not.toHaveBeenCalled();
    expect(mockReleaseWalletCheckout).not.toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });

  it('releases a reserved welcome discount when the abandoned session held one', async () => {
    queueFrom(builder({ value: { data: [], error: null } }));

    await handleCheckoutSessionExpired({ id: 'cs_2', metadata: { welcomeOfferId: 'wo-9' } });

    expect(mockReleaseWelcomeDiscount).toHaveBeenCalledWith('wo-9');
  });

  it('releases the wallet-checkout slot when the abandoned session was wallet-funded', async () => {
    queueFrom(builder({ value: { data: [], error: null } }));

    await handleCheckoutSessionExpired({ id: 'cs_3', metadata: { walletCents: '500', userId: 'u1' } });

    expect(mockReleaseWalletCheckout).toHaveBeenCalledWith('u1');
  });
});
