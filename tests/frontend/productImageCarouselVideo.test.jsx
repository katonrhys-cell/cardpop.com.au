import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';

vi.mock('@/components/CardMicroscope.jsx', () => ({ default: () => null }));
vi.mock('@/components/vault/CardShowcase.jsx', () => ({ default: () => null }));

const USER = 'c6d78f8c-16ba-4ca5-bd3d-6b3184d77ee8';

describe('ProductImageCarousel with a clip in the photo list', () => {
  it('shows the clip as the video slot, not as a blank photo', () => {
    render(
      <ProductImageCarousel
        images={[`${USER}/1.webp`, `${USER}/2-extra-a.webp`, `${USER}/3-extra-b.mp4`]}
        record={{ card_name: 'Kanto Starter Set' }}
      />,
    );
    // Two photos + one video → three slots, the last one a play button.
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    // The .mp4 is never offered as a photo thumbnail.
    const photoThumbs = screen.getAllByAltText(/thumbnail$/);
    expect(photoThumbs).toHaveLength(2);
    photoThumbs.forEach((img) => expect(img.getAttribute('src')).not.toMatch(/\.mp4/));
  });

  it('keeps an explicit video prop ahead of a stray clip', () => {
    render(
      <ProductImageCarousel
        images={[`${USER}/1.webp`, `${USER}/3-extra-b.mp4`]}
        video={`${USER}/9-video.mov`}
        record={{ card_name: 'Goku' }}
      />,
    );
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Play video' })).toHaveLength(1);
  });
});
