import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('@/pages/VerificationPendingPage.jsx', () => ({
  default: () => <div>Verification Pending</div>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

// ProtectedAdminRoute reads require_mfa_admins from platform_settings; mock the
// client so the MFA check resolves deterministically. Defaults to "off".
const mockMaybeSingle = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: null, error: null })));
vi.mock('@/lib/supabaseClient.js', () => {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: () => mockMaybeSingle() };
  return { supabase: { from: () => chain } };
});

import { useAuth } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import ProtectedAdminRoute from '@/components/ProtectedAdminRoute.jsx';

// Wraps in a router that has explicit /login and / fallback routes so that
// <Navigate> always resolves without hanging the happy-dom event loop.
function renderProtected(authValues, { requireVerification = false } = {}) {
  useAuth.mockReturnValue(authValues);
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute requireVerification={requireVerification}>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAdmin(authValues) {
  // Default listMFAFactors so the MFA check has a callable stub; individual
  // tests override it to simulate enrolled / not-enrolled admins.
  useAuth.mockReturnValue({ listMFAFactors: async () => ({ totp: [] }), ...authValues });
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <div>Admin Content</div>
            </ProtectedAdminRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/account/security" element={<div>Security Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null, error: null }); // MFA off by default
});

// ─── ProtectedRoute ───────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  it('shows a loading spinner while auth is resolving', () => {
    const { container } = renderProtected({ loading: true, isAuthenticated: false, isEmailVerified: false });
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('does not render children while loading', () => {
    renderProtected({ loading: true, isAuthenticated: false, isEmailVerified: false });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderProtected({ loading: false, isAuthenticated: false, isEmailVerified: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderProtected({ loading: false, isAuthenticated: true, isEmailVerified: true });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when authenticated but not verified and requireVerification is false', () => {
    renderProtected({ loading: false, isAuthenticated: true, isEmailVerified: false });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders VerificationPendingPage when authenticated but unverified and requireVerification=true', async () => {
    renderProtected(
      { loading: false, isAuthenticated: true, isEmailVerified: false },
      { requireVerification: true },
    );
    // VerificationPendingPage is now lazily loaded, so wait for it to resolve.
    expect(await screen.findByText('Verification Pending')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated, verified, and requireVerification=true', () => {
    renderProtected(
      { loading: false, isAuthenticated: true, isEmailVerified: true },
      { requireVerification: true },
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

// ─── ProtectedAdminRoute ──────────────────────────────────────────────────────

describe('ProtectedAdminRoute', () => {
  it('shows a loading spinner while auth is resolving', () => {
    const { container } = renderAdmin({ loading: true, isAuthenticated: false, isAdmin: false });
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('does not render children while loading', () => {
    renderAdmin({ loading: true, isAuthenticated: false, isAdmin: false });
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderAdmin({ loading: false, isAuthenticated: false, isAdmin: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('redirects to / when authenticated but not admin', () => {
    renderAdmin({ loading: false, isAuthenticated: true, isAdmin: false });
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated and admin (MFA not required)', async () => {
    renderAdmin({ loading: false, isAuthenticated: true, isAdmin: true });
    expect(await screen.findByText('Admin Content')).toBeInTheDocument();
  });

  it('renders children when admin, MFA required, and a verified factor exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    renderAdmin({
      loading: false, isAuthenticated: true, isAdmin: true,
      listMFAFactors: async () => ({ totp: [{ status: 'verified' }] }),
    });
    expect(await screen.findByText('Admin Content')).toBeInTheDocument();
  });

  it('redirects an un-enrolled admin to /account/security when MFA is required', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    renderAdmin({
      loading: false, isAuthenticated: true, isAdmin: true,
      listMFAFactors: async () => ({ totp: [] }),
    });
    expect(await screen.findByText('Security Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });
});
