import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

// The seller-chosen display style has to survive all the way to the surfaces a
// buyer actually looks at: the marketplace grid and the listing detail page.
// Both used to render a plain <CardImage> and silently dropped display_style.

vi.mock('@/contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isAuthenticated: false, currentUser: null }),
}));
vi.mock('@/hooks/useWatchlist.js', () => ({
  useWatchlist: () => ({ isWatchlisted: () => false, toggle: vi.fn() }),
}));
vi.mock('@/components/SellerRatingDisplay.jsx', () => ({ default: () => null }));
vi.mock('@/components/CardMicroscope.jsx', () => ({ default: () => null }));

const MarketplaceListingCard = (await import('@/components/MarketplaceListingCard.jsx')).default;
const ProductImageCarousel = (await import('@/components/ProductImageCarousel.jsx')).default;

const listing = (displayStyle) => ({
  id: 'l1',
  status: 'active',
  price_aud: 250,
  seller_id: 's1',
  title: 'Noa Essengue',
  vault_item: {
    id: 'v1',
    card_name: 'Noa Essengue',
    display_style: displayStyle,
    card_image: 'https://cdn/object/noa.jpg',
  },
});

const renderCard = (displayStyle) =>
  render(
    <MemoryRouter initialEntries={['/marketplace']}>
      <MarketplaceListingCard listing={listing(displayStyle)} />
    </MemoryRouter>,
  );

describe('MarketplaceListingCard × display style', () => {
  it('renders the grid tile in the listing\'s chosen style', () => {
    const { container } = renderCard('holographic');
    expect(container.querySelector('.cardshowcase--holographic')).toBeTruthy();
    // The holographic overlay layer is what produces the shine.
    expect(container.querySelector('.cardshowcase__holo')).toBeTruthy();
  });

  it('keeps the plain grid image for classic listings', () => {
    const { container } = renderCard('classic');
    expect(container.querySelector('.cardshowcase')).toBeNull();
    expect(screen.getByAltText('Noa Essengue')).toBeInTheDocument();
  });

  it('keeps the plain grid image when no style is stored', () => {
    const { container } = renderCard(undefined);
    expect(container.querySelector('.cardshowcase')).toBeNull();
  });
});

describe('ProductImageCarousel × display style', () => {
  const images = ['https://cdn/object/noa.jpg'];

  it('renders the detail-page hero in the chosen style', () => {
    const { container } = render(
      <ProductImageCarousel images={images} displayStyle="holographic" />,
    );
    expect(container.querySelector('.cardshowcase--holographic')).toBeTruthy();
    expect(container.querySelector('.cardshowcase__holo')).toBeTruthy();
  });

  it('renders Rotating Premium with its sheen and shadow layers', () => {
    const { container } = render(
      <ProductImageCarousel images={images} displayStyle="rotating" />,
    );
    expect(container.querySelector('.cardshowcase--rotating')).toBeTruthy();
    expect(container.querySelector('.cardshowcase__sheen')).toBeTruthy();
    expect(container.querySelector('.cardshowcase__shadow')).toBeTruthy();
  });

  it('leaves the hero untouched for classic / shop products', () => {
    const { container } = render(<ProductImageCarousel images={images} />);
    expect(container.querySelector('.cardshowcase')).toBeNull();
    expect(screen.getByAltText('Product view 1')).toBeInTheDocument();
  });

  it('renders an unknown stored style as classic rather than breaking', () => {
    const { container } = render(
      <ProductImageCarousel images={images} displayStyle="not-a-style" />,
    );
    expect(container.querySelector('.cardshowcase')).toBeNull();
  });

  // The feature's term: the chosen style dresses the FIRST photograph only.
  // The extra shots (backs, corners, flaws) are condition evidence and must
  // stay unembellished when the buyer clicks through the thumbnails.
  describe('applies to the first photograph only', () => {
    const multi = [
      'https://cdn/object/noa-front.jpg',
      'https://cdn/object/noa-back.jpg',
      'https://cdn/object/noa-corner.jpg',
    ];

    it('shows the style on the first photo', () => {
      const { container } = render(
        <ProductImageCarousel images={multi} displayStyle="holographic" />,
      );
      expect(container.querySelector('.cardshowcase--holographic')).toBeTruthy();
    });

    it('drops the style once a later photo is selected', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ProductImageCarousel images={multi} displayStyle="holographic" />,
      );

      await user.click(screen.getByAltText('Thumbnail 2').closest('button'));
      expect(container.querySelector('.cardshowcase')).toBeNull();
      expect(screen.getByAltText('Product view 2')).toBeInTheDocument();

      // …and comes back when the buyer returns to the first photo.
      await user.click(screen.getByAltText('Thumbnail 1').closest('button'));
      expect(container.querySelector('.cardshowcase--holographic')).toBeTruthy();
    });
  });
});
