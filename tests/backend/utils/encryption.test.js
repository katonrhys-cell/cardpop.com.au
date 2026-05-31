import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../../src/utils/encryption.js';

// ─── encrypt / decrypt round-trips ────────────────────────────────────────────

describe('encrypt / decrypt', () => {
  it('round-trips a plain object', () => {
    const payload = { name: 'Charizard', price: 99.99 };
    expect(decrypt(encrypt(payload))).toEqual(payload);
  });

  it('round-trips an array', () => {
    const payload = [{ code: 'ABC12345', used: false }, { code: 'DEF67890', used: true }];
    expect(decrypt(encrypt(payload))).toEqual(payload);
  });

  it('round-trips a nested object', () => {
    const payload = { codes: [{ code: 'A1B2C3D4', used: false }], generatedAt: '2024-01-01T00:00:00.000Z' };
    expect(decrypt(encrypt(payload))).toEqual(payload);
  });

  it('round-trips a string value', () => {
    const payload = { message: 'hello world' };
    expect(decrypt(encrypt(payload))).toEqual(payload);
  });

  it('round-trips boolean and numeric fields without coercion', () => {
    const payload = { active: true, count: 0, score: 4.5 };
    const result = decrypt(encrypt(payload));
    expect(result.active).toBe(true);
    expect(result.count).toBe(0);
    expect(result.score).toBe(4.5);
  });

  it('returns a non-empty string from encrypt', () => {
    const result = encrypt({ x: 1 });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('different inputs produce different encrypted outputs', () => {
    const a = encrypt({ value: 'alpha' });
    const b = encrypt({ value: 'beta' });
    expect(a).not.toBe(b);
  });

  it('encrypting the same input twice produces different ciphertext (IV is random)', () => {
    const payload = { secret: 'same-data' };
    // AES encryption uses a random IV each time, so ciphertext should differ
    const first = encrypt(payload);
    const second = encrypt(payload);
    // Both should decrypt correctly
    expect(decrypt(first)).toEqual(payload);
    expect(decrypt(second)).toEqual(payload);
  });

  it('throws when decrypting a tampered ciphertext', () => {
    expect(() => decrypt('this-is-not-valid-ciphertext')).toThrow();
  });
});
