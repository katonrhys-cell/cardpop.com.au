import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Guards the settings save path: platform_settings.label is NOT NULL with no
// default, so a bare {key, value} upsert fails its INSERT arm for any key
// whose row hasn't been seeded — and one bad key failed the WHOLE batch, so
// nothing on the page saved. The save must update existing rows value-only
// (never clobbering curated labels) and insert missing rows with a label.

const state = vi.hoisted(() => ({
  existingKeys: [],
  upserts: [],
}));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = () => {
    const ctx = { upsert: null };
    const b = {
      select: vi.fn(() => b),
      upsert: vi.fn((payload, opts) => { ctx.upsert = { payload, opts }; return b; }),
      then: (resolve, reject) => {
        if (ctx.upsert) {
          state.upserts.push(ctx.upsert);
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        return Promise.resolve({
          data: state.existingKeys.map((key) => ({ key, value: true })),
          error: null,
        }).then(resolve, reject);
      },
    };
    return b;
  };
  return { supabase: { from: vi.fn(() => builder()) } };
});

vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), Link: ({ to, children }) => <a href={to}>{children}</a> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));

import { toast } from 'sonner';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  state.upserts = [];
  // Simulate a partially-seeded environment: some settings rows exist, others
  // (maintenance_mode et al.) have never been provisioned.
  state.existingKeys = ['site_name', 'contact_email'];
});

describe('AdminSettingsPage save', () => {
  it('updates existing rows value-only and inserts missing rows with a label', async () => {
    const user = userEvent.setup();
    render(<AdminSettingsPage />);

    const save = await screen.findByRole('button', { name: /save/i });
    await user.click(save);

    await waitFor(() => expect(state.upserts.length).toBeGreaterThanOrEqual(2));

    const valueOnly = state.upserts.find((u) => u.payload.every?.((r) => !('label' in r)));
    const withLabels = state.upserts.find((u) => u.payload.every?.((r) => 'label' in r));
    expect(valueOnly).toBeTruthy();
    expect(withLabels).toBeTruthy();

    // Existing rows ride the value-only batch — their curated labels survive.
    const valueOnlyKeys = valueOnly.payload.map((r) => r.key);
    expect(valueOnlyKeys).toEqual(expect.arrayContaining(['site_name', 'contact_email']));

    // Missing rows carry the NOT NULL columns so the insert can't 23502.
    for (const row of withLabels.payload) {
      expect(row.label).toBeTruthy();
      expect(row.group_name).toBeTruthy();
      expect(state.existingKeys).not.toContain(row.key);
    }

    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('sends no insert batch when every key already has a row', async () => {
    // All DEFAULT_SETTINGS keys present → the with-labels batch must not fire,
    // so curated labels can never be overwritten by derived ones.
    state.existingKeys = [
      'site_name', 'contact_email', 'notification_email', 'maintenance_mode',
      'listing_approval_required', 'max_images_per_listing', 'free_shipping_threshold_aud',
      'default_shipping_rate_aud', 'require_mfa_admins', 'email_verification_required',
      'enable_marketplace', 'enable_trading', 'enable_blog', 'banned_words',
      'marketplace_identity_threshold_aud',
    ];
    const user = userEvent.setup();
    render(<AdminSettingsPage />);

    await user.click(await screen.findByRole('button', { name: /save/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].payload.every((r) => !('label' in r))).toBe(true);
  });
});
