import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockSend = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ resendCount: 0 }));

vi.mock('resend', () => ({
  Resend: class {
    constructor() {
      state.resendCount += 1;
      this.emails = { send: mockSend };
    }
  },
}));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const FROM = 'CardPop <noreply@cardpop.com.au>';
const ORIGINAL_KEY = process.env.RESEND_API_KEY;

// The module memoizes its Resend client, so reset the module registry and
// re-import for each test to get a clean client + a freshly evaluated key.
async function load({ withKey }) {
  vi.resetModules();
  if (withKey) process.env.RESEND_API_KEY = 'test-resend-key';
  else delete process.env.RESEND_API_KEY;
  return import('../../../src/utils/emailService.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ error: null });
  state.resendCount = 0;
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
});

describe('emailService — no API key configured', () => {
  it('is a no-op when RESEND_API_KEY is missing', async () => {
    const svc = await load({ withKey: false });
    await expect(svc.sendOrderConfirmed({ buyerEmail: 'a@b.com', total: '$10' })).resolves.toBeUndefined();
    expect(state.resendCount).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('emailService — sending', () => {
  it('sends an order-confirmed email with the right envelope', async () => {
    const svc = await load({ withKey: true });
    await svc.sendOrderConfirmed({
      buyerEmail: 'buyer@x.com', buyerName: 'Ada', cardName: 'Charizard',
      itemPrice: '$100', total: '$110', orderId: 'order-1',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.from).toBe(FROM);
    expect(payload.to).toBe('buyer@x.com');
    expect(payload.subject).toMatch(/confirmed/i);
    expect(typeof payload.html).toBe('string');
    expect(payload.html.length).toBeGreaterThan(0);
  });

  it('sends an item-sold email to the seller', async () => {
    const svc = await load({ withKey: true });
    await svc.sendItemSold({
      sellerEmail: 'seller@x.com', sellerName: 'Bob', cardName: 'Pikachu',
      itemPrice: '$50', commissionAud: '$5', gstAud: '$0.50', sellerProceeds: '$44.50', orderId: 'o2',
    });
    expect(mockSend.mock.calls[0][0].to).toBe('seller@x.com');
  });

  it('does not throw when Resend returns an error', async () => {
    mockSend.mockResolvedValue({ error: { message: 'rejected' } });
    const svc = await load({ withKey: true });
    await expect(svc.sendRefundProcessed({ buyerEmail: 'a@b.com', refundAmount: '$5', orderId: 'o3' }))
      .resolves.toBeUndefined();
  });

  it('does not throw when the Resend call rejects', async () => {
    mockSend.mockRejectedValue(new Error('network down'));
    const svc = await load({ withKey: true });
    await expect(svc.sendRefundIssued({ sellerEmail: 's@b.com', refundAmount: '$5', retainedFee: '$1', orderId: 'o4' }))
      .resolves.toBeUndefined();
  });

  it('reuses a single Resend client across multiple sends', async () => {
    const svc = await load({ withKey: true });
    await svc.sendOrderConfirmed({ buyerEmail: 'a@b.com', total: '$1' });
    await svc.sendOrderConfirmed({ buyerEmail: 'c@d.com', total: '$2' });
    expect(state.resendCount).toBe(1); // memoized client
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
