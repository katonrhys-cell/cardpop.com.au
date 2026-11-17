// Video watch pages — one page per video, where the video is the main content.
//
// Google only indexes a video (and only shows it as a video result) when it
// sits on a "watch page": a page whose main purpose is that one video. An
// event page, an organiser page, an article or a card shop page with a video
// further down is not one — Search Console lists those under "Video isn't on
// a watch page". So every video a page carries also gets a page of its own at
//
//   <parent path>/videos/<key>
//
// and THAT page is the only place a schema.org VideoObject is emitted
// (tests/backend/videoObjectOnlyOnWatchPages.test.js). The parent page keeps
// its player for visitors and links to the watch page.
//
// Dependency-free: pages/videos/VideoWatchPage.jsx, api/prerender.js and
// api/sitemap.js all build the same paths, titles and markup from here. To put
// videos on a new kind of page, add a `…WatchSource()` below and wire it into
// the three readers — see docs/video-watch-pages.md.

import { cleanEventVideos, youTubeThumbnailUrl } from './eventVideos.js';
import { cleanVideos, videoKind } from './eventReview.js';
import { parseVideoUrl } from './videoEmbed.js';
import { organiserPath } from './eventOrganisers.js';
import { cleanStoreVideos, storePath } from './storePage.js';

export const SITE_URL = 'https://cardpop.com.au';
export const WATCH_SEGMENT = 'videos';

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** HTML or plain text → one line of plain text, capped with an ellipsis. */
export const plainText = (value, max = 300) => {
  const text = String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

const absolute = (url, siteUrl = SITE_URL) => {
  const s = str(url);
  if (/^https?:\/\//i.test(s)) return s;
  return s.startsWith('/') && !s.startsWith('//') ? `${siteUrl}${s}` : null;
};

// A short stable key for a video with no id of its own (an uploaded clip):
// FNV-1a of its URL. Stable across reorders and caption edits, unlike a
// position.
const hashKey = (value) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

// A YouTube video from an events.event_videos / event_organisers.videos entry
// ({ title, url, id, added_at? } out of cleanEventVideos).
const fromYouTube = (v) => ({
  key: v.id,
  title: v.title || '',
  provider: 'youtube',
  // The same privacy-friendly host the site embeds everywhere (CSP frame-src).
  embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`,
  contentUrl: null,
  thumbnailUrl: youTubeThumbnailUrl(v.id),
  addedAt: v.added_at || null,
});

// A review / article / store video ({ url, poster_url, caption } out of
// cleanVideos): an uploaded clip, or a YouTube / Vimeo link.
const fromMediaVideo = (v, siteUrl) => {
  const embed = videoKind(v.url) === 'embed' ? parseVideoUrl(v.url) : null;
  if (embed) {
    return {
      key: embed.provider === 'youtube' ? embed.id : `vimeo-${embed.id}`,
      title: v.caption || '',
      provider: embed.provider,
      embedUrl: embed.embedUrl,
      contentUrl: null,
      thumbnailUrl: embed.thumbnailUrl || absolute(v.poster_url, siteUrl),
      addedAt: null,
    };
  }
  const contentUrl = absolute(v.url, siteUrl);
  if (!contentUrl) return null;
  return {
    key: `clip-${hashKey(v.url)}`,
    title: v.caption || '',
    provider: 'file',
    embedUrl: null,
    contentUrl,
    thumbnailUrl: absolute(v.poster_url, siteUrl),
    addedAt: null,
  };
};

// The same video twice on one page (an article's featured video that is also
// in its review) keeps its first slot.
const uniqueByKey = (videos) => {
  const seen = new Set();
  return videos.filter((v) => v && !seen.has(v.key) && seen.add(v.key));
};

/** The watch key of a review / article / store video URL, or null if it can't play. */
export const mediaVideoKey = (url) => fromMediaVideo({ url }, SITE_URL)?.key || null;

/** `<parent path>/videos/<key>` — the watch page's site-relative path. */
export const watchVideoPath = (parentPath, key) => `${parentPath}/${WATCH_SEGMENT}/${encodeURIComponent(key)}`;

// ── Sources ──────────────────────────────────────────────────────────────────
// One per kind of page that carries videos. Each returns
//   { kind, parentPath, parentName, sectionName, sectionPath, noun, summary,
//     facts, fallbackImage, fallbackDate, videos }
// or null when the row can't have a watch page. `facts` are short display
// lines about the parent (date, place) supplied by the caller, which owns the
// formatting.

export const eventWatchSource = (event, { facts = [], siteUrl = SITE_URL } = {}) => {
  if (!event || !(event.slug || event.id)) return null;
  const name = str(event.title) || 'Trading Card Event';
  return {
    kind: 'event',
    parentPath: `/events/${event.slug || event.id}`,
    parentName: name,
    parentNoun: 'event',
    sectionName: 'Events',
    sectionPath: '/events',
    noun: 'Event Video',
    summary: plainText(event.short_description || event.description || '', 500),
    facts: facts.filter(Boolean),
    fallbackImage: absolute(event.image_url, siteUrl),
    // A video saved before `added_at` existed: the day the listing was made is
    // the one stable date we hold (updated_at moves with every edit).
    fallbackDate: event.created_at || event.updated_at || event.start_date || null,
    videos: cleanEventVideos(event.event_videos, event.youtube_url).map(fromYouTube),
  };
};

export const organiserWatchSource = (org, { facts = [] } = {}) => {
  const path = org ? organiserPath(org) : null;
  if (!path) return null;
  return {
    kind: 'organiser',
    parentPath: path,
    parentName: str(org.name) || 'Event organiser',
    parentNoun: 'organiser',
    sectionName: 'Events',
    sectionPath: '/events',
    noun: 'Video',
    summary: plainText(org.description || '', 500),
    facts: facts.filter(Boolean),
    fallbackImage: null,
    fallbackDate: org.updated_at || org.created_at || null,
    videos: cleanEventVideos(org.videos).map(fromYouTube),
  };
};

// An article's featured video plus, for an event review, the review's videos.
export const articleWatchSource = (article, review = null, { facts = [], siteUrl = SITE_URL } = {}) => {
  if (!article || !(article.slug || article.id)) return null;
  const featured = parseVideoUrl(article.featured_video_url) ? [{ url: article.featured_video_url, poster_url: null, caption: null }] : [];
  const reviewVideos = review ? cleanVideos(review.videos, review.video) : [];
  return {
    kind: 'article',
    parentPath: `/blog/${article.slug || article.id}`,
    parentName: str(article.title) || 'Article',
    parentNoun: 'article',
    sectionName: 'The Parallel Report',
    sectionPath: '/blog',
    noun: 'Video',
    summary: plainText(article.excerpt || article.seo_description || '', 500),
    facts: facts.filter(Boolean),
    fallbackImage: absolute(article.featured_image_url, siteUrl),
    fallbackDate: article.published_at || article.created_at || null,
    videos: uniqueByKey([...featured, ...reviewVideos].map((v) => fromMediaVideo(v, siteUrl))),
  };
};

export const storeWatchSource = (store, { facts = [], cityLabel = '', siteUrl = SITE_URL } = {}) => {
  const path = store ? storePath(store) : null;
  if (!path) return null;
  return {
    kind: 'store',
    parentPath: path,
    parentName: str(store.name) || 'Card shop',
    parentNoun: 'card shop',
    sectionName: cityLabel ? `Card Shops in ${cityLabel}` : 'Card Shops',
    sectionPath: store.city ? `/card-shops/${store.city}` : '/card-shops',
    noun: 'Video',
    summary: plainText(store.description || '', 500),
    facts: facts.filter(Boolean),
    fallbackImage: absolute(Array.isArray(store.photos) ? store.photos[0]?.url : null, siteUrl),
    fallbackDate: store.updated_at || null,
    videos: uniqueByKey(cleanStoreVideos(store.videos).map((v) => fromMediaVideo(v, siteUrl))),
  };
};

// ── Reading a source ─────────────────────────────────────────────────────────

/** What a video is called in a list: its title, or its position. */
export const watchVideoLabel = (video, index) => video.title || `Video ${index + 1}`;

// The video's full name: "<Parent> — <title>", or "<Parent> — Event Video 2".
const watchVideoName = (source, video, index) => (video.title
  ? `${source.parentName} — ${video.title}`
  : `${source.parentName} — ${source.noun}${source.videos.length > 1 ? ` ${index + 1}` : ''}`);

/**
 * Every watch page a source has, in display order:
 * [{ key, path, label, name, thumbnailUrl }]. What the parent page links to
 * and what the sitemap lists.
 */
export const watchLinks = (source) => (source?.videos || []).map((video, index) => ({
  key: video.key,
  path: watchVideoPath(source.parentPath, video.key),
  label: watchVideoLabel(video, index),
  name: watchVideoName(source, video, index),
  thumbnailUrl: video.thumbnailUrl || source.fallbackImage || null,
}));

/** The watch path of the video with this key on the parent page, or null. */
export const watchPathFor = (source, key) => (
  (source?.videos || []).some((v) => v.key === key) ? watchVideoPath(source.parentPath, key) : null
);

/**
 * Everything one watch page shows, or null when the source has no video with
 * that key (removed, or a mistyped link — the caller sends the visitor to the
 * parent page).
 *
 * `jsonLd` holds the VideoObject — only when Google's required fields
 * (thumbnail, upload date) are all there, never an invalid one — and the
 * breadcrumb.
 */
export const buildWatchPage = (source, key, { siteUrl = SITE_URL } = {}) => {
  if (!source) return null;
  const index = source.videos.findIndex((v) => v.key === key);
  if (index < 0) return null;
  const video = source.videos[index];
  const links = watchLinks(source);
  const { name, path, thumbnailUrl } = links[index];
  const canonical = `${siteUrl}${path}`;
  const parentUrl = `${siteUrl}${source.parentPath}`;
  const facts = source.facts.join(' · ');
  const lead = video.title
    ? `Watch “${video.title}” from ${source.parentName}`
    : `Watch the ${source.noun.toLowerCase()} from ${source.parentName}`;
  const longDescription = plainText(`${lead}${facts ? ` — ${facts}` : ''}. ${source.summary}`, 500);
  const uploadDate = video.addedAt || source.fallbackDate || null;

  const videoObject = thumbnailUrl && uploadDate
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name,
        description: longDescription,
        thumbnailUrl: [thumbnailUrl],
        uploadDate,
        // embedUrl is the player (the iframe's own src); contentUrl is only
        // ever a real media file — never a youtube.com/watch page.
        ...(video.embedUrl ? { embedUrl: video.embedUrl } : {}),
        ...(video.contentUrl ? { contentUrl: video.contentUrl } : {}),
        url: canonical,
        mainEntityOfPage: canonical,
      }
    : null;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: source.sectionName, item: `${siteUrl}${source.sectionPath}` },
      { '@type': 'ListItem', position: 3, name: source.parentName, item: parentUrl },
      { '@type': 'ListItem', position: 4, name: watchVideoLabel(video, index), item: canonical },
    ],
  };

  return {
    video,
    index,
    name,
    label: watchVideoLabel(video, index),
    title: `${name} | Watch on CardPop`,
    description: plainText(longDescription, 300),
    longDescription,
    path,
    canonical,
    parentUrl,
    thumbnailUrl,
    uploadDate,
    videoObject,
    jsonLd: [videoObject, breadcrumb].filter(Boolean),
    others: links.filter((l) => l.key !== key),
  };
};
