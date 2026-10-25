import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Account → Membership billing controls. Before this, a member had no way to
// cancel from the app, and one whose first post-trial charge failed was shown
// the trial sign-up while Stripe kept retrying their card.

const json = (body, ok = true) => ({ ok, json: async () => body });
const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockApiFetch }, default: { fetch: mockApiFetch } }));
const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth.value }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/StartTrialOptions.jsx', () => ({ default: () => <div data-testid="start-trial" /> }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const AccountMembership = (await import('@/pages/account/AccountMembership.jsx')).default;

const membership = (overrides = {}) => ({
  status: 'trialing', tier: 'pro', cancelAtPeriodEnd: false,
  periodEndsAt: '2026-11-14T12:00:00.000Z', amountAud: 20, ...overrides,
});
const setAuth = (overrides) => {
  auth.value = {
    isPro: true, isAdmin: false, subscriptionStatus: 'trialing', subscriptionTier: 'pro',
    trialDaysLeft: 20, refetchProfile: vi.fn(), ...overrides,
  };
};
const routeApi = (details, extra = {}) => mockApiFetch.mockImplementation(async (path) => {
  if (path === '/subscription/stripe/details') return json({ membership: details });
  if (extra[path]) return extra[path];
  return json({}, false);
});
const renderPage = () => render(<MemoryRouter><AccountMembership /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('MembershipBillingCard', () => {
  it('tells a trialing member when they will be charged and lets them cancel', async () => {
    setAuth({});
    routeApi(membership(), { '/subscription/stripe/cancel': json({ membership: membership({ cancelAtPeriodEnd: true }) }) });
    renderPage();
    expect(await screen.findByText(/your free trial ends on/i)).toBeInTheDocument();
    expect(screen.getByText(/charged \$20\.00\/month unless you cancel/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel membership' }));
    expect(await screen.findByText(/your card is never charged/i)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel membership' }).at(-1));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/subscription/stripe/cancel', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByRole('button', { name: 'Keep my membership' })).toBeInTheDocument();
  });

  it('shows a past-due member the failed payment instead of the trial sign-up', async () => {
    setAuth({ isPro: false, subscriptionStatus: 'past_due', subscriptionTier: 'free' });
    routeApi(membership({ status: 'past_due' }));
    renderPage();
    expect(await screen.findByText(/your last payment didn't go through/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel membership' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update card/i })).toBeInTheDocument();
    expect(screen.queryByTestId('start-trial')).toBeNull();
    expect(screen.queryByText(/welcome code/i)).toBeNull();
  });

  it('is not shown to a Hobby member', async () => {
    setAuth({ isPro: false, subscriptionStatus: 'none', subscriptionTier: 'free' });
    routeApi(null);
    renderPage();
    expect(screen.getByTestId('start-trial')).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith('/subscription/stripe/details');
  });

  it('offers a paid member every other tier, up and down', async () => {
    setAuth({ subscriptionStatus: 'active', subscriptionTier: 'premium' });
    routeApi(membership({ status: 'active', tier: 'premium' }));
    renderPage();
    expect(await screen.findByText('Change your plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Downgrade to Pro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade to Elite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade to Ultimate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /to Premium/ })).toBeNull();
  });

  it('sends Update card through our API, never a Stripe portal', async () => {
    setAuth({ subscriptionStatus: 'active' });
    routeApi(membership({ status: 'active' }), { '/subscription/stripe/update-card': json({}, false) });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /update card/i }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/subscription/stripe/update-card', expect.objectContaining({ method: 'POST' })));
    const body = JSON.parse(mockApiFetch.mock.calls.find(([p]) => p === '/subscription/stripe/update-card')[1].body);
    expect(body.successUrl).toMatch(/\?card=updated&session_id=\{CHECKOUT_SESSION_ID\}$/);
  });
});
