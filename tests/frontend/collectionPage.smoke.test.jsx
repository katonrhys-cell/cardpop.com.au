import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React, { Suspense } from 'react';

// Mock supabase so queries resolve to empty without network.
vi.mock('@/lib/supabaseClient.js', () => {
  const makeBuilder = () => {
    const result = Promise.resolve({ data: [], error: null, count: 0 });
    const builder = {
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      not: () => builder,
      gt: () => builder,
      ilike: () => builder,
      contains: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      then: (...a) => result.then(...a),
      catch: (...a) => result.catch(...a),
      finally: (...a) => result.finally(...a),
    };
    return builder;
  };
  return {
    supabase: {
      from: () => makeBuilder(),
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    },
  };
});

// Stub framer-motion so infinite animations don't peg the happy-dom event loop.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const passthrough = (tag) => React.forwardRef((props, ref) => {
    const { children, ...rest } = props;
    // Strip motion-only props that would warn on DOM elements
    const clean = { ...rest };
    ['initial','animate','exit','variants','transition','whileInView','whileHover','viewport'].forEach(k => delete clean[k]);
    return React.createElement(tag, { ...clean, ref }, children);
  });
  const motion = new Proxy({}, { get: (_t, tag) => passthrough(tag) });
  return { motion, AnimatePresence: ({ children }) => children };
});

import CollectionPage from '@/pages/collections/CollectionPage.jsx';

describe('CollectionPage /collections/nba', () => {
  it('renders without crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/collections/nba']}>
        <Suspense fallback={<div>loading</div>}>
          <Routes>
            <Route path="/collections/:collectionSlug" element={<CollectionPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );
    // The hero heading uses the config name "NBA Cards"
    expect(await screen.findByText('NBA Cards')).toBeInTheDocument();
  });
});
