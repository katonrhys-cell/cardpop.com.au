// Event videos (events.event_videos). An event page can embed several
// YouTube videos — the organiser's recap, a vendor walkthrough, last year's
// highlights — shown below the photo gallery. Dependency-free so the event
// form, the event page, lib/eventSeo.js and api/prerender.js all read the
// same shape.
//
// Stored shape: [{ title, url, added_at?, creator? }] in display order (`added_at` is
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

// ── Creator credit ───────────────────────────────────────────────────────────
// A video can credit whoever made it — the YouTuber or influencer who filmed
// the show — with their picture, name and social handles shown under the
// player: `creator: { name, avatar_url, instagram, youtube, tiktok, facebook,
// x }`. Each social is stored as a canonical profile URL on that platform's
// own host; the form accepts a handle ("@name") or a pasted profile link.

export const MAX_CREATOR_NAME_CHARS = 60;

const HANDLE = '[A-Za-z0-9._-]{1,60}';

// key, label, the hosts a pasted link may be on, how a handle becomes a URL,
// and how a URL path becomes the handle shown on the page.
export const CREATOR_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'], at: false, placeholder: '@handle or instagram.com/handle' },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com'], at: true, placeholder: '@channel or youtube.com/@channel' },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], at: true, placeholder: '@handle or tiktok.com/@handle' },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com'], at: false, placeholder: 'Page name or facebook.com/page' },
  { key: 'x', label: 'X', hosts: ['x.com', 'twitter.com'], at: false, placeholder: '@handle or x.com/handle' },
];

const CANONICAL_HOST = {
  instagram: 'www.instagram.com', youtube: 'www.youtube.com', tiktok: 'www.tiktok.com', facebook: 'www.facebook.com', x: 'x.com',
};

/**
 * One social field → its canonical profile URL, or '' when it is neither a
 * handle nor a link on that platform's own host (a stored value becomes an
 * href, so nothing else is ever kept).
 */
export const creatorProfileUrl = (platformKey, value) => {
  const platform = CREATOR_PLATFORMS.find((p) => p.key === platformKey);
  const raw = trimOrEmpty(value);
  if (!platform || !raw) return '';

  // A bare handle, with or without the @.
  const bare = raw.match(new RegExp(`^@?(${HANDLE})$`));
  if (bare && !raw.includes('/')) {
    return `https://${CANONICAL_HOST[platform.key]}/${platform.at ? '@' : ''}${bare[1]}`;
  }

  // A pasted link (the scheme is optional — people paste "instagram.com/x").
  let parsed;
  try { parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return ''; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  const host = parsed.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  if (!platform.hosts.includes(host)) return '';
  const path = parsed.pathname.replace(/\/+$/, '');
  if (!path || !/^\/[A-Za-z0-9@._\-/]{1,120}$/.test(path)) return '';
  return `https://${CANONICAL_HOST[platform.key]}${path}`;
};

/** What a stored profile URL is shown as: "@handle" (or the page name). */
export const creatorHandleLabel = (url) => {
  const s = trimOrEmpty(url);
  if (!s) return '';
  let path;
  try { path = new URL(s).pathname; } catch { return ''; }
  // youtube.com/channel/UC… and /c/name have no handle to show.
  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 1) return '';
  const handle = segments[0].replace(/^@/, '');
  return handle ? `@${handle}` : '';
};

// The creator's picture: an uploaded image's public URL — http(s) only.
const cleanAvatarUrl = (value) => {
  const s = trimOrEmpty(value);
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
};

/**
 * Normalise a video's creator credit. Returns null when there is nothing to
 * show (no name, picture or valid social), else only the fields that are set.
 */
export const cleanVideoCreator = (creator) => {
  if (!creator || typeof creator !== 'object') return null;
  const out = {};
  const name = trimOrEmpty(creator.name).slice(0, MAX_CREATOR_NAME_CHARS);
  if (name) out.name = name;
  const avatar = cleanAvatarUrl(creator.avatar_url);
  if (avatar) out.avatar_url = avatar;
  for (const { key } of CREATOR_PLATFORMS) {
    const url = creatorProfileUrl(key, creator[key]);
    if (url) out[key] = url;
  }
  return Object.keys(out).length ? out : null;
};

/** The creator's socials that are set, in display order: [{ key, label, url, handle }]. */
export const creatorLinks = (creator) => CREATOR_PLATFORMS
  .filter(({ key }) => creator?.[key])
  .map(({ key, label }) => ({ key, label, url: creator[key], handle: creatorHandleLabel(creator[key]) }));

/** A cleaned video list as the editor holds it: [{ title, url, creator? }]. */
export const videosToForm = (cleaned) => cleaned.map((v) => ({
  title: v.title, url: v.url, ...(v.creator ? { creator: v.creator } : {}),
}));

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
 * Returns [{ title, url, id, added_at?, creator? }] — `url` is the canonical
 * watch URL, `creator` the cleaned credit (cleanVideoCreator) when one is set.
 */
export const cleanEventVideos = (videos, legacyUrl) => {
  const seen = new Set();
  const cleaned = [];
  for (const v of Array.isArray(videos) ? videos : []) {
    const id = youTubeVideoId(v?.url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const addedAt = cleanAddedAt(v?.added_at);
    const creator = cleanVideoCreator(v?.creator);
    cleaned.push({
      title: trimOrEmpty(v?.title).slice(0, MAX_VIDEO_TITLE_CHARS),
      url: youTubeWatchUrl(id),
      id,
      ...(addedAt ? { added_at: addedAt } : {}),
      ...(creator ? { creator } : {}),
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
 * The list a form writes to the DB: [{ title, url, added_at?, creator? }]. A video
 * that was already saved keeps whatever `added_at` it had (none, for one
 * saved before the stamp existed — re-saving an untouched list must not
 * rewrite it); a video new to the list is stamped `now`.
 */
export const eventVideosForSave = (formVideos, savedVideos = [], now = new Date().toISOString()) => {
  const saved = new Map(cleanEventVideos(savedVideos).map((v) => [v.id, v]));
  return cleanEventVideos(formVideos).map((v) => {
    const addedAt = saved.has(v.id) ? saved.get(v.id).added_at : (v.added_at || now);
    return {
      title: v.title,
      url: v.url,
      ...(addedAt ? { added_at: addedAt } : {}),
      ...(v.creator ? { creator: v.creator } : {}),
    };
  });
};
