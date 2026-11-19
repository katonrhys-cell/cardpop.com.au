import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VideoCreatorCredit from '@/components/events/VideoCreatorCredit.jsx';

describe('VideoCreatorCredit', () => {
  it('shows the picture, name and one link per social with its handle', () => {
    render(<VideoCreatorCredit creator={{
      name: 'Simple Simon',
      avatar_url: 'https://example.supabase.co/storage/v1/object/public/events/logos/creator-1.webp',
      instagram: 'https://www.instagram.com/thenew50noob',
      youtube: 'https://www.youtube.com/@SimpleSimon',
    }} />);
    expect(screen.getByAltText('Simple Simon profile picture')).toBeTruthy();
    expect(screen.getByText('Simple Simon')).toBeTruthy();
    const insta = screen.getByRole('link', { name: /Simple Simon on Instagram/ });
    expect(insta.getAttribute('href')).toBe('https://www.instagram.com/thenew50noob');
    expect(insta.getAttribute('rel')).toBe('noopener noreferrer');
    expect(insta.textContent).toBe('@thenew50noob');
    expect(screen.getByRole('link', { name: /on YouTube/ }).textContent).toBe('@SimpleSimon');
  });

  it('links a saved creator to their page, unless told not to', () => {
    const creator = { name: 'Simple Simon', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'simple-simon' };
    const { unmount } = render(<VideoCreatorCredit creator={creator} />);
    expect(screen.getByRole('link', { name: 'Simple Simon' }).getAttribute('href')).toBe('/creators/simple-simon');
    expect(screen.getByRole('link', { name: 'More event videos by Simple Simon' }).getAttribute('href')).toBe('/creators/simple-simon');
    unmount();
    render(<VideoCreatorCredit creator={creator} linkProfile={false} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders nothing without a credit', () => {
    const { container } = render(<VideoCreatorCredit creator={null} />);
    expect(container.innerHTML).toBe('');
  });
});
