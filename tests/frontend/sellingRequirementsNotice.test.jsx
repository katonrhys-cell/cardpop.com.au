import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const h = { auth: {} };
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => h.auth }));

import SellingRequirementsNotice from '@/components/SellingRequirementsNotice.jsx';

const renderNotice = () =>
  render(
    <MemoryRouter>
      <SellingRequirementsNotice />
    </MemoryRouter>
  );

describe('SellingRequirementsNotice', () => {
  beforeEach(() => {
    h.auth = {
      canSell: false,
      profileLoading: false,
      isIdentityVerified: false,
      hasSavedCard: false,
      refetchProfile: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('renders nothing once the user can sell', () => {
    h.auth.canSell = true;
    const { container } = renderNotice();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while entitlement is still loading (fail-open)', () => {
    h.auth.profileLoading = true;
    const { container } = renderNotice();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows both incomplete steps with links that open in a new tab', () => {
    renderNotice();
    expect(screen.getByText(/before this card can go live/i)).toBeInTheDocument();

    const verify = screen.getByRole('link', { name: /verify identity/i });
    expect(verify).toHaveAttribute('href', '/verify-identity');
    expect(verify).toHaveAttribute('target', '_blank');

    const card = screen.getByRole('link', { name: /add a card/i });
    expect(card).toHaveAttribute('href', '/account/wallet');
    expect(card).toHaveAttribute('target', '_blank');
  });

  it('marks a completed step done and hides its call to action', () => {
    h.auth.isIdentityVerified = true;
    renderNotice();
    expect(screen.getByLabelText('Verify your identity — done')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /verify identity/i })).not.toBeInTheDocument();
    // The card step is still outstanding.
    expect(screen.getByLabelText('Add a card on file — not done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add a card/i })).toBeInTheDocument();
  });

  it('refetches the profile when the user asks to check again', async () => {
    renderNotice();
    fireEvent.click(screen.getByRole('button', { name: /check again/i }));
    await waitFor(() => expect(h.auth.refetchProfile).toHaveBeenCalledTimes(1));
  });
});
