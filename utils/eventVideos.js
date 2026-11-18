// Event videos (events.event_videos). An event page can embed several
// YouTube videos — the organiser's recap, a vendor walkthrough, last year's
// highlights — shown below the photo gallery. Dependency-free so the event
// form, the event page, lib/eventSeo.js and api/prerender.js all read the
// same shape.
//
// Stored shape: [{ title, url, added_at? }] in display order (`added_at` is
// stamped by the form when a video is first added — see eventVideosForSave). Only YouTube links are
// accepted (the embed host is in the CSP frame-src; anything else would be
// blocked, and an arbitrary stored URL must never become an iframe src).
// `events.youtube_url` stays as the first video's URL — the form writes both
// — so readers that predate the list keep working; a row with a youtube_url
// but no list (saved before this existed) renders as one untitled video.

export const MAX_EVENT_VIDEOS = 12;
export const MAX_VIDEO_TITLE_CHARS = 80;

// Milliseconds after the page loads before the first video starts (muted —
// browsers block programmatic autoplay with sound).
export const VIDEO_AUTOPLAY_DELAY_MS = 10_000;

const trimOrEmpty = (v) => (typeof v === 'string' ? v.trim() : '');

// The 11-character YouTube video id from any common URL shape: watch?v=,
// youtu.be/, shorts/, live/, embed/ (plain ids are not accepted — admins
// paste full URLs). Mirrors lib/eventSeo.js / api/prerender.js.
export const youTubeVideoId = (url) => {
  const s = trimOrEmpty(url);
  if (!s) return null;
  const match = s.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
};

export const youTubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const youTubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}`;
export const youTubeThumbnailUrl = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const emptyVideo = () => ({ title: '', url: '' });

// When the video was added to the page (an ISO timestamp stamped on save) —
// the upload date its watch page reports (utils/videoWatch.js). Anything that
// isn't a real date is dropped; videos saved before the stamp existed have none.
const cleanAddedAt = (value) => {
  const s = trimOrEmpty(value);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s)) ? s : '';
};

/**
 * Normalise whatever the DB (or the form) holds into display videos:
 * entries without a parseable YouTube id are dropped, the same video twice
 * keeps its first slot, titles trimmed and capped. When the list is empty,
 * `legacyUrl` (events.youtube_url) becomes one untitled video so events
 * saved before the list existed still show theirs.
 *
 * Returns [{ title, url, id, added_at? }] — `url` is the canonical watch URL.
 */
export const cleanEventVideos = (videos, legacyUrl) => {
  const seen = new Set();
  const cleaned = [];
  for (const v of Array.isArray(videos) ? videos : []) {
    const id = youTubeVideoId(v?.url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const addedAt = cleanAddedAt(v?.added_at);
    cleaned.push({
      title: trimOrEmpty(v?.title).slice(0, MAX_VIDEO_TITLE_CHARS),
      url: youTubeWatchUrl(id),
      id,
      ...(addedAt ? { added_at: addedAt } : {}),
    });
    if (cleaned.length >= MAX_EVENT_VIDEOS) break;
  }
  if (cleaned.length > 0) return cleaned;
  const legacyId = youTubeVideoId(legacyUrl);
  return legacyId ? [{ title: '', url: youTubeWatchUrl(legacyId), id: legacyId }] : [];
};

/** What a video is called on the page: its title, or its position when it has none. */
export const videoLabel = (video, index) => video.title || `Video ${index + 1}`;

/**
 * The list a form writes to the DB: [{ title, url, added_at? }]. A video
 * that was already saved keeps whatever `added_at` it had (none, for one
 * saved before the stamp existed — re-saving an untouched list must not
 * rewrite it); a video new to the list is stamped `now`.
 */
export const eventVideosForSave = (formVideos, savedVideos = [], now = new Date().toISOString()) => {
  const saved = new Map(cleanEventVideos(savedVideos).map((v) => [v.id, v]));
  return cleanEventVideos(formVideos).map((v) => {
    const addedAt = saved.has(v.id) ? saved.get(v.id).added_at : (v.added_at || now);
    return { title: v.title, url: v.url, ...(addedAt ? { added_at: addedAt } : {}) };
  });
};
