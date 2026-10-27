import { describe, it, expect } from 'vitest';
import {
  cleanGalleryAlbums, flattenGalleryAlbums, albumLabel, safeImageUrl,
  MAX_EVENT_GALLERY_ALBUMS, MAX_EVENT_GALLERY_PHOTOS, MAX_ALBUM_TITLE_CHARS,
} from '@/utils/eventGallery.js';

describe('cleanGalleryAlbums', () => {
  it('keeps album and photo order, trims titles and drops empty albums', () => {
    const albums = cleanGalleryAlbums([
      { title: '  2025 ', images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'] },
      { title: 'Empty', images: [] },
      { title: '2024', images: ['/images/local.jpg'] },
    ]);
    expect(albums).toEqual([
      { title: '2025', images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'] },
      { title: '2024', images: ['/images/local.jpg'] },
    ]);
  });

  it('drops unsafe URLs and an album left with none', () => {
    expect(cleanGalleryAlbums([{ title: 'x', images: ['javascript:alert(1)', 'data:text/html,hi', '//evil.test/a.jpg'] }])).toEqual([]);
    expect(safeImageUrl(' https://cdn.test/a.jpg ')).toBe('https://cdn.test/a.jpg');
    expect(safeImageUrl('ftp://cdn.test/a.jpg')).toBeNull();
  });

  it('falls back to the flat gallery_images list as one untitled album', () => {
    expect(cleanGalleryAlbums([], ['https://cdn.test/a.jpg', 'javascript:x'])).toEqual([
      { title: '', images: ['https://cdn.test/a.jpg'] },
    ]);
    expect(cleanGalleryAlbums(undefined, undefined)).toEqual([]);
    expect(cleanGalleryAlbums('nope', null)).toEqual([]);
  });

  it('prefers albums over the legacy list when both exist', () => {
    const albums = cleanGalleryAlbums([{ title: '2025', images: ['https://cdn.test/new.jpg'] }], ['https://cdn.test/old.jpg']);
    expect(albums).toEqual([{ title: '2025', images: ['https://cdn.test/new.jpg'] }]);
  });

  it('caps albums, photos per album and title length', () => {
    const many = Array.from({ length: MAX_EVENT_GALLERY_ALBUMS + 3 }, (_, i) => ({
      title: 'T'.repeat(MAX_ALBUM_TITLE_CHARS + 10),
      images: Array.from({ length: MAX_EVENT_GALLERY_PHOTOS + 5 }, (_, j) => `https://cdn.test/${i}-${j}.jpg`),
    }));
    const albums = cleanGalleryAlbums(many);
    expect(albums).toHaveLength(MAX_EVENT_GALLERY_ALBUMS);
    expect(albums[0].images).toHaveLength(MAX_EVENT_GALLERY_PHOTOS);
    expect(albums[0].title).toHaveLength(MAX_ALBUM_TITLE_CHARS);
  });
});

describe('flattenGalleryAlbums / albumLabel', () => {
  it('flattens every album in order — what gallery_images stores', () => {
    expect(flattenGalleryAlbums([{ title: 'a', images: ['1', '2'] }, { title: 'b', images: ['3'] }])).toEqual(['1', '2', '3']);
  });

  it('labels an untitled album by position', () => {
    expect(albumLabel({ title: '2025', images: [] }, 3)).toBe('2025');
    expect(albumLabel({ title: '', images: [] }, 1)).toBe('Album 2');
  });
});
