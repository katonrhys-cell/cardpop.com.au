// Featured-video support for blog articles.
//
// Admins paste a plain YouTube or Vimeo URL into the article editor. This module
// turns that URL into everything the UI needs: a privacy-friendly embed URL and
// (for YouTube) an auto-derived poster thumbnail so listing cards don't need a
// separate image.
//
// Security note: the embed hosts must be allowlisted in the site's CSP
// `frame-src` (vercel.json). YouTube renders through www.youtube-nocookie.com
// and Vimeo through player.vimeo.com — both are present there. Never build an
// embed URL for a host that isn't in that allowlist; the iframe would be blocked.

// Extract the 11-char YouTube video id from the common URL shapes:
//   https://www.youtube.com/watch?v=ID
//   https://youtu.be/ID
//   https://www.youtube.com/embed/ID
//   https://www.youtube.com/shorts/ID
//   https://www.youtube-nocookie.com/embed/ID
const parseYouTubeId = (url) => {
  const patterns = [
    /(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|shorts)\/([\w-]{11})/i,
    /youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
};

// Extract the numeric Vimeo id from:
//   https://vimeo.com/123456789
//   https://vimeo.com/channels/staffpicks/123456789
//   https://player.vimeo.com/video/123456789
// Vimeo also issues private links with an unlisted hash (vimeo.com/ID/HASH);
// we capture the hash so the embed can play the unlisted video.
const parseVimeo = (url) => {
  const player = url.match(/player\.vimeo\.com\/video\/(\d+)(?:\?h=([\w]+))?/i);
  if (player) return { id: player[1], hash: player[2] || null };
  const canonical = url.match(/vimeo\.com\/(?:[\w-]+\/)*?(\d+)(?:\/([\w]+))?/i);
  if (canonical) return { id: canonical[1], hash: canonical[2] || null };
  return null;
};

// Parse a featured-video URL into a normalised descriptor, or null when the URL
// is empty or from an unsupported host. Consumers should treat null as "no
// video — fall back to the featured image".
//
// Returned shape:
//   { provider, id, embedUrl, thumbnailUrl }
// thumbnailUrl is null for Vimeo (no thumbnail can be derived without an API
// call) — callers fall back to the article's featured image for the poster.
export function parseVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();
  if (!url) return null;

  const ytId = parseYouTubeId(url);
  if (ytId) {
    return {
      provider: 'youtube',
      id: ytId,
      // youtube-nocookie + modestbranding + rel=0 keeps the embed clean and
      // avoids setting tracking cookies until the viewer hits play.
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
    };
  }

  const vimeo = parseVimeo(url);
  if (vimeo) {
    const q = vimeo.hash ? `?h=${vimeo.hash}` : '';
    return {
      provider: 'vimeo',
      id: vimeo.id,
      embedUrl: `https://player.vimeo.com/video/${vimeo.id}${q}`,
      thumbnailUrl: null,
    };
  }

  return null;
}

// True when the given URL is a recognised, embeddable video link.
export function isSupportedVideoUrl(url) {
  return parseVideoUrl(url) !== null;
}
