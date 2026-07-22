import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ auth: {} }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => h.auth }));

import WelcomePage from '@/pages/WelcomePage.jsx';

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/verify-identity" element={<div>verify-identity-page</div>} />
        <Route path="/account/wallet" element={<div>wallet-page</div>} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.auth = { isAuthenticated: false, isIdentityVerified: false, loading: false };
});

describe('WelcomePage', () => {
  it('routes a freshly confirmed, unverified user into the ID-verification chain', async () => {
    h.auth = { isAuthenticated: true, isIdentityVerified: false, loading: false };
    renderAt();
    await waitFor(() => expect(screen.getByText('verify-identity-page')).toBeInTheDocument());
  });

  it('sends an already ID-verified user straight to the wallet', async () => {
    h.auth = { isAuthenticated: true, isIdentityVerified: true, loading: false };
    renderAt();
    await waitFor(() => expect(screen.getByText('wallet-page')).toBeInTheDocument());
  });

  it('shows a spinner while the session is still being established', () => {
    h.auth = { isAuthenticated: false, isIdentityVerified: false, loading: true };
    renderAt();
    expect(screen.getByText(/confirming your email/i)).toBeInTheDocument();
    expect(screen.queryByText(/didn't sign you in/i)).not.toBeInTheDocument();
  });
});
