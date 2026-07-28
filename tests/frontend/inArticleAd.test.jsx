import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';

import InArticleAd from '@/components/InArticleAd.jsx';

const getIns = (container) => container.querySelector('ins.adsbygoogle');

afterEach(() => {
  document.querySelectorAll('script[src*="googlesyndication"]').forEach((s) => s.remove());
});

describe('InArticleAd', () => {
  it('renders the ad slot with its spacing while a fill is pending', () => {
    const { container } = render(<InArticleAd className="my-10" />);
    const ins = getIns(container);
    expect(ins).toBeTruthy();
    expect(ins.getAttribute('data-ad-slot')).toBe('6597510546');
    expect(container.firstChild.className).toBe('my-10');
  });

  it('collapses the slot and its spacing when AdSense reports no fill', async () => {
    const { container } = render(<InArticleAd className="my-10" />);
    // AdSense marks an unfilled slot with this attribute but leaves the <ins>
    // at its reserved height, which would otherwise leave a blank gap.
    getIns(container).setAttribute('data-ad-status', 'unfilled');

    await waitFor(() => {
      expect(container.firstChild.className).toBe('hidden');
    });
  });

  it('keeps the slot visible when AdSense fills it', async () => {
    const { container } = render(<InArticleAd className="my-10" />);
    getIns(container).setAttribute('data-ad-status', 'filled');

    await waitFor(() => {
      expect(container.firstChild.className).toBe('my-10');
    });
  });
});
