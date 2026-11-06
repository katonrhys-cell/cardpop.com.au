import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { describe, it, expect, vi, afterEach } from 'vitest';

// tests/setup.js mocks Helmet out; this file checks what it does to <head>.
vi.unmock('react-helmet-async');
vi.mock('@/components/NewsletterSignup.jsx', () => ({ default: () => <form aria-label="Newsletter signup" /> }));

import Footer from '@/components/Footer.jsx';
import SEOHead from '@/components/SEOHead.jsx';

// Levels in document order, and the first place one jumps more than one level
// deeper than the heading before it (h2 → h4) — what the site audit flags as
// "Heading levels skip".
const levels = (root) => [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
const firstSkip = (ls) => ls.findIndex((l, i) => i > 0 && l > ls[i - 1] + 1);

describe('heading outline', () => {
  // The footer follows every page. Its column titles were <h4>, so any page
  // whose last content heading was an <h2> (every product page, the binders
  // hub, a collection page whose grid was still loading) skipped h2 → h4.
  it('footer column titles are <h2>, so no page skips into the footer', () => {
    const { container } = render(
      <MemoryRouter>
        <main><h1>Product</h1><h2>Specifications</h2></main>
        <Footer />
      </MemoryRouter>,
    );
    const ls = levels(container);
    expect(ls.filter((l) => l >= 4)).toEqual([]);
    expect(firstSkip(ls)).toBe(-1);
  });
});

describe('SEOHead and the static shell', () => {
  afterEach(() => { document.head.innerHTML = ''; });

  // index.html ships a default description (data-rh="true") for no-JS readers.
  // Helmet must replace it, not add a second one beside it: crawlers read the
  // first <meta name="description">, which was the homepage's on every page.
  it('replaces the shell\'s description instead of duplicating it', async () => {
    document.head.innerHTML = '<meta data-rh="true" name="description" content="Homepage default" />'
      + '<meta data-rh="true" property="og:title" content="Homepage default" />';
    render(
      <HelmetProvider>
        <SEOHead title="Top Loaders 35pt | CardPop Australia" description="Product description" canonicalUrl="https://cardpop.com.au/shop/top-loaders/x" />
      </HelmetProvider>,
    );
    await waitFor(() => {
      const descs = [...document.head.querySelectorAll('meta[name="description"]')].map((m) => m.getAttribute('content'));
      expect(descs).toEqual(['Product description']);
    });
    const ogTitles = [...document.head.querySelectorAll('meta[property="og:title"]')].map((m) => m.getAttribute('content'));
    expect(ogTitles).toEqual(['Top Loaders 35pt | CardPop Australia']);
  });
});
