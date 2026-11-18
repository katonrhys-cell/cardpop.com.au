import { describe, it, expect } from 'vitest';
import {
  cleanEventVideos,
  cleanVideoCreator,
  creatorLinks,
  creatorProfileUrl,
  eventVideosForSave,
  videosToForm,
  youTubeVideoId,
  videoLabel,
  MAX_EVENT_VIDEOS,
  MAX_VIDEO_TITLE_CHARS,
} from '@/utils/eventVideos.js';

describe('cleanEventVideos', () => {
  it('keeps YouTube videos in order with canonical watch URLs and trimmed titles', () => {
    const out = cleanEventVideos([
      { title: '  2025 recap ', url: 'https://youtu.be/dQw4w9WgXcQ?t=42' },
      { title: 'Shorts', url: 'https://www.youtube.com/shorts/abcdefghijk' },
    ]);
    expect(out).toEqual([
      { title: '2025 recap', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' },
      { title: 'Shorts', url: 'https://www.youtube.com/watch?v=abcdefghijk', id: 'abcdefghijk' },
    ]);
  });

  it('drops non-YouTube links, blanks, duplicates and anything past the cap', () => {
    const many = Array.from({ length: MAX_EVENT_VIDEOS + 3 }, (_, i) => ({
      title: '', url: `https://youtu.be/${String(i).padStart(11, 'a')}`,
    }));
    expect(cleanEventVideos([
      { title: 'v', url: 'https://vimeo.com/123' },
      { title: '', url: '' },
      { title: 'x', url: 'javascript:alert(1)' },
      { title: 'first', url: 'https://youtu.be/dQw4w9WgXcQ' },
      { title: 'again', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    ])).toEqual([{ title: 'first', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' }]);
    expect(cleanEventVideos(many)).toHaveLength(MAX_EVENT_VIDEOS);
  });

  it('caps the title length', () => {
    const [v] = cleanEventVideos([{ title: 'x'.repeat(MAX_VIDEO_TITLE_CHARS + 20), url: 'https://youtu.be/dQw4w9WgXcQ' }]);
    expect(v.title).toHaveLength(MAX_VIDEO_TITLE_CHARS);
  });

  it('falls back to the legacy youtube_url only when the list has nothing usable', () => {
    expect(cleanEventVideos([], 'https://youtu.be/dQw4w9WgXcQ')).toEqual([
      { title: '', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' },
    ]);
    expect(cleanEventVideos(null, 'https://vimeo.com/1')).toEqual([]);
    expect(cleanEventVideos(undefined, null)).toEqual([]);
    expect(cleanEventVideos([{ title: '', url: 'https://youtu.be/abcdefghijk' }], 'https://youtu.be/dQw4w9WgXcQ'))
      .toEqual([{ title: '', url: 'https://www.youtube.com/watch?v=abcdefghijk', id: 'abcdefghijk' }]);
  });
});

describe('youTubeVideoId / videoLabel', () => {
  it('parses the common URL shapes and rejects the rest', () => {
    expect(youTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeVideoId('dQw4w9WgXcQ')).toBeNull();
    expect(youTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youTubeVideoId(undefined)).toBeNull();
  });

  it('labels a video by title or position', () => {
    expect(videoLabel({ title: 'Recap' }, 0)).toBe('Recap');
    expect(videoLabel({ title: '' }, 2)).toBe('Video 3');
  });
});

describe('video creator credit', () => {
  const URL = 'https://youtu.be/dQw4w9WgXcQ';

  it('turns handles and pasted links into canonical profile URLs', () => {
    expect(creatorProfileUrl('instagram', '@thenew50noob')).toBe('https://www.instagram.com/thenew50noob');
    expect(creatorProfileUrl('instagram', 'instagram.com/thenew50noob/')).toBe('https://www.instagram.com/thenew50noob');
    expect(creatorProfileUrl('youtube', 'SimpleSimon')).toBe('https://www.youtube.com/@SimpleSimon');
    expect(creatorProfileUrl('youtube', 'https://www.youtube.com/channel/UC1234567890?si=x')).toBe('https://www.youtube.com/channel/UC1234567890');
    expect(creatorProfileUrl('tiktok', 'https://m.tiktok.com/@simon')).toBe('https://www.tiktok.com/@simon');
    expect(creatorProfileUrl('x', 'https://twitter.com/simon')).toBe('https://x.com/simon');
  });

  it('refuses a link on another host, a script URL and junk', () => {
    expect(creatorProfileUrl('instagram', 'https://evil.example/thenew50noob')).toBe('');
    expect(creatorProfileUrl('instagram', 'https://instagram.com.evil.example/x')).toBe('');
    expect(creatorProfileUrl('instagram', 'javascript:alert(1)')).toBe('');
    expect(creatorProfileUrl('facebook', 'two words')).toBe('');
    expect(creatorProfileUrl('myspace', '@simon')).toBe('');
  });

  it('keeps only the fields that are set and drops an empty credit', () => {
    expect(cleanVideoCreator({ name: '  Simple Simon ', instagram: '@thenew50noob', tiktok: 'https://evil.example/x', avatar_url: 'javascript:1' }))
      .toEqual({ name: 'Simple Simon', instagram: 'https://www.instagram.com/thenew50noob' });
    expect(cleanVideoCreator({ name: ' ', instagram: '' })).toBeNull();
    expect(cleanVideoCreator('Simon')).toBeNull();
  });

  it('rides through cleanEventVideos, the form shape and the save shape', () => {
    const creator = { name: 'Simple Simon', avatar_url: 'https://x.supabase.co/storage/v1/object/public/events/logos/creator-1.webp', youtube: '@SimpleSimon' };
    const [cleaned] = cleanEventVideos([{ title: 'Recap', url: URL, creator }]);
    expect(cleaned.creator).toEqual({ ...creator, youtube: 'https://www.youtube.com/@SimpleSimon' });
    expect(videosToForm([cleaned])).toEqual([{ title: 'Recap', url: cleaned.url, creator: cleaned.creator }]);
    expect(eventVideosForSave([{ title: 'Recap', url: URL, creator }], [], '2026-11-18T00:00:00.000Z'))
      .toEqual([{ title: 'Recap', url: cleaned.url, added_at: '2026-11-18T00:00:00.000Z', creator: cleaned.creator }]);
    // No credit → no key, so lists saved before the credit existed re-save unchanged.
    expect(cleanEventVideos([{ title: '', url: URL }])[0]).not.toHaveProperty('creator');
  });

  it('lists the socials in display order with the handle to show', () => {
    expect(creatorLinks({ x: 'https://x.com/simon', youtube: 'https://www.youtube.com/channel/UC123', instagram: 'https://www.instagram.com/thenew50noob' }))
      .toEqual([
        { key: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/thenew50noob', handle: '@thenew50noob' },
        { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/channel/UC123', handle: '' },
        { key: 'x', label: 'X', url: 'https://x.com/simon', handle: '@simon' },
      ]);
  });
});
