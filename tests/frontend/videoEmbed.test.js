import { describe, it, expect } from 'vitest';
import { parseVideoUrl, isSupportedVideoUrl } from '@/utils/videoEmbed.js';

describe('parseVideoUrl — YouTube', () => {
  const cases = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ];

  it.each(cases)('parses %s', (url, id) => {
    const info = parseVideoUrl(url);
    expect(info).not.toBeNull();
    expect(info.provider).toBe('youtube');
    expect(info.id).toBe(id);
    expect(info.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`);
    expect(info.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  });
});

describe('parseVideoUrl — Vimeo', () => {
  it('parses a canonical vimeo URL', () => {
    const info = parseVideoUrl('https://vimeo.com/123456789');
    expect(info).toMatchObject({
      provider: 'vimeo',
      id: '123456789',
      embedUrl: 'https://player.vimeo.com/video/123456789',
      thumbnailUrl: null,
    });
  });

  it('parses a channel-scoped vimeo URL', () => {
    const info = parseVideoUrl('https://vimeo.com/channels/staffpicks/123456789');
    expect(info.id).toBe('123456789');
  });

  it('parses a player.vimeo.com URL', () => {
    const info = parseVideoUrl('https://player.vimeo.com/video/123456789');
    expect(info.id).toBe('123456789');
  });

  it('carries the unlisted hash into the embed URL', () => {
    const info = parseVideoUrl('https://vimeo.com/123456789/abcdef123');
    expect(info.embedUrl).toBe('https://player.vimeo.com/video/123456789?h=abcdef123');
  });
});

describe('parseVideoUrl — rejects', () => {
  it.each([
    null,
    undefined,
    '',
    '   ',
    'not a url',
    'https://example.com/video.mp4',
    'https://dailymotion.com/video/x123',
    'https://youtube.com/watch?v=tooShort',
  ])('returns null for %s', (url) => {
    expect(parseVideoUrl(url)).toBeNull();
    expect(isSupportedVideoUrl(url)).toBe(false);
  });
});
