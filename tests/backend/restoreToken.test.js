import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signRestoreToken, verifyRestoreToken, restoreTokenConfigured } from '../../src/utils/restoreToken.js';

const saved = {};
beforeEach(() => { for (const k of ['CART_RESTORE_SECRET', 'ENCRYPTION_KEY', 'CRON_SECRET']) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe('cart-restore token', () => {
  it('is off with no secret: nothing signs, nothing verifies', () => {
    expect(restoreTokenConfigured()).toBe(false);
    expect(signRestoreToken('o1')).toBeNull();
    expect(verifyRestoreToken('o1', 'anything')).toBe(false);
  });
  it('round-trips and is bound to the order id', () => {
    process.env.CART_RESTORE_SECRET = 'a-long-enough-secret-value';
    const t = signRestoreToken('order-1');
    expect(verifyRestoreToken('order-1', t)).toBe(true);
    expect(verifyRestoreToken('order-2', t)).toBe(false);
    expect(verifyRestoreToken('order-1', `${t}x`)).toBe(false);
    expect(verifyRestoreToken('order-1', '')).toBe(false);
  });
  it('falls back to ENCRYPTION_KEY, then CRON_SECRET', () => {
    process.env.CRON_SECRET = 'cron-secret-that-is-long';
    expect(restoreTokenConfigured()).toBe(true);
    process.env.ENCRYPTION_KEY = 'encryption-key-that-is-long';
    expect(verifyRestoreToken('o', signRestoreToken('o'))).toBe(true);
  });
});
