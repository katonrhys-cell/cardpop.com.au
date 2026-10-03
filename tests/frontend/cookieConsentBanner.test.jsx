import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const renderAt = async (path) => {
  vi.resetModules();
  const { default: Banner } = await import('@/components/CookieConsentBanner.jsx');
  return render(<MemoryRouter initialEntries={[path]}><Banner /></MemoryRouter>);
};

beforeEach(() => { window.localStorage.clear(); });

describe('CookieConsentBanner', () => {
  it('shows until a choice is made, then stores it and disappears', async () => {
    await renderAt('/shop');
    expect(screen.getByRole('region', { name: /cookie preferences/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    expect(window.localStorage.getItem('cardpop_cookie_consent')).toBe('all');
    expect(screen.queryByRole('region', { name: /cookie preferences/i })).not.toBeInTheDocument();
  });

  it('"Essentials only" records the refusal', async () => {
    await renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /essentials only/i }));
    expect(window.localStorage.getItem('cardpop_cookie_consent')).toBe('essential');
  });

  it('stays out of the way on checkout', async () => {
    await renderAt('/checkout');
    expect(screen.queryByRole('region', { name: /cookie preferences/i })).not.toBeInTheDocument();
  });

  it('does not render once a choice exists', async () => {
    window.localStorage.setItem('cardpop_cookie_consent', 'essential');
    await renderAt('/marketplace');
    expect(screen.queryByRole('region', { name: /cookie preferences/i })).not.toBeInTheDocument();
  });
});
