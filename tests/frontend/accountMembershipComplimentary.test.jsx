import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Account → Membership for an account that holds its plan free: every admin
// holds Ultimate this way (subscription_status 'grandfathered'). The page must
// say the plan is complimentary and never offer a trial, a card capture or an
// in-place upgrade — there is nothing to buy.

const mockApiFetch = vi.hoisted(() => vi.fn(async () => ({ ok: false, json: async () => ({}) })));
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockApiFetch }, default: { fetch: mockApiFetch } }));
const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth.value }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/StartTrialOptions.jsx', () => ({ default: () => <div data-testid="start-trial" /> }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const AccountMembership = (await import('@/pages/account/AccountMembership.jsx')).default;

const setAuth = (overrides) => {
  auth.value = {
    isPro: false, isAdmin: false, subscriptionStatus: 'none', subscriptionTier: 'free',
    trialDaysLeft: null, refetchProfile: vi.fn(), ...overrides,
  };
};
const renderPage = () => render(<MemoryRouter initialEntries={['/account/membership']}><AccountMembership /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('AccountMembership — complimentary plans', () => {
  it('tells an admin their Ultimate plan comes with admin access and offers nothing to buy', () => {
    setAuth({ isPro: true, isAdmin: true, subscriptionStatus: 'grandfathered', subscriptionTier: 'ultimate' });
    renderPage();
    expect(screen.getByText('CardPop Ultimate · complimentary')).toBeInTheDocument();
    expect(screen.getByText(/every cardpop admin holds the ultimate plan at no charge/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing above it, and nothing to pay/i)).toBeInTheDocument();
    expect(screen.queryByTestId('start-trial')).toBeNull();
    expect(screen.queryByRole('button', { name: /switch to/i })).toBeNull();
    expect(screen.queryByText(/welcome code/i)).toBeNull();
  });

  it('describes a non-admin complimentary membership as covered by CardPop', () => {
    setAuth({ isPro: true, subscriptionStatus: 'grandfathered', subscriptionTier: 'ultimate' });
    renderPage();
    expect(screen.getByText(/cardpop covers this membership/i)).toBeInTheDocument();
    expect(screen.queryByText(/admin access/i)).toBeNull();
  });

  it('still offers the trial to a Hobby member', () => {
    setAuth({});
    renderPage();
    expect(screen.getByTestId('start-trial')).toBeInTheDocument();
    expect(screen.queryByText(/complimentary/i)).toBeNull();
  });
});
