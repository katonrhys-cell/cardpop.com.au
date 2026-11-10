import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

// axe-core over every tab of the organiser event form (My Events → Submit
// Event), so an unlabelled input, nameless button or bad ARIA can't ship.
// The dialog renders in a portal; axe runs over the dialog itself (Radix's
// focus-guard sentinels outside it are a known axe false positive).

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/lib/supabaseClient.js', () => {
  const b = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res) => Promise.resolve({ data: [], error: null }).then(res);
      return () => b;
    },
  });
  return { supabase: { from: () => b, storage: { from: vi.fn() } } };
});
vi.mock('@/lib/apiServerClient.js', () => {
  const client = { fetch: vi.fn() };
  return { default: client, apiServerClient: client };
});

import EventFormModal from '@/components/EventFormModal.jsx';

const TABS = ['Details', 'Venue & Dates', 'Organiser', 'SEO', 'Member Offer'];
// Colour contrast needs real layout (covered by e2e/a11y.spec.js).
const rules = { 'color-contrast': { enabled: false } };

describe('EventFormModal — axe, organiser mode', () => {
  it.each(TABS)('%s tab has no axe violations', async (tab) => {
    render(<EventFormModal isOpen onClose={() => {}} event={null} onSaved={() => {}} mode="user" />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: tab }));
    fireEvent.click(screen.getByRole('tab', { name: tab }));
    if (tab === 'Organiser') fireEvent.click(screen.getByRole('switch', { name: 'Free Entry' })); // show the price fields too
    expect(await axe(screen.getByRole('dialog'), { rules })).toHaveNoViolations();
  });
});
