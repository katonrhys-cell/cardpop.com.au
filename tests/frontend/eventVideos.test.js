import { describe, it, expect } from 'vitest';
import {
  cleanEventVideos,
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
