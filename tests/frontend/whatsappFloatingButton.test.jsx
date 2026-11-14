import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

vi.mock('@/lib/analytics.js', () => ({ trackEvent: vi.fn() }));

import WhatsAppFloatingButton, { showsChatButton } from '@/components/WhatsAppFloatingButton.jsx';
import { BOTTOM_BAR_INSET_VAR, setBottomBarInset, useBottomBarInset } from '@/lib/bottomBarInset.js';
import { WHATSAPP_GREETING } from '@/utils/whatsapp.js';

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <WhatsAppFloatingButton />
  </MemoryRouter>,
);

const inset = () => document.documentElement.style.getPropertyValue(BOTTOM_BAR_INSET_VAR);

afterEach(() => {
  cleanup();
  for (const key of ['a', 'b', 'test-bar']) setBottomBarInset(key, 0);
});

describe('WhatsAppFloatingButton', () => {
  it('is a labelled chat link pinned to the bottom-right of a public page', async () => {
    const { container } = renderAt('/shop/binders/9-pocket-zip-binder');
    const link = screen.getByRole('link', { name: 'Chat with us on WhatsApp' });
    const url = new URL(link.getAttribute('href'));
    expect(url.origin + url.pathname).toBe('https://wa.me/61406378473');
    expect(url.searchParams.get('text')).toContain('https://cardpop.com.au/shop/binders/9-pocket-zip-binder');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.className).toMatch(/\bfixed\b/);
    expect(link.className).toMatch(/\bright-4\b/);
    // Stays under dialogs, drawers and the header (z-50), and out of print.
    expect(link.className).toMatch(/\bz-40\b/);
    expect(link.className).toMatch(/print:hidden/);
    // Lifts above whichever bottom bar has reported its height.
    expect(link.style.bottom).toContain(`var(${BOTTOM_BAR_INSET_VAR}, 0px)`);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows on the home page, checkout and account pages, with the plain greeting where the page is private', () => {
    for (const path of ['/', '/checkout', '/account/orders', '/login']) {
      renderAt(path);
      const link = screen.getByTestId('whatsapp-floating-button');
      if (path !== '/') expect(new URL(link.href).searchParams.get('text')).toBe(WHATSAPP_GREETING);
      cleanup();
    }
  });

  it('stays off the admin panel and the member inbox', () => {
    for (const path of ['/admin', '/admin/orders', '/messaging', '/messaging/abc']) {
      renderAt(path);
      expect(screen.queryByTestId('whatsapp-floating-button')).toBeNull();
      cleanup();
    }
    expect(showsChatButton('/administrators-guide')).toBe(true);
    expect(showsChatButton('/shop')).toBe(true);
  });
});

describe('bottom bar inset', () => {
  it('publishes the tallest bar and clears the variable when none is up', () => {
    expect(inset()).toBe('');
    setBottomBarInset('a', 64);
    expect(inset()).toBe('64px');
    setBottomBarInset('b', 73.4);
    expect(inset()).toBe('73px');
    setBottomBarInset('b', 0);
    expect(inset()).toBe('64px');
    setBottomBarInset('a', 0);
    expect(inset()).toBe('');
  });

  it('reports a mounted bar and clears it on unmount', () => {
    const Bar = () => {
      const ref = useBottomBarInset('test-bar');
      return <div ref={(el) => { if (el) Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 80 }); ref(el); }}>bar</div>;
    };
    const { unmount } = render(<Bar />);
    expect(inset()).toBe('80px');
    unmount();
    expect(inset()).toBe('');
  });
});
