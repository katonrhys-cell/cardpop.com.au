import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import CardShowcase from '@/components/vault/CardShowcase.jsx';
import { DISPLAY_STYLES } from '@/lib/displayStyles.js';

const baseProps = {
  src: 'https://cdn/render/card.jpg?w=400',
  fallbackSrc: 'https://cdn/object/card.jpg',
  alt: 'A trading card',
};

describe('CardShowcase', () => {
  it('mounts cleanly for every registered style and keeps the photo', () => {
    for (const style of DISPLAY_STYLES) {
      const { container, unmount } = render(
        <CardShowcase {...baseProps} displayStyle={style.key} />,
      );
      // The card image is always rendered — the frame is decoration around it.
      expect(screen.getByAltText('A trading card')).toBeInTheDocument();
      expect(container.querySelector(`.cardshowcase--${style.key}`)).toBeTruthy();
      unmount();
    }
  });

  it('coerces an unknown style to the classic baseline', () => {
    const { container } = render(
      <CardShowcase {...baseProps} displayStyle="not-a-real-style" />,
    );
    expect(container.querySelector('.cardshowcase--classic')).toBeTruthy();
  });

  it('only renders the holographic overlay for the holographic style', () => {
    const { container: holo } = render(
      <CardShowcase {...baseProps} displayStyle="holographic" />,
    );
    expect(holo.querySelector('.cardshowcase__holo')).toBeTruthy();

    const { container: classic } = render(
      <CardShowcase {...baseProps} displayStyle="classic" />,
    );
    expect(classic.querySelector('.cardshowcase__holo')).toBeNull();
  });

  it('still renders the image when src is missing (No Image fallback)', () => {
    render(<CardShowcase displayStyle="glass" alt="Empty" src={null} />);
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });
});
