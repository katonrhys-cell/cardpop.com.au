import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const settingsState = { settings: {} };
vi.mock('@/contexts/PlatformSettingsContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  usePlatformSettings: () => settingsState,
}));
const trackEvent = vi.fn();
vi.mock('@/lib/analytics.js', () => ({ trackEvent: (...args) => trackEvent(...args) }));

import WorkspaceReferralCard from '@/components/WorkspaceReferralCard.jsx';
import {
  safeReferralUrl,
  workspaceReferralUrl,
  WORKSPACE_REFERRAL_DEFAULT_URL,
} from '@/utils/workspaceReferral.js';
import { PLATFORM_SETTINGS_DEFAULTS } from '@/contexts/PlatformSettingsContext.jsx';

describe('safeReferralUrl', () => {
  it('admits only absolute https URLs', () => {
    expect(safeReferralUrl(WORKSPACE_REFERRAL_DEFAULT_URL)).toBe(WORKSPACE_REFERRAL_DEFAULT_URL);
    expect(safeReferralUrl('  https://example.com/x  ')).toBe('https://example.com/x');
    expect(safeReferralUrl('http://example.com')).toBeNull();
    expect(safeReferralUrl('javascript:alert(1)')).toBeNull();
    expect(safeReferralUrl('/relative')).toBeNull();
    expect(safeReferralUrl('')).toBeNull();
    expect(safeReferralUrl(null)).toBeNull();
  });
});

describe('workspaceReferralUrl', () => {
  it('falls back to the default link and honours the switch', () => {
    expect(workspaceReferralUrl({})).toBe(WORKSPACE_REFERRAL_DEFAULT_URL);
    expect(workspaceReferralUrl({ google_workspace_referral_enabled: false })).toBeNull();
    expect(workspaceReferralUrl({ google_workspace_referral_enabled: 'false' })).toBeNull();
    expect(workspaceReferralUrl({ google_workspace_referral_url: 'not a url' })).toBeNull();
  });

  it('browser defaults carry the referral link (server copy checked in tests/backend/settings.test.js)', () => {
    expect(PLATFORM_SETTINGS_DEFAULTS.google_workspace_referral_url).toBe(WORKSPACE_REFERRAL_DEFAULT_URL);
    expect(PLATFORM_SETTINGS_DEFAULTS.google_workspace_referral_enabled).toBe(true);
  });
});

describe('<WorkspaceReferralCard>', () => {
  beforeEach(() => {
    trackEvent.mockClear();
    settingsState.settings = {};
  });

  it('renders a disclosed, sponsored link and tracks the click with its placement', () => {
    render(<WorkspaceReferralCard placement="organiser" />);
    const link = screen.getByRole('link', { name: /google workspace/i });
    expect(link.getAttribute('href')).toBe(WORKSPACE_REFERRAL_DEFAULT_URL);
    expect(link.getAttribute('rel')).toContain('sponsored');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText(/may earn a referral reward/i)).toBeTruthy();

    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith('click_referral', { program: 'google_workspace', placement: 'organiser' });
  });

  it('renders nothing when switched off', () => {
    settingsState.settings = { google_workspace_referral_enabled: false };
    const { container } = render(<WorkspaceReferralCard />);
    expect(container.innerHTML).toBe('');
  });
});
