import React from 'react';
import { render, screen, act, within, fireEvent } from '@testing-library/react';
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

describe('EventDetailCard — organiser logo', () => {
  it('keeps the title full-width and renders no logo when the event has none', () => {
    renderCard(baseEvent);
    expect(screen.queryByTestId('organiser-logo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('organiser-logo-video')).not.toBeInTheDocument();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.parentElement.className).not.toContain('lg:col-span-2');
  });

  it('puts an image logo beside the title, with the title stopping at the column divider', () => {
    renderCard({ ...baseEvent, organizer_name: 'Collect-It Con', organizer_logo_url: 'https://cdn.test/logo.gif' });
    const logo = screen.getByTestId('organiser-logo');
    expect(logo).toHaveAttribute('src', 'https://cdn.test/logo.gif');
    expect(logo).toHaveAttribute('alt', 'Collect-It Con logo');
    expect(screen.getByText('Presented by Collect-It Con')).toBeInTheDocument();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.parentElement.className).toContain('lg:col-span-2');
    expect(h1.parentElement.className).toContain('lg:border-r');
    // The logo sits in the row's third column, above Event Details.
    expect(h1.parentElement.parentElement.className).toContain('lg:grid-cols-3');
    expect(h1.parentElement.parentElement).toContainElement(logo);
  });

  it('uses the logo as the Organiser row tile in Event Details, and the people icon without one', () => {
    const { unmount } = renderCard({ ...baseEvent, organizer_name: 'Collect-It Con', organizer_logo_url: 'https://cdn.test/logo.gif' });
    const tile = screen.getByTestId('organiser-logo-tile');
    expect(tile).toHaveAttribute('src', 'https://cdn.test/logo.gif');
    expect(tile.closest('div')).toContainElement(screen.getByText('Organiser'));
    unmount();

    renderCard({ ...baseEvent, organizer_name: 'Collect-It Con' });
    expect(screen.queryByTestId('organiser-logo-tile')).not.toBeInTheDocument();
    expect(screen.getByText('Organiser')).toBeInTheDocument();
  });

  it('plays a video loop muted and inline, never as an <img>', () => {
    renderCard({ ...baseEvent, organizer_logo_url: 'https://cdn.test/logo.mp4' });
    const video = screen.getByTestId('organiser-logo-video');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', 'https://cdn.test/logo.mp4');
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    expect(screen.queryByTestId('organiser-logo')).not.toBeInTheDocument();
  });

  it('ignores a logo that is not an http(s) URL', () => {
    renderCard({ ...baseEvent, organizer_logo_url: 'javascript:alert(1)' });
    expect(screen.queryByTestId('organiser-logo')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).parentElement.className).not.toContain('lg:col-span-2');
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

describe('EventDetailCard — event video list', () => {
  const videos = [
    { title: '2025 recap', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { title: '', url: 'https://youtu.be/abcdefghijk' },
    { title: 'Not a video', url: 'https://vimeo.com/123' },
  ];

  it('embeds every YouTube video from event_videos, titled, in order, and skips non-YouTube links', () => {
    renderCard({ ...baseEvent, event_videos: videos });
    expect(screen.getByText('Event Videos')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    const first = screen.getByTitle('Test Card Show — 2025 recap');
    const second = screen.getByTitle('Test Card Show — event video 2');
    expect(first.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1');
    expect(second.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?enablejsapi=1');
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('2025 recap')).toBeInTheDocument();
    expect(screen.queryByTitle(/Not a video/)).not.toBeInTheDocument();
  });

  it('prefers event_videos over the legacy youtube_url, and falls back to it when the list is empty', () => {
    const { unmount } = renderCard({ ...baseEvent, youtube_url: 'https://youtu.be/zzzzzzzzzzz', event_videos: videos.slice(0, 1) });
    expect(screen.getByTitle('Test Card Show — 2025 recap')).toBeInTheDocument();
    expect(screen.queryByTitle(/event video/)).not.toBeInTheDocument();
    unmount();
    renderCard({ ...baseEvent, youtube_url: 'https://youtu.be/zzzzzzzzzzz', event_videos: [] });
    expect(screen.getByText('Event Video')).toBeInTheDocument();
    expect(screen.getByTitle('Test Card Show — event video').getAttribute('src')).toContain('/embed/zzzzzzzzzzz');
  });

  it('puts the videos directly below the photo gallery, with the Facebook embed last', () => {
    renderCard({
      ...baseEvent,
      gallery_albums: [{ title: '', images: ['https://example.com/a.jpg'] }],
      event_videos: videos.slice(0, 1),
      facebook_video_url: 'https://www.facebook.com/reel/123',
      accessibility_info: 'Step-free entry',
    });
    const photos = screen.getByRole('heading', { name: 'Event Photos' });
    const vids = screen.getByRole('heading', { name: 'Event Videos' });
    const access = screen.getByText('Accessibility');
    expect(photos.compareDocumentPosition(vids) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(vids.compareDocumentPosition(access) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const yt = screen.getByTitle('Test Card Show — 2025 recap');
    const fb = screen.getByTitle('Test Card Show — Facebook video');
    expect(yt.compareDocumentPosition(fb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('only starts the first video automatically', () => {
    vi.useFakeTimers();
    renderCard({ ...baseEvent, event_videos: videos.slice(0, 2) });
    const first = screen.getByTitle('Test Card Show — 2025 recap');
    const second = screen.getByTitle('Test Card Show — event video 2');
    const post1 = vi.fn();
    const post2 = vi.fn();
    Object.defineProperty(first, 'contentWindow', { value: { postMessage: post1 }, configurable: true });
    Object.defineProperty(second, 'contentWindow', { value: { postMessage: post2 }, configurable: true });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(post1).toHaveBeenCalledTimes(2);
    expect(post2).not.toHaveBeenCalled();
    vi.useRealTimers();
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

  it('shows album chips when the photos are grouped, and switches between them', () => {
    renderCard({
      ...baseEvent,
      gallery_images: ['https://example.com/2025-a.jpg', 'https://example.com/2025-b.jpg', 'https://example.com/2024-a.jpg'],
      gallery_albums: [
        { title: '2025', images: ['https://example.com/2025-a.jpg', 'https://example.com/2025-b.jpg'] },
        { title: '2024', images: ['https://example.com/2024-a.jpg'] },
      ],
    });
    expect(screen.getByText('(3)')).toBeInTheDocument(); // total across albums
    const chips = screen.getByRole('group', { name: 'Photo albums' });
    const chip2025 = within(chips).getByRole('button', { name: /^2025/ });
    const chip2024 = within(chips).getByRole('button', { name: /^2024/ });
    expect(chip2025).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /^Open photo/ })).toHaveLength(2);
    expect(screen.getAllByRole('img')[1]).toHaveAttribute('alt', expect.stringContaining('2025'));

    fireEvent.click(chip2024);
    expect(chip2024).toHaveAttribute('aria-pressed', 'true');
    expect(chip2025).toHaveAttribute('aria-pressed', 'false');
    const open = screen.getAllByRole('button', { name: /^Open photo/ });
    expect(open).toHaveLength(1);
    expect(open[0].querySelector('img')).toHaveAttribute('src', 'https://example.com/2024-a.jpg');
  });

  it('shows a single titled album\'s name as a chip, and prefers albums over the flat list', () => {
    renderCard({
      ...baseEvent,
      gallery_images: ['https://example.com/stale.jpg'],
      gallery_albums: [{ title: '2025', images: ['https://example.com/a.jpg'] }],
    });
    const chips = screen.getByRole('group', { name: 'Photo albums' });
    const chip = within(chips).getByRole('button', { name: /^2025/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    const open = screen.getAllByRole('button', { name: /^Open photo/ });
    expect(open).toHaveLength(1);
    expect(open[0].querySelector('img')).toHaveAttribute('src', 'https://example.com/a.jpg');
    expect(open[0].querySelector('img')).toHaveAttribute('alt', expect.stringContaining('2025'));
  });

  it('shows no chips for a single untitled album', () => {
    renderCard({
      ...baseEvent,
      gallery_albums: [{ title: '', images: ['https://example.com/a.jpg'] }],
    });
    expect(screen.queryByRole('group', { name: 'Photo albums' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Open photo/ })).toHaveLength(1);
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

describe('EventDetailModal — ticket prices', () => {
  it('shows the entry fee and the extra ticket prices', () => {
    renderModal({
      ...baseEvent, entry_fee_aud: 15,
      ticket_prices: [{ type: 'vip', price_aud: 60 }, { type: 'group', group_size: 4, price_aud: 50 }],
    });
    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.getByText('$15.00 AUD')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(screen.getByText('Group of 4')).toBeInTheDocument();
  });

  it('shows Free entry and no price list on a free event', () => {
    renderModal({ ...baseEvent, is_free: true, ticket_prices: [{ type: 'vip', price_aud: 60 }] });
    expect(screen.getByText('Free entry')).toBeInTheDocument();
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
  });
});
