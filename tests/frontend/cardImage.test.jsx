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

  it('shows "No Image" when there is no usable fallback and the image errors', () => {
    render(<CardImage src="https://cdn/object/a.jpg" fallbackSrc="https://cdn/object/a.jpg" alt="A card" />);
    fireEvent.error(screen.getByAltText('A card'));
    expect(screen.getByText('No Image')).toBeInTheDocument();
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
