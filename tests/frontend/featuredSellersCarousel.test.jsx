import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/FeaturedSellerCard.jsx', () => ({
  default: ({ seller }) => <div data-testid="seller-card">{seller.display_name}</div>,
}));

import FeaturedSellersCarousel from '@/components/FeaturedSellersCarousel.jsx';

const sellers = [
  { id: 's1', display_name: 'CLEET Collectables' },
  { id: 's2', display_name: 'ConwayR' },
  { id: 's3', display_name: 'CardPop' },
  { id: 's4', display_name: 'Parallel House AU' },
];

// happy-dom lays nothing out, so the track's scroll metrics are stubbed per
// test: `clientWidth` is one page, `scrollWidth` the whole strip.
function stubMetrics({ clientWidth, scrollWidth }) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scrollWidth });
}

let originals;
beforeEach(() => {
  originals = {
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
    scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
  };
});
afterEach(() => {
  for (const [k, d] of Object.entries(originals)) {
    if (d) Object.defineProperty(HTMLElement.prototype, k, d);
    else delete HTMLElement.prototype[k];
  }
});

describe('FeaturedSellersCarousel', () => {
  it('renders every seller with the reveal wrapper as the card\'s parent', () => {
    stubMetrics({ clientWidth: 900, scrollWidth: 900 });
    render(<FeaturedSellersCarousel sellers={sellers} inView />);
    const cards = screen.getAllByTestId('seller-card');
    expect(cards).toHaveLength(4);
    expect(cards[0].parentElement.className).toContain('anim-reveal-up');
    expect(cards[0].parentElement.className).toContain('snap-start');
  });

  it('hides the arrows while every seller fits on one page', () => {
    stubMetrics({ clientWidth: 900, scrollWidth: 900 });
    render(<FeaturedSellersCarousel sellers={sellers} />);
    expect(screen.queryByLabelText('Next sellers')).toBeNull();
    expect(screen.queryByLabelText('Previous sellers')).toBeNull();
  });

  it('pages forward by one viewport and wraps from the last page to the first', () => {
    stubMetrics({ clientWidth: 900, scrollWidth: 1200 });
    render(<FeaturedSellersCarousel sellers={sellers} />);
    const track = screen.getByTestId('featured-sellers-track');
    const scrollTo = vi.fn();
    track.scrollTo = scrollTo;
    track.scrollLeft = 0;

    fireEvent.click(screen.getByLabelText('Next sellers'));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });

    track.scrollLeft = 300; // now on the last page
    fireEvent.click(screen.getByLabelText('Next sellers'));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
  });

  it('pages back and wraps from the first page to the last', () => {
    stubMetrics({ clientWidth: 900, scrollWidth: 1200 });
    render(<FeaturedSellersCarousel sellers={sellers} />);
    const track = screen.getByTestId('featured-sellers-track');
    const scrollTo = vi.fn();
    track.scrollTo = scrollTo;

    track.scrollLeft = 0;
    fireEvent.click(screen.getByLabelText('Previous sellers'));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });

    track.scrollLeft = 300;
    fireEvent.click(screen.getByLabelText('Previous sellers'));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
  });
});
