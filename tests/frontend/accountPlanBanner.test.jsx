import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Account → Dashboard plan card: every member sees the plan ladder with their
// own step marked, and an "Upgrade your plan" button — unless they're already
// on Ultimate, the top plan.

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth.value }));
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 0 }),
    })),
  },
}));

const AccountPlanBanner = (await import('@/components/AccountPlanBanner.jsx')).default;

const setAuth = (overrides) => {
  auth.value = {
    currentUser: { id: 'u1' },
    isPro: false,
    isIdentityVerified: true,
    hasSavedCard: true,
    trialActive: false,
    trialDaysLeft: null,
    subscriptionTier: 'free',
    ...overrides,
  };
};

const renderBanner = () => render(<MemoryRouter><AccountPlanBanner /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('AccountPlanBanner', () => {
  it('shows every plan option with the price and marks the current one', () => {
    setAuth({});
    renderBanner();
    const ladder = screen.getByRole('list', { name: 'Plan options' });
    ['Hobby', 'Pro', 'Premium', 'Elite', 'Ultimate'].forEach((name) => {
      expect(ladder).toHaveTextContent(name);
    });
    expect(ladder).toHaveTextContent('$20/mo');
    expect(ladder).toHaveTextContent('$150/mo');
    expect(ladder).toHaveTextContent('Unlimited listings');
    const current = ladder.querySelector('[aria-current="true"]');
    expect(current).toHaveTextContent('Hobby');
    expect(current).toHaveTextContent('Current');
  });

  it('offers "Upgrade your plan" to a Hobby member, preselecting Pro', () => {
    setAuth({});
    renderBanner();
    const link = screen.getByRole('link', { name: /upgrade your plan/i });
    expect(link).toHaveAttribute('href', '/account/membership?tier=pro');
    expect(screen.getByText(/next up:/i)).toHaveTextContent('Pro');
  });

  it('names the real tier for a paid member and preselects the next step up', () => {
    setAuth({ isPro: true, subscriptionTier: 'premium' });
    renderBanner();
    expect(screen.getByText('CardPop Premium')).toBeInTheDocument();
    const ladder = screen.getByRole('list', { name: 'Plan options' });
    expect(ladder.querySelector('[aria-current="true"]')).toHaveTextContent('Premium');
    expect(screen.getByRole('link', { name: /upgrade your plan/i }))
      .toHaveAttribute('href', '/account/membership?tier=elite');
  });

  it('hides the upgrade button on the top plan', () => {
    setAuth({ isPro: true, subscriptionTier: 'ultimate' });
    renderBanner();
    expect(screen.getByText('CardPop Ultimate')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /upgrade your plan/i })).toBeNull();
    expect(screen.getByText(/top plan/i)).toBeInTheDocument();
    const ladder = screen.getByRole('list', { name: 'Plan options' });
    expect(ladder.querySelector('[aria-current="true"]')).toHaveTextContent('Ultimate');
  });
});
