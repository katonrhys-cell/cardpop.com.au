import { describe, it, expect } from 'vitest';
import {
  canViewVaultProduct,
  canEditVaultProduct,
  getVaultProductsForUser,
} from '@/utils/vaultSecurityUtils.js';

// ─── canViewVaultProduct ──────────────────────────────────────────────────────

describe('canViewVaultProduct', () => {
  it('allows anyone to view a public product (unauthenticated)', () => {
    expect(canViewVaultProduct(null, 'owner-1', true, null)).toBe(true);
  });

  it('allows a logged-in non-owner to view a public product', () => {
    expect(canViewVaultProduct('user-2', 'owner-1', true, 'user')).toBe(true);
  });

  it('allows an admin to view a private product they do not own', () => {
    expect(canViewVaultProduct('admin-1', 'owner-1', false, 'admin')).toBe(true);
  });

  it('allows the owner to view their own private product', () => {
    expect(canViewVaultProduct('owner-1', 'owner-1', false, 'user')).toBe(true);
  });

  it('blocks an unauthenticated user from viewing a private product', () => {
    expect(canViewVaultProduct(null, 'owner-1', false, null)).toBe(false);
  });

  it('blocks a non-owner regular user from viewing a private product', () => {
    expect(canViewVaultProduct('user-2', 'owner-1', false, 'user')).toBe(false);
  });

  it('blocks when userId is an empty string (falsy)', () => {
    expect(canViewVaultProduct('', 'owner-1', false, 'user')).toBe(false);
  });
});

// ─── canEditVaultProduct ──────────────────────────────────────────────────────

describe('canEditVaultProduct', () => {
  it('allows the owner to edit their own product', () => {
    expect(canEditVaultProduct('owner-1', 'owner-1', 'user')).toBe(true);
  });

  it('allows an admin to edit any product', () => {
    expect(canEditVaultProduct('admin-1', 'owner-1', 'admin')).toBe(true);
  });

  it('blocks a non-owner regular user from editing', () => {
    expect(canEditVaultProduct('user-2', 'owner-1', 'user')).toBe(false);
  });

  it('blocks an unauthenticated user (null userId) from editing', () => {
    expect(canEditVaultProduct(null, 'owner-1', 'user')).toBe(false);
  });

  it('blocks when userId is an empty string', () => {
    expect(canEditVaultProduct('', 'owner-1', 'user')).toBe(false);
  });
});

// ─── getVaultProductsForUser ──────────────────────────────────────────────────

describe('getVaultProductsForUser', () => {
  it('returns an empty filter string for admins (see all products)', () => {
    expect(getVaultProductsForUser('admin-1', 'admin')).toBe('');
  });

  it('returns a userId-scoped filter for regular users', () => {
    expect(getVaultProductsForUser('user-1', 'user')).toBe('user_id="user-1"');
  });

  it('returns a userId-scoped filter when no role is provided', () => {
    expect(getVaultProductsForUser('user-1', null)).toBe('user_id="user-1"');
  });
});
