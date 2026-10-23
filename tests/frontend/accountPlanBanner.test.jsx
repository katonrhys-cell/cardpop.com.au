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
    subscriptionStatus: 'none',
    isAdmin: false,
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

  // Every admin holds Ultimate free (subscription_status 'grandfathered'): the
  // card says it is included rather than quoting the $150/mo they never pay.
  it('tells an admin their Ultimate plan is complimentary, not $150/mo', () => {
    setAuth({ isPro: true, isAdmin: true, subscriptionTier: 'ultimate', subscriptionStatus: 'grandfathered' });
    renderBanner();
    expect(screen.getByText('CardPop Ultimate')).toBeInTheDocument();
    expect(screen.getByText(/complimentary/i)).toBeInTheDocument();
    expect(screen.getByText(/included with your admin access/i)).toBeInTheDocument();
    const current = screen.getByRole('list', { name: 'Plan options' }).querySelector('[aria-current="true"]');
    expect(current).toHaveTextContent('Included free');
    expect(current).not.toHaveTextContent('$150/mo');
    expect(screen.queryByRole('link', { name: /upgrade your plan/i })).toBeNull();
  });

  it('describes a non-admin complimentary membership as covered by CardPop', () => {
    setAuth({ isPro: true, subscriptionTier: 'ultimate', subscriptionStatus: 'grandfathered' });
    renderBanner();
    expect(screen.getByText(/cardpop covers this membership/i)).toBeInTheDocument();
    expect(screen.queryByText(/admin access/i)).toBeNull();
  });

  it('keeps the trial countdown for a paying member', () => {
    setAuth({ isPro: true, subscriptionTier: 'pro', subscriptionStatus: 'trialing', trialActive: true, trialDaysLeft: 12 });
    renderBanner();
    expect(screen.getByText(/12 trial days left/i)).toBeInTheDocument();
    expect(screen.queryByText(/complimentary/i)).toBeNull();
  });
});
