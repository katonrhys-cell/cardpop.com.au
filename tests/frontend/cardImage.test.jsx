import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Spy on the session flag so we can assert a failed transform flips it.
vi.mock('@/utils/imageUrl.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, markTransformsUnavailable: vi.fn(actual.markTransformsUnavailable) };
});

import CardImage from '@/components/CardImage.jsx';
import { markTransformsUnavailable, _resetTransformState } from '@/utils/imageUrl.js';

beforeEach(() => {
  _resetTransformState();
  vi.clearAllMocks();
});

describe('CardImage', () => {
  it('shows the "No Image" fallback when there is no src', () => {
    render(<CardImage src={null} alt="x" />);
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  it('renders srcSet + sizes when provided', () => {
    render(
      <CardImage
        src="https://cdn/render/a.jpg?w=400"
        srcSet="https://cdn/render/a.jpg?w=240 240w, https://cdn/render/a.jpg?w=400 400w"
        sizes="50vw"
        fallbackSrc="https://cdn/object/a.jpg"
        alt="A card"
      />,
    );
    const img = screen.getByAltText('A card');
    expect(img.getAttribute('srcset')).toContain('240w');
    expect(img.getAttribute('sizes')).toBe('50vw');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('falls back to the original src (and disables transforms) when the transformed url errors', () => {
    render(
      <CardImage
        src="https://cdn/render/a.jpg?w=400"
        srcSet="https://cdn/render/a.jpg?w=240 240w"
        sizes="50vw"
        fallbackSrc="https://cdn/object/a.jpg"
        alt="A card"
      />,
    );
    const img = screen.getByAltText('A card');
    expect(img.getAttribute('src')).toContain('render');

    // Simulate the transformed URL failing to load.
    fireEvent.error(img);

    const after = screen.getByAltText('A card');
    expect(after.getAttribute('src')).toBe('https://cdn/object/a.jpg');
    // srcset is dropped once we're on the fallback
    expect(after.getAttribute('srcset')).toBeFalsy();
    expect(markTransformsUnavailable).toHaveBeenCalledTimes(1);
  });

  it('steps transform → fallback → canonical (non-CDN origin) before giving up', () => {
    render(
      <CardImage
        src="https://cdn/render/a.jpg?w=400"
        srcSet="https://cdn/render/a.jpg?w=240 240w"
        sizes="50vw"
        fallbackSrc="https://cdn/object/a.jpg"
        canonicalSrc="https://origin/object/a.jpg"
        alt="A card"
      />,
    );
    // transform → CDN fallback
    fireEvent.error(screen.getByAltText('A card'));
    expect(screen.getByAltText('A card').getAttribute('src')).toBe('https://cdn/object/a.jpg');
    // CDN fallback → canonical Supabase origin (self-heals a CDN outage)
    fireEvent.error(screen.getByAltText('A card'));
    expect(screen.getByAltText('A card').getAttribute('src')).toBe('https://origin/object/a.jpg');
    // only after the origin also fails do we show "No Image"
    fireEvent.error(screen.getByAltText('A card'));
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  it('opts out of the global CDN fallback handler via data-managed-image', () => {
    render(<CardImage src="https://cdn/object/a.jpg" alt="A card" />);
    expect(screen.getByAltText('A card')).toHaveAttribute('data-managed-image');
  });

  it('shows "No Image" when there is no usable fallback and the image errors', () => {
    render(<CardImage src="https://cdn/object/a.jpg" fallbackSrc="https://cdn/object/a.jpg" alt="A card" />);
    fireEvent.error(screen.getByAltText('A card'));
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  it('keeps an already-loaded image visible when its src changes (no blank flicker on scroll)', () => {
    const { rerender } = render(<CardImage src="https://cdn/render/a.jpg?w=400" alt="A card" />);
    const img = screen.getByAltText('A card');

    // Photo has loaded and is on screen.
    fireEvent.load(img);
    expect(img.className).toContain('opacity-100');

    // Session flips to untransformed URLs, so getCardImage now hands the same
    // visual card a different `src`. Re-render with the new URL: the image must
    // NOT blank back to opacity-0 — the browser swaps the source in place.
    rerender(<CardImage src="https://cdn/object/a.jpg" alt="A card" />);
    expect(screen.getByAltText('A card').className).toContain('opacity-100');
  });

  it('reveals a cached image that finished loading before onLoad could attach', () => {
    // Simulate a browser-cached image: `complete` is already true (with real
    // dimensions) at mount, so the `load` event never reaches our handler.
    const completeSpy = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const widthSpy = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(400);

    render(<CardImage src="https://cdn/object/a.jpg" alt="A card" />);

    // Without firing onLoad the image should still be revealed (not stuck hidden).
    expect(screen.getByAltText('A card').className).toContain('opacity-100');

    completeSpy.mockRestore();
    widthSpy.mockRestore();
  });
});
