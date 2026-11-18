import { describe, it, expect } from 'vitest';
import {
  eventWatchSource, organiserWatchSource, articleWatchSource, storeWatchSource,
  buildWatchPage, watchLinks, watchVideoPath, watchPathFor, mediaVideoKey,
} from '@/utils/videoWatch.js';
import { cleanEventVideos, eventVideosForSave } from '@/utils/eventVideos.js';

const event = {
  id: 'e1', slug: 'brisbane-card-show', title: 'Brisbane Card Show',
  short_description: 'Two days of trading cards.',
  image_url: 'https://cdn.test/flyer.jpg',
  created_at: '2026-07-01T00:00:00+00:00', updated_at: '2026-09-09T00:00:00+00:00',
  youtube_url: 'https://youtu.be/zzzzzzzzzzz',
  event_videos: [
    { title: '2025 recap', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', added_at: '2026-11-11T03:00:00.000Z' },
    { title: '', url: 'https://youtu.be/abcdefghijk' },
    { title: 'bad', url: 'https://vimeo.com/1' },
  ],
};

describe('event watch pages', () => {
  const source = eventWatchSource(event, { facts: ['1 October 2026', 'Town Hall, Fitzroy, VIC'] });

  it('gives every event video a path under the event', () => {
    expect(watchLinks(source).map((l) => l.path)).toEqual([
      '/events/brisbane-card-show/videos/dQw4w9WgXcQ',
      '/events/brisbane-card-show/videos/abcdefghijk',
    ]);
    expect(watchLinks(source).map((l) => l.label)).toEqual(['2025 recap', 'Video 2']);
    expect(watchPathFor(source, 'dQw4w9WgXcQ')).toBe('/events/brisbane-card-show/videos/dQw4w9WgXcQ');
    expect(watchPathFor(source, 'zzzzzzzzzzz')).toBeNull();
  });

  it('builds the watch page: title, canonical and a valid VideoObject', () => {
    const page = buildWatchPage(source, 'dQw4w9WgXcQ');
    expect(page.canonical).toBe('https://cardpop.com.au/events/brisbane-card-show/videos/dQw4w9WgXcQ');
    expect(page.title).toBe('Brisbane Card Show — 2025 recap | Watch on CardPop');
    expect(page.description).toContain('Watch “2025 recap” from Brisbane Card Show — 1 October 2026 · Town Hall, Fitzroy, VIC.');
    expect(page.videoObject).toMatchObject({
      '@type': 'VideoObject',
      name: 'Brisbane Card Show — 2025 recap',
      thumbnailUrl: ['https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'],
      uploadDate: '2026-11-11T03:00:00.000Z',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      url: page.canonical,
    });
    // A YouTube watch page is not a media file — never a contentUrl.
    expect(page.videoObject).not.toHaveProperty('contentUrl');
    expect(page.jsonLd.map((n) => n['@type'])).toEqual(['VideoObject', 'BreadcrumbList']);
    expect(page.others.map((o) => o.key)).toEqual(['abcdefghijk']);
  });

  it('falls back to the day the listing was created for a video with no added_at', () => {
    const page = buildWatchPage(source, 'abcdefghijk');
    expect(page.name).toBe('Brisbane Card Show — Event Video 2');
    expect(page.videoObject.uploadDate).toBe('2026-07-01T00:00:00+00:00');
  });

  it('returns null for a video the page does not have', () => {
    expect(buildWatchPage(source, 'nope')).toBeNull();
    expect(buildWatchPage(null, 'dQw4w9WgXcQ')).toBeNull();
  });

  it('counts a bare youtube_url as one video', () => {
    const legacy = eventWatchSource({ ...event, event_videos: [] });
    expect(watchLinks(legacy).map((l) => l.key)).toEqual(['zzzzzzzzzzz']);
    expect(buildWatchPage(legacy, 'zzzzzzzzzzz').name).toBe('Brisbane Card Show — Event Video');
  });
});

describe('other pages that carry videos', () => {
  it('organiser pages', () => {
    const source = organiserWatchSource({
      name: 'Hobby Hangout', slug: 'hobby-hangout', updated_at: '2026-11-01T00:00:00+00:00',
      videos: [{ title: 'Highlights', url: 'https://youtu.be/dQw4w9WgXcQ' }],
    });
    expect(watchLinks(source)[0].path).toBe('/events/organisers/hobby-hangout/videos/dQw4w9WgXcQ');
    expect(buildWatchPage(source, 'dQw4w9WgXcQ').videoObject.uploadDate).toBe('2026-11-01T00:00:00+00:00');
    expect(organiserWatchSource({ name: 'No slug' })).toBeNull();
  });

  it('articles: the featured video plus an event review’s videos, uploads included', () => {
    const upload = { url: 'https://x.supabase.co/storage/v1/object/public/media/reviews/clip.mp4', poster_url: 'https://x.supabase.co/storage/v1/object/public/media/reviews/clip.jpg', caption: 'Walking the floor' };
    const source = articleWatchSource(
      { slug: 'vault-review', title: 'Vault Review', excerpt: 'We went.', featured_image_url: 'https://cdn.test/cover.jpg', featured_video_url: 'https://youtu.be/dQw4w9WgXcQ', published_at: '2026-10-05T00:00:00Z' },
      { videos: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, upload, { url: 'https://vimeo.com/123456789' }] },
    );
    // The featured video that is also in the review appears once.
    expect(source.videos.map((v) => v.provider)).toEqual(['youtube', 'file', 'vimeo']);
    const clipKey = mediaVideoKey(upload.url);
    expect(clipKey).toMatch(/^clip-[a-z0-9]+$/);
    const clip = buildWatchPage(source, clipKey);
    expect(clip.path).toBe(`/blog/vault-review/videos/${clipKey}`);
    expect(clip.videoObject).toMatchObject({ contentUrl: upload.url, thumbnailUrl: [upload.poster_url], uploadDate: '2026-10-05T00:00:00Z' });
    expect(clip.videoObject).not.toHaveProperty('embedUrl');
    // Vimeo has no derivable thumbnail: the article's cover stands in.
    expect(buildWatchPage(source, 'vimeo-123456789').videoObject.thumbnailUrl).toEqual(['https://cdn.test/cover.jpg']);
  });

  it('emits no VideoObject without a thumbnail, rather than an invalid one', () => {
    const source = articleWatchSource({ slug: 'a', title: 'A', published_at: '2026-10-05T00:00:00Z' }, { videos: [{ url: 'https://vimeo.com/123456789' }] });
    const page = buildWatchPage(source, 'vimeo-123456789');
    expect(page.videoObject).toBeNull();
    expect(page.jsonLd.map((n) => n['@type'])).toEqual(['BreadcrumbList']);
  });

  it('card shop pages', () => {
    const source = storeWatchSource({
      name: 'Good Games', slug: 'good-games', city: 'melbourne', updated_at: '2026-11-02T00:00:00+00:00',
      photos: [{ url: '/images/stores/gg.jpg' }],
      videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Shop tour' }],
    }, { cityLabel: 'Melbourne' });
    const page = buildWatchPage(source, 'dQw4w9WgXcQ');
    expect(page.path).toBe('/card-shops/melbourne/good-games/videos/dQw4w9WgXcQ');
    expect(page.name).toBe('Good Games — Shop tour');
    expect(source.fallbackImage).toBe('https://cardpop.com.au/images/stores/gg.jpg');
  });

  it('watchVideoPath encodes the key', () => {
    expect(watchVideoPath('/events/x', 'a b')).toBe('/events/x/videos/a%20b');
  });
});

