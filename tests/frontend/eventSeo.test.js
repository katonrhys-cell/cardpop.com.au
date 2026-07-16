import { describe, it, expect } from 'vitest';
import {
  youTubeVideoId,
  youTubeEmbedUrl,
  youTubeThumbnailUrl,
  buildVideoJsonLd,
} from '@/lib/eventSeo.js';

describe('youTubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('extracts the id from %s', (url, id) => {
    expect(youTubeVideoId(url)).toBe(id);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['https://vimeo.com/12345678'],
    ['https://example.com/watch?v=dQw4w9WgXcQ'],
    ['not a url'],
    ['dQw4w9WgXcQ'], // bare ids are not accepted — admins paste full URLs
  ])('returns null for %s', (url) => {
    expect(youTubeVideoId(url)).toBeNull();
  });
});

describe('youTubeEmbedUrl / youTubeThumbnailUrl', () => {
  it('builds privacy-enhanced embed and thumbnail URLs', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(youTubeEmbedUrl(url)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(youTubeThumbnailUrl(url)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('returns null when the URL is not YouTube', () => {
    expect(youTubeEmbedUrl('https://vimeo.com/1')).toBeNull();
    expect(youTubeThumbnailUrl(null)).toBeNull();
  });
});

describe('buildVideoJsonLd', () => {
  const event = {
    title: 'Brisbane Card Show',
    short_description: 'Two days of trading cards.',
    youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
    updated_at: '2026-07-16T00:00:00+00:00',
  };

  it('builds a schema.org VideoObject from the event', () => {
    const ld = buildVideoJsonLd(event);
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'Brisbane Card Show — Event Video',
      description: 'Two days of trading cards.',
      thumbnailUrl: ['https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'],
      uploadDate: '2026-07-16T00:00:00+00:00',
      contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    });
  });

  it('returns null when the event has no usable youtube_url', () => {
    expect(buildVideoJsonLd({ ...event, youtube_url: null })).toBeNull();
    expect(buildVideoJsonLd({ ...event, youtube_url: 'https://vimeo.com/1' })).toBeNull();
    expect(buildVideoJsonLd(null)).toBeNull();
  });
});
