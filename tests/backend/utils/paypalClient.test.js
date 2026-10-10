import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  isPaypalConfigured,
  createPaypalSubscription,
  getPaypalSubscription,
  verifyPaypalWebhook,
} from '../../../src/utils/paypalClient.js';

const tokenResponse = () => ({ ok: true, json: async () => ({ access_token: 'tok_123' }) });
const jsonResponse = (body) => ({ ok: true, json: async () => body });
const errorResponse = (status, text = 'nope') => ({ ok: false, status, text: async () => text });

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  process.env.PAYPAL_CLIENT_ID = 'cid';
  process.env.PAYPAL_CLIENT_SECRET = 'csecret';
  process.env.PAYPAL_SUBSCRIPTION_PLAN_ID = 'P-123';
  process.env.PAYPAL_WEBHOOK_ID = 'WH-123';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe('isPaypalConfigured', () => {
  it('is true when both client id and secret are set', () => {
    expect(isPaypalConfigured()).toBe(true);
  });

  it('is false when a credential is missing', () => {
    delete process.env.PAYPAL_CLIENT_SECRET;
    expect(isPaypalConfigured()).toBe(false);
  });
});

describe('createPaypalSubscription', () => {
  it('exchanges credentials for a token then returns the approval URL', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        id: 'I-SUB1',
        status: 'APPROVAL_PENDING',
        links: [
          { rel: 'self', href: 'https://x/self' },
          { rel: 'approve', href: 'https://paypal/approve/I-SUB1' },
        ],
      }));

    const result = await createPaypalSubscription({ userId: 'u1', email: 'a@b.com', returnUrl: 'r', cancelUrl: 'c' });
    expect(result).toEqual({ id: 'I-SUB1', status: 'APPROVAL_PENDING', approveUrl: 'https://paypal/approve/I-SUB1' });

    // Second call is the subscription create, carrying the bearer token + plan/custom_id.
    const [, subCall] = fetch.mock.calls;
    expect(subCall[0]).toContain('/v1/billing/subscriptions');
    expect(subCall[1].headers.Authorization).toBe('Bearer tok_123');
    const body = JSON.parse(subCall[1].body);
    expect(body.plan_id).toBe('P-123');
    expect(body.custom_id).toBe('u1');
  });

  it('returns approveUrl null when PayPal omits the approve link', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ id: 'I-SUB2', status: 'APPROVAL_PENDING', links: [] }));
    const result = await createPaypalSubscription({ userId: 'u1' });
    expect(result.approveUrl).toBeNull();
  });

  it('throws when the plan id is not configured', async () => {
    delete process.env.PAYPAL_SUBSCRIPTION_PLAN_ID;
    await expect(createPaypalSubscription({ userId: 'u1' })).rejects.toThrow(/PLAN_ID is not configured/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bills the requested tier against its own plan id', async () => {
    process.env.PAYPAL_SUBSCRIPTION_PLAN_ID_ELITE = 'P-ELITE';
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ id: 'I-SUB3', status: 'APPROVAL_PENDING', links: [] }));
    await createPaypalSubscription({ userId: 'u1', tier: 'elite' });
    const [, subCall] = fetch.mock.calls;
    expect(JSON.parse(subCall[1].body).plan_id).toBe('P-ELITE');
  });

  it('coerces an unknown tier back onto the Pro plan', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ id: 'I-SUB4', status: 'APPROVAL_PENDING', links: [] }));
    await createPaypalSubscription({ userId: 'u1', tier: 'god-mode' });
    const [, subCall] = fetch.mock.calls;
    expect(JSON.parse(subCall[1].body).plan_id).toBe('P-123');
  });

  it('throws when the subscription create call fails', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(errorResponse(422, 'invalid plan'));
    await expect(createPaypalSubscription({ userId: 'u1' })).rejects.toThrow(/create subscription failed \(422\)/);
  });

  it('throws when the token request itself fails', async () => {
    fetch.mockResolvedValueOnce(errorResponse(401, 'bad creds'));
    await expect(createPaypalSubscription({ userId: 'u1' })).rejects.toThrow(/token request failed \(401\)/);
  });
});

describe('access token caching', () => {
  // The tests above use token responses with no expires_in, which are never
  // cached — so they stay independent of each other. This one exercises the
  // cache on a fresh module instance.
  it('reuses a token for its lifetime and refetches once it expires', async () => {
    vi.resetModules();
    const mod = await import('../../../src/utils/paypalClient.js');
    mod._resetPaypalTokenCache();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);

    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok_A', expires_in: 32400 }) })
      .mockResolvedValueOnce(jsonResponse({ id: 'I-1', status: 'ACTIVE' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'I-2', status: 'ACTIVE' }));

    await mod.getPaypalSubscription('I-1');
    await mod.getPaypalSubscription('I-2');
    // One token request served both calls.
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer tok_A');

    // Past the (lifetime − 60 s) mark a new token is fetched.
    now.mockReturnValue(1_000_000 + 32400 * 1000);
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok_B', expires_in: 32400 }) })
      .mockResolvedValueOnce(jsonResponse({ id: 'I-3', status: 'ACTIVE' }));
    await mod.getPaypalSubscription('I-3');
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(fetch.mock.calls[4][1].headers.Authorization).toBe('Bearer tok_B');

    now.mockRestore();
    mod._resetPaypalTokenCache();
  });

  it('every PayPal request carries a timeout signal', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ id: 'I-1', status: 'ACTIVE' }));
    await getPaypalSubscription('I-1');
    for (const [, options] of fetch.mock.calls) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe('getPaypalSubscription', () => {
  it('returns the subscription JSON', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ id: 'I-SUB1', status: 'ACTIVE' }));
    await expect(getPaypalSubscription('I-SUB1')).resolves.toEqual({ id: 'I-SUB1', status: 'ACTIVE' });
  });

  it('throws on a non-ok response', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(errorResponse(404, 'not found'));
    await expect(getPaypalSubscription('missing')).rejects.toThrow(/get subscription failed \(404\)/);
  });
});

describe('verifyPaypalWebhook', () => {
  const args = {
    headers: {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://paypal/cert',
      'paypal-transmission-id': 'tid',
      'paypal-transmission-sig': 'sig',
      'paypal-transmission-time': 'now',
    },
    body: { event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' },
  };

  it('rejects (false) without ever calling PayPal when no webhook id is configured', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    await expect(verifyPaypalWebhook(args)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns true only when PayPal reports verification_status SUCCESS', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ verification_status: 'SUCCESS' }));
    await expect(verifyPaypalWebhook(args)).resolves.toBe(true);
  });

  it('returns false when PayPal reports a non-SUCCESS status', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ verification_status: 'FAILURE' }));
    await expect(verifyPaypalWebhook(args)).resolves.toBe(false);
  });

  it('returns false when the verify call is not ok', async () => {
    fetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(errorResponse(400, 'bad'));
    await expect(verifyPaypalWebhook(args)).resolves.toBe(false);
  });
});
