import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React, { Suspense } from 'react';

// Every vault_items query a collection page makes must carry the collection's
// category filter. The Holy Grail strip used to run its "highest value" query
// even before the category id resolved, which dropped the filter and showed the
// site's priciest Pokémon and NBA cards under "Stanley Cup Rarities" on
// /collections/nhl. Here the categories table answers with no matching row, so
// the id never resolves and no vault_items query may be sent at all.
const fromSpy = vi.fn();

vi.mock('@/lib/supabaseClient.js', () => {
  const makeBuilder = () => {
    const result = Promise.resolve({ data: [], error: null, count: 0 });
    const builder = {};
    for (const m of ['select', 'eq', 'neq', 'not', 'gt', 'or', 'ilike', 'contains', 'in', 'order', 'limit', 'range']) {
      builder[m] = () => builder;
    }
    builder.then = (...a) => result.then(...a);
    builder.catch = (...a) => result.catch(...a);
    builder.finally = (...a) => result.finally(...a);
    return builder;
  };
  return {
    supabase: {
      from: (table) => { fromSpy(table); return makeBuilder(); },
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    },
  };
});

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const passthrough = (tag) => React.forwardRef((props, ref) => {
    const { children, ...rest } = props;
    const clean = { ...rest };
    ['initial','animate','exit','variants','transition','whileInView','whileHover','viewport'].forEach(k => delete clean[k]);
    return React.createElement(tag, { ...clean, ref }, children);
  });
  const motion = new Proxy({}, { get: (_t, tag) => passthrough(tag) });
  return { motion, AnimatePresence: ({ children }) => children };
});

import CollectionPage from '@/pages/collections/CollectionPage.jsx';

describe('CollectionPage card queries are scoped to the collection', () => {
  it('sends no vault_items query while the collection has no category id', async () => {
    render(
      <MemoryRouter initialEntries={['/collections/nhl']}>
        <Suspense fallback={<div>loading</div>}>
          <Routes>
            <Route path="/collections/:collectionSlug" element={<CollectionPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { level: 1 });
    // Let every mount effect and its resolved promise settle.
    await new Promise(r => setTimeout(r, 50));
    expect(fromSpy).toHaveBeenCalled();
    expect(fromSpy.mock.calls.map(([t]) => t)).not.toContain('vault_items');
  });
});
