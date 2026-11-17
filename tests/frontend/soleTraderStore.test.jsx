import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const db = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn() }));
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: { from: vi.fn(() => ({ update: (u) => { db.update(u); return { eq: db.eq }; } })) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SoleTraderStoreDialog from '@/components/admin/SoleTraderStoreDialog.jsx';
import {
  buildStoreUpdate, storeFormFromProfile, STORE_CATEGORIES, TRUST_BADGES, STORE_NAME_MAX,
} from '@/utils/soleTraderStore.js';

const user = {
  id: 'u1',
  business_name: 'Slab City',
  business_tagline: 'Graded only',
  dealer_shipping_policy: 'Ships Tuesdays',
  business_categories: ['Graded Cards'],
  dealer_trust_badges: ['authentic'],
  business_logo_url: 'https://example.com/logo.png',
};

describe('buildStoreUpdate', () => {
  it('requires a business name', () => {
    expect(buildStoreUpdate({ ...storeFormFromProfile(user), business_name: '   ' })).toEqual({ error: 'A business name is required.' });
  });

  it('refuses over-long text', () => {
    expect(buildStoreUpdate({ ...storeFormFromProfile(user), business_name: 'x'.repeat(STORE_NAME_MAX + 1) }).error).toMatch(/business name/);
  });

  it('keeps only known categories and badges, in a stable order, and trims', () => {
    const { update } = buildStoreUpdate({
      business_name: '  Slab City ',
      business_tagline: '',
      dealer_shipping_policy: '',
      business_categories: ['Vintage Cards', 'Made Up', 'Graded Cards'],
      dealer_trust_badges: ['fast_dispatch', 'nope', 'authentic'],
    });
    expect(update.business_name).toBe('Slab City');
    expect(update.business_categories).toEqual(STORE_CATEGORIES.filter((c) => ['Vintage Cards', 'Graded Cards'].includes(c)));
    expect(update.dealer_trust_badges).toEqual(TRUST_BADGES.map((b) => b.key).filter((k) => ['fast_dispatch', 'authentic'].includes(k)));
  });

  it('only touches the logo when asked to remove it, and never the ABN or slug', () => {
    const keep = buildStoreUpdate(storeFormFromProfile(user)).update;
    expect(keep).not.toHaveProperty('business_logo_url');
    const cleared = buildStoreUpdate({ ...storeFormFromProfile(user), removeLogo: true }).update;
    expect(cleared.business_logo_url).toBeNull();
    for (const u of [keep, cleared]) {
      expect(u).not.toHaveProperty('abn');
      expect(u).not.toHaveProperty('store_slug');
      expect(u).not.toHaveProperty('is_sole_trader');
    }
  });
});

describe('SoleTraderStoreDialog', () => {
  beforeEach(() => { db.update.mockClear(); db.eq.mockReset().mockResolvedValue({ error: null }); });
  afterEach(cleanup);

  it('shows the saved values and saves the edit to that member', async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<SoleTraderStoreDialog open onOpenChange={onOpenChange} user={user} onSaved={onSaved} />);

    const name = screen.getByLabelText('Business name');
    expect(name).toHaveValue('Slab City');
    fireEvent.change(name, { target: { value: 'Slab City Cards' } });
    fireEvent.click(screen.getByRole('button', { name: /save store/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ business_name: 'Slab City Cards' }));
    expect(db.eq).toHaveBeenCalledWith('id', 'u1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not save when the name is blank', async () => {
    render(<SoleTraderStoreDialog open onOpenChange={vi.fn()} user={{ ...user, business_name: '' }} onSaved={vi.fn()} />);
    fireEvent.submit(screen.getByLabelText('Business name').closest('form'));
    await Promise.resolve();
    expect(db.update).not.toHaveBeenCalled();
  });
});