describe('added_at on event videos', () => {
  const NOW = '2026-11-17T01:02:03.000Z';

  it('stamps a new video and keeps what a saved one had', () => {
    const saved = [
      { title: 'Old', url: 'https://youtu.be/dQw4w9WgXcQ', added_at: '2026-11-11T03:00:00.000Z' },
      { title: 'Older', url: 'https://youtu.be/abcdefghijk' },
    ];
    const next = eventVideosForSave([
      { title: 'Old, renamed', url: 'https://youtu.be/dQw4w9WgXcQ' },
      { title: 'Older', url: 'https://youtu.be/abcdefghijk' },
      { title: 'New', url: 'https://youtu.be/ZZZZZZZZZZZ' },
    ], saved, NOW);
    expect(next).toEqual([
      { title: 'Old, renamed', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', added_at: '2026-11-11T03:00:00.000Z' },
      // Saved before the stamp existed: left alone, so an untouched list re-saves unchanged.
      { title: 'Older', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
      { title: 'New', url: 'https://www.youtube.com/watch?v=ZZZZZZZZZZZ', added_at: NOW },
    ]);
  });

  it('cleanEventVideos passes a real added_at through and drops junk', () => {
    expect(cleanEventVideos([{ url: 'https://youtu.be/dQw4w9WgXcQ', added_at: '2026-11-11T03:00:00.000Z' }])[0].added_at).toBe('2026-11-11T03:00:00.000Z');
    expect(cleanEventVideos([{ url: 'https://youtu.be/dQw4w9WgXcQ', added_at: 'yesterday' }])[0]).not.toHaveProperty('added_at');
  });
});
