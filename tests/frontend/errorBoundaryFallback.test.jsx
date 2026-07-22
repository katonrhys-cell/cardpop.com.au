import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import ErrorBoundary from '@/components/ErrorBoundary.jsx';

// Regression: the homepage renders each Featured Card / Featured Seller inside
// its own <ErrorBoundary fallback={null}>. A single malformed record that
// throws during render must drop only that item — NOT bubble to the
// route-level boundary and blank the whole homepage (which is what the
// numeric-string `.toFixed()` crash did before it was patched).
const Boom = () => {
  throw new Error('bad card data');
};

describe('ErrorBoundary fallback prop (per-item isolation)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the fallback instead of the full-screen error card', () => {
    // componentDidCatch logs the error; silence it for a clean test run.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<span>fallback-shown</span>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback-shown')).toBeInTheDocument();
    // The default "Something went wrong" screen must NOT appear.
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('a crashing item does not take down its siblings in a grid', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <div>
        <ErrorBoundary fallback={null}>
          <Boom />
        </ErrorBoundary>
        <ErrorBoundary fallback={null}>
          <span>healthy-sibling</span>
        </ErrorBoundary>
      </div>,
    );

    // The bad item rendered nothing; the good one survived.
    expect(screen.getByText('healthy-sibling')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('still shows the default error screen when no fallback is provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
