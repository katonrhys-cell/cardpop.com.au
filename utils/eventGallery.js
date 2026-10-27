// Event photo gallery, grouped into albums (events.gallery_albums). An event
// that runs every year keeps each year's photos together — "2025", "2024" —
// or an organiser can split one show into "Day 1" / "Day 2" / "Vendors".
// Dependency-free so the event form, the event page, lib/eventSeo.js and
// api/prerender.js all read the same shape.
//
// Stored shape: [{ title, images: [url, …] }] — album order and image order
// are display order. `events.gallery_images` holds the same photos flattened
// (the form writes both); a row with photos but no albums (saved before
// albums existed) renders as one untitled album.

export const MAX_EVENT_GALLERY_ALBUMS = 12;
export const MAX_EVENT_GALLERY_PHOTOS = 24; // per album
export const MAX_ALBUM_TITLE_CHARS = 40;

const trimOrEmpty = (v) => (typeof v === 'string' ? v.trim() : '');

// http(s) or site-relative only — a stored "javascript:" URL must never
// reach an <img src>.
export const safeImageUrl = (v) => {
  const s = trimOrEmpty(v);
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

const cleanImages = (images) => (Array.isArray(images) ? images : [])
  .map(safeImageUrl)
  .filter(Boolean)
  .slice(0, MAX_EVENT_GALLERY_PHOTOS);

/**
 * Normalise whatever the DB (or the form) holds into display albums: unsafe
 * URLs and empty albums are dropped, titles trimmed and capped. When there
 * are no albums, `legacyImages` (events.gallery_images) becomes one untitled
 * album so galleries saved before albums existed still show.
 */
export const cleanGalleryAlbums = (albums, legacyImages) => {
  const cleaned = (Array.isArray(albums) ? albums : [])
    .map((a) => ({
      title: trimOrEmpty(a?.title).slice(0, MAX_ALBUM_TITLE_CHARS),
      images: cleanImages(a?.images),
    }))
    .filter((a) => a.images.length > 0)
    .slice(0, MAX_EVENT_GALLERY_ALBUMS);
  if (cleaned.length > 0) return cleaned;
  const legacy = cleanImages(legacyImages);
  return legacy.length > 0 ? [{ title: '', images: legacy }] : [];
};

/** Every album's photos in display order — what events.gallery_images stores. */
export const flattenGalleryAlbums = (albums) => albums.flatMap((a) => a.images);

/** What an album chip says: its title, or its position when it has none. */
export const albumLabel = (album, index) => album.title || `Album ${index + 1}`;
