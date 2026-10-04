import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ isAuthenticated: false, loading: false }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth }));

import AnnouncementBar from '@/components/AnnouncementBar.jsx';

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><AnnouncementBar /></MemoryRouter>);

beforeEach(() => { window.sessionStorage.clear(); auth.isAuthenticated = false; auth.loading = false; });

describe('AnnouncementBar', () => {
  it('tells a signed-out visitor about the first-order offer, with a signup link', () => {
    renderAt('/marketplace');
    expect(screen.getByTestId('announcement-bar')).toHaveTextContent(/10% off your first order/i);
    expect(screen.getByRole('link', { name: /create your account/i })).toHaveAttribute('href', '/signup');
  });

  it('is not shown to members', () => {
    auth.isAuthenticated = true;
    renderAt('/');
    expect(screen.queryByTestId('announcement-bar')).not.toBeInTheDocument();
  });

  it('stays out of the way on checkout and sign-up pages', () => {
    for (const path of ['/checkout', '/signup', '/login', '/admin/orders']) {
      const { unmount } = renderAt(path);
      expect(screen.queryByTestId('announcement-bar'), path).not.toBeInTheDocument();
      unmount();
    }
  });

  it('dismisses for the session', () => {
    const first = renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByTestId('announcement-bar')).not.toBeInTheDocument();
    first.unmount();
    renderAt('/shop');
    expect(screen.queryByTestId('announcement-bar')).not.toBeInTheDocument();
  });
});
