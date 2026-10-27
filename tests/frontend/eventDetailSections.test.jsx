import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// EventRsvp pulls in auth + supabase; the sections under test don't need it.
vi.mock('@/components/EventRsvp.jsx', () => ({ default: () => <div data-testid="rsvp" /> }));

import EventDetailCard from '@/components/EventDetailCard.jsx';
import EventDetailModal from '@/components/EventDetailModal.jsx';

const baseEvent = {
  id: 'evt-1',
  name: 'Test Card Show',
  title: 'Test Card Show',
  type: 'Card Show',
  image: 'https://example.com/poster.jpg',
  description: 'A great show.',
  date: 'October 1, 2026',
  time: '10:00 AM',
  location: 'Sydney, NSW',
  start_date: '2026-10-01',
};

const renderCard = (event) => render(
  <MemoryRouter><EventDetailCard event={event} /></MemoryRouter>,
);

const renderModal = (event) => render(
  <MemoryRouter>
    <EventDetailModal isOpen={true} onClose={() => {}} event={event} />
  </MemoryRouter>,
);

describe('EventDetailCard — accessibility & age restriction sections', () => {
  it('hides both sections when the fields are empty', () => {
    renderCard(baseEvent);
    expect(screen.queryByText('Accessibility')).not.toBeInTheDocument();
    expect(screen.queryByText('Age Restrictions')).not.toBeInTheDocument();
  });

  it('shows the Accessibility section under About This Event when filled', () => {
    renderCard({ ...baseEvent, accessibility_info: 'Wheelchair accessible venue with step-free entry' });
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Wheelchair accessible venue with step-free entry')).toBeInTheDocument();
    expect(screen.queryByText('Age Restrictions')).not.toBeInTheDocument();
  });

  it('shows the Age Restrictions section when filled', () => {
    renderCard({ ...baseEvent, age_restrictions: '18+' });
    expect(screen.getByText('Age Restrictions')).toBeInTheDocument();
    expect(screen.getByText('18+')).toBeInTheDocument();
    expect(screen.queryByText('Accessibility')).not.toBeInTheDocument();
  });
});

describe('EventDetailCard — video embeds', () => {
  it('shows no video section when neither URL is set', () => {
    renderCard(baseEvent);
    expect(screen.queryByText('Event Video')).not.toBeInTheDocument();
    expect(screen.queryByText('Event Videos')).not.toBeInTheDocument();
  });

  it('embeds a Facebook video alone under About This Event', () => {
    renderCard({ ...baseEvent, facebook_video_url: 'https://www.facebook.com/reel/123' });
    expect(screen.getByText('Event Video')).toBeInTheDocument();
    const iframe = screen.getByTitle('Test Card Show — Facebook video');
    expect(iframe.getAttribute('src')).toContain('https://www.facebook.com/plugins/video.php');
    expect(screen.queryByTitle('Test Card Show — event video')).not.toBeInTheDocument();
  });

  it('stacks the Facebook embed beneath the YouTube embed when both are set', () => {
    renderCard({
      ...baseEvent,
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      facebook_video_url: 'https://www.facebook.com/somepage/videos/123/',
    });
    expect(screen.getByText('Event Videos')).toBeInTheDocument();
    const yt = screen.getByTitle('Test Card Show — event video');
    const fb = screen.getByTitle('Test Card Show — Facebook video');
    expect(yt.getAttribute('src')).toContain('youtube-nocookie.com/embed');
    expect(fb.getAttribute('src')).toContain('facebook.com/plugins/video.php');
    // The YouTube iframe precedes the Facebook one in document order.
    expect(yt.compareDocumentPosition(fb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ignores a non-Facebook URL in facebook_video_url', () => {
    renderCard({ ...baseEvent, facebook_video_url: 'https://evil.example.com/videos/1' });
    expect(screen.queryByTitle('Test Card Show — Facebook video')).not.toBeInTheDocument();
  });
});

describe('EventDetailCard — YouTube 10s autoplay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('enables the iframe player API on the embed src', () => {
    renderCard({ ...baseEvent, youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    const yt = screen.getByTitle('Test Card Show — event video');
    expect(yt.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1');
  });

  it('sends mute + playVideo to the player 10 seconds after load, not before', () => {
    vi.useFakeTimers();
    renderCard({ ...baseEvent, youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    const yt = screen.getByTitle('Test Card Show — event video');
    const postMessage = vi.fn();
    // happy-dom doesn't give cross-origin iframes a real contentWindow; stub it.
    Object.defineProperty(yt, 'contentWindow', { value: { postMessage }, configurable: true });

    act(() => { vi.advanceTimersByTime(9_000); });
    expect(postMessage).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1_000); });
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenNthCalledWith(1, JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
    expect(postMessage).toHaveBeenNthCalledWith(2, JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
  });
});

describe('EventDetailModal — accessibility & age restriction sections', () => {
  it('hides both sections when the fields are empty', () => {
    renderModal(baseEvent);
    expect(screen.queryByText('Accessibility')).not.toBeInTheDocument();
    expect(screen.queryByText('Age Restrictions')).not.toBeInTheDocument();
  });

  it('shows both sections when the fields are filled', () => {
    renderModal({
      ...baseEvent,
      accessibility_info: 'Accessible parking and toilets available',
      age_restrictions: 'All ages — under 15s must be accompanied by an adult',
    });
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Accessible parking and toilets available')).toBeInTheDocument();
    expect(screen.getByText('Age Restrictions')).toBeInTheDocument();
    expect(screen.getByText('All ages — under 15s must be accompanied by an adult')).toBeInTheDocument();
  });
});

describe('EventDetailCard — photo gallery', () => {
  it('shows no gallery when the event has no photos', () => {
    renderCard({ ...baseEvent, gallery_images: [] });
    expect(screen.queryByText('Event Photos')).not.toBeInTheDocument();
  });

  it('shows the photos directly below About This Event, before the other sections', () => {
    renderCard({
      ...baseEvent,
      accessibility_info: 'Step-free entry',
      gallery_images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
    const heading = screen.getByText('Event Photos');
    expect(screen.getAllByRole('button', { name: /^Open photo/ })).toHaveLength(2);
    const about = screen.getByText('About This Event');
    const access = screen.getByText('Accessibility');
    expect(about.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.compareDocumentPosition(access) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('drops unsafe URLs', () => {
    renderCard({ ...baseEvent, gallery_images: ['javascript:alert(1)'] });
    expect(screen.queryAllByRole('button', { name: /^Open photo/ })).toHaveLength(0);
  });
});

describe('EventDetailCard — ticket prices', () => {
  it('lists the extra ticket prices under Entry', () => {
    renderCard({
      ...baseEvent, entry_fee_aud: 15,
      ticket_prices: [{ type: 'child', price_aud: 5 }, { type: 'group', group_size: 4, price_aud: 50 }],
    });
    expect(screen.getByText('$15.00 AUD')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByText('Group of 4')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('drops "see organiser" when only extra prices are set, and hides them on a free event', () => {
    const { unmount } = renderCard({ ...baseEvent, ticket_prices: [{ type: 'vip', price_aud: 80 }] });
    expect(screen.queryByText('See organiser for ticket pricing')).not.toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    unmount();
    renderCard({ ...baseEvent, is_free: true, ticket_prices: [{ type: 'vip', price_aud: 80 }] });
    expect(screen.getByText('Free entry')).toBeInTheDocument();
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
  });
});
