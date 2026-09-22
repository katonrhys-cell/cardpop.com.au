import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAppReturnUrl, invalidReturnUrl } from '../../../src/utils/returnUrl.js';

const saved = {};
beforeEach(() => {
  for (const k of ['APP_URL', 'CORS_ORIGIN', 'CHECKOUT_RETURN_ORIGINS', 'VERCEL_URL', 'NODE_ENV']) saved[k] = process.env[k];
  process.env.APP_URL = 'https://cardpop.com.au';
  process.env.CORS_ORIGIN = 'https://cardpop.com.au';
  delete process.env.CHECKOUT_RETURN_ORIGINS;
  delete process.env.VERCEL_URL;
  process.env.NODE_ENV = 'production';
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

describe('isAppReturnUrl', () => {
  it('accepts the app origin', () => {
    expect(isAppReturnUrl('https://cardpop.com.au/checkout/success?session_id={CHECKOUT_SESSION_ID}')).toBe(true);
    expect(isAppReturnUrl('https://www.cardpop.com.au/account')).toBe(true);
  });

  it('rejects other origins, lookalikes, other schemes and credentials', () => {
    expect(isAppReturnUrl('https://evil.example/confirm-card')).toBe(false);
    expect(isAppReturnUrl('https://cardpop.com.au.evil.example/')).toBe(false);
    expect(isAppReturnUrl('https://cardpop.com.au@evil.example/')).toBe(false);
    expect(isAppReturnUrl('javascript:alert(1)')).toBe(false);
    expect(isAppReturnUrl('//evil.example/x')).toBe(false);
    expect(isAppReturnUrl('')).toBe(false);
    expect(isAppReturnUrl(undefined)).toBe(false);
  });

  it('honours the preview/extra origin env vars', () => {
    process.env.VERCEL_URL = 'cardpop-git-feature.vercel.app';
    process.env.CHECKOUT_RETURN_ORIGINS = 'https://staging.cardpop.com.au';
    expect(isAppReturnUrl('https://cardpop-git-feature.vercel.app/ok')).toBe(true);
    expect(isAppReturnUrl('https://staging.cardpop.com.au/ok')).toBe(true);
    expect(isAppReturnUrl('https://other.vercel.app/ok')).toBe(false);
  });

  it('allows localhost only outside production', () => {
    expect(isAppReturnUrl('http://localhost:3000/x')).toBe(false);
    process.env.NODE_ENV = 'development';
    expect(isAppReturnUrl('http://localhost:3000/x')).toBe(true);
  });
});

describe('invalidReturnUrl', () => {
  it('names the first bad field and ignores empty ones', () => {
    expect(invalidReturnUrl({ successUrl: 'https://cardpop.com.au/a', cancelUrl: undefined })).toBeNull();
    expect(invalidReturnUrl({ successUrl: 'https://cardpop.com.au/a', cancelUrl: 'https://evil.example/' })).toMatch(/cancelUrl/);
  });
});
