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

  it('only renders the holographic overlays for the holographic style', () => {
    const { container: holo } = render(
      <CardShowcase {...baseProps} displayStyle="holographic" />,
    );
    expect(holo.querySelector('.cardshowcase__holo')).toBeTruthy();
    // The foil look is three layers: rainbow, glitter field and glare.
    expect(holo.querySelector('.cardshowcase__sparkle')).toBeTruthy();
    expect(holo.querySelector('.cardshowcase__glare')).toBeTruthy();

    const { container: classic } = render(
      <CardShowcase {...baseProps} displayStyle="classic" />,
    );
    expect(classic.querySelector('.cardshowcase__holo')).toBeNull();
    expect(classic.querySelector('.cardshowcase__sparkle')).toBeNull();
  });

  it('renders the style-specific layers for the new styles', () => {
    const { container: spotlight } = render(
      <CardShowcase {...baseProps} displayStyle="spotlight" />,
    );
    expect(spotlight.querySelector('.cardshowcase__beam')).toBeTruthy();
    expect(spotlight.querySelector('.cardshowcase__shadow')).toBeTruthy();

    const { container: prism } = render(
      <CardShowcase {...baseProps} displayStyle="prism" />,
    );
    expect(prism.querySelector('.cardshowcase__prism')).toBeTruthy();

    // Neon is a pure filter effect — no extra layers beyond the card itself.
    const { container: neon } = render(
      <CardShowcase {...baseProps} displayStyle="neon" />,
    );
    expect(neon.querySelector('.cardshowcase--neon')).toBeTruthy();
    expect(neon.querySelector('.cardshowcase__beam')).toBeNull();
  });

  it('renders the spinning card with a branded back face on the CardPop stand', () => {
    const { container } = render(
      <CardShowcase {...baseProps} displayStyle="spinning" />,
    );
    // Front and back faces of the 3D plane, with the CardPop-branded back.
    expect(container.querySelector('.cardshowcase__face--front')).toBeTruthy();
    expect(container.querySelector('.cardshowcase__face--back')).toBeTruthy();
    expect(container.querySelector('.cardshowcase__backcard')).toBeTruthy();
    // The turntable base carries the CardPop wordmark plate.
    const prop = container.querySelector('.cardshowcase__prop');
    expect(prop).toBeTruthy();
    expect(prop.querySelector('.cardshowcase__plate')).toBeTruthy();
    expect(prop.textContent).toBe('CardPop');
    // The photo itself is still there.
    expect(screen.getByAltText('A trading card')).toBeInTheDocument();
  });

  it('puts the CardPop wordmark plate on the Premium Stand base too', () => {
    const { container } = render(
      <CardShowcase {...baseProps} displayStyle="stand" />,
    );
    const prop = container.querySelector('.cardshowcase__prop');
    expect(prop.querySelector('.cardshowcase__plate')).toBeTruthy();
    expect(prop.textContent).toBe('CardPop');

    // The slab's prop (its label strip) stays unbranded, and non-stand styles
    // never grow a plate.
    const { container: slab } = render(
      <CardShowcase {...baseProps} displayStyle="slab" />,
    );
    expect(slab.querySelector('.cardshowcase__prop')).toBeTruthy();
    expect(slab.querySelector('.cardshowcase__plate')).toBeNull();

    const { container: classic } = render(
      <CardShowcase {...baseProps} displayStyle="classic" />,
    );
    expect(classic.querySelector('.cardshowcase__plate')).toBeNull();
  });

  it('still renders the image when src is missing (No Image fallback)', () => {
    render(<CardShowcase displayStyle="glass" alt="Empty" src={null} />);
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });
});
