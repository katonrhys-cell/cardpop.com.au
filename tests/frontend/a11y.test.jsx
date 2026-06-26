import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

// ─────────────────────────────────────────────────────────────────────────────
// Automated accessibility (axe-core) checks for high-traffic UI.
//
// These guard against the most common, machine-detectable WCAG failures:
// inputs without labels, links/buttons with no accessible name, images with no
// alt text, bad ARIA, and (where colours are static) contrast. axe only catches
// ~30–50% of issues — keyboard/focus/screen-reader flows still need the manual
// audit tracked in docs/SITE_IMPROVEMENT_ROADMAP.md #7 — but it stops the easy
// regressions from ever shipping.
//
// Components that render bare content (no landmark) are wrapped in <main> so the
// axe "region" rule doesn't fire on test scaffolding rather than the component.
// ─────────────────────────────────────────────────────────────────────────────

// Newsletter signup hits the network on submit; stub it out so the Footer test
// stays a pure markup check.
vi.mock('@/components/NewsletterSignup.jsx', () => ({
  default: () => (
    <form aria-label="Newsletter signup">
      <label htmlFor="nl-email">Email</label>
      <input id="nl-email" type="email" />
      <button type="submit">Subscribe</button>
    </form>
  ),
}));

vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import GradeBadge from '@/components/GradeBadge.jsx';
import BuyerProtection from '@/components/BuyerProtection.jsx';
import Footer from '@/components/Footer.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

const main = (ui) => <main>{ui}</main>;
const router = (ui) => <MemoryRouter>{ui}</MemoryRouter>;

describe('Accessibility — UI primitives', () => {
  it('Button (default) has no axe violations', async () => {
    const { container } = render(main(<Button>Buy now</Button>));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Icon-only button needs an accessible name (aria-label)', async () => {
    const { container } = render(
      main(
        <Button size="icon" aria-label="Add to watchlist">
          <svg aria-hidden="true" />
        </Button>,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Labelled input (Label + Input) has no axe violations', async () => {
    const { container } = render(
      main(
        <div>
          <Label htmlFor="search">Search cards</Label>
          <Input id="search" type="text" placeholder="e.g. Charizard" />
        </div>,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Accessibility — components', () => {
  it('Breadcrumb nav has no axe violations', async () => {
    const { container } = render(
      router(
        <Breadcrumb
          items={[
            { label: 'Home', path: '/' },
            { label: 'Marketplace', path: '/marketplace' },
            { label: 'Charizard' },
          ]}
        />,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('GradeBadge has no axe violations', async () => {
    const { container } = render(main(<GradeBadge grade="PSA 10" />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('BuyerProtection (full) has no axe violations', async () => {
    const { container } = render(main(<BuyerProtection />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('BuyerProtection (compact) has no axe violations', async () => {
    const { container } = render(main(<BuyerProtection compact />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Footer has no axe violations', async () => {
    const { container } = render(router(<Footer />));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Accessibility — key flows', () => {
  it('Login form has no axe violations', async () => {
    useAuth.mockReturnValue({
      login: vi.fn(),
      verifyMFACode: vi.fn(),
      isAuthenticated: false,
      loading: false,
    });
    const { container } = render(router(<LoginPage />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
