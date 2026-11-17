import { OUTBOUND_TIMEOUT_MS, timeoutSignal } from './outboundTimeouts.js';

// Read-only client for Meta's Instagram Graph API ("Instagram API with
// Facebook Login"), used by the event scanner to read public posts with
// CardPop's own account token. Nothing here posts, comments or messages.
//
// Two reads:
//   • Business Discovery — another Business/Creator account's recent posts, by
//     handle. Personal accounts and private accounts are not readable.
//   • Tags — posts in which another account tagged CardPop.
//
// What the API does not offer, so this cannot do: the home feed, the list of
// accounts CardPop follows, stories, or any personal account's posts.
//
// Setup, permissions and token renewal: docs/instagram-event-scan.md

const GRAPH_HOST = 'https://graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v24.0';

// Photos are downloaded from Meta's CDN only. The URL comes back from the
// Graph API, but it is still checked so a surprising answer can't point the
// server at an arbitrary host.
const MEDIA_HOST_SUFFIXES = ['.cdninstagram.com', '.fbcdn.net'];
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// The model accepts 5 MB per image; a 1080 px Instagram photo is well under 1.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const POST_FIELDS = 'id,caption,media_type,media_url,permalink,timestamp';

/** Error from the Graph API, carrying its numeric code. */
export class InstagramApiError extends Error {
  constructor(message, { code = null, status = null } = {}) {
    super(message);
    this.name = 'InstagramApiError';
    this.code = code;
    this.status = status;
  }

  /** The token itself is the problem — every further call will fail the same way. */
  get isAuthError() {
    return this.code === 190 || this.code === 102 || this.status === 401;
  }
}

/** `{ token, accountId, version }`, or null when Instagram isn't connected. */
export function instagramConfig() {
  const token = (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
  const accountId = (process.env.INSTAGRAM_ACCOUNT_ID || '').trim();
  if (!token || !/^\d+$/.test(accountId)) return null;
  const version = /^v\d+\.\d+$/.test((process.env.INSTAGRAM_GRAPH_VERSION || '').trim())
    ? process.env.INSTAGRAM_GRAPH_VERSION.trim()
    : DEFAULT_GRAPH_VERSION;
  return { token, accountId, version };
}

/**
 * A handle from whatever an admin pasted — `@name`, `name`, or a profile link.
 * Returns the lower-case handle, or null when it isn't one.
 */
export function cleanInstagramHandle(input) {
  if (typeof input !== 'string') return null;
  let value = input.trim();
  if (!value) return null;
  const link = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i.exec(value);
  if (link) value = link[1];
  value = value.replace(/^@/, '').toLowerCase();
  // Profile-shaped paths that are not accounts.
  if (['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts'].includes(value)) return null;
  if (!/^[a-z0-9._]{1,30}$/.test(value)) return null;
  if (value.startsWith('.') || value.endsWith('.') || value.includes('..')) return null;
  return value;
}

export const instagramProfileUrl = (handle) => `https://www.instagram.com/${handle}/`;

async function graphGet(path, params) {
  const config = instagramConfig();
  if (!config) throw new InstagramApiError('Instagram is not connected (INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_ACCOUNT_ID).');

  const url = new URL(`${GRAPH_HOST}/${config.version}/${path.replace('{account}', config.accountId)}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', config.token);

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: timeoutSignal(OUTBOUND_TIMEOUT_MS.instagram),
    });
  } catch (err) {
    // Never the URL: it carries the token.
    throw new InstagramApiError(err?.name === 'TimeoutError'
      ? 'Instagram did not answer in time.'
      : 'Could not reach Instagram.');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || body?.error) {
    const apiError = body?.error || {};
    const message = apiError.code === 190
      ? 'The Instagram access token has expired or been revoked — create a new one (docs/instagram-event-scan.md).'
      : (apiError.error_user_msg || apiError.message || `Instagram answered HTTP ${response.status}.`);
    throw new InstagramApiError(message, { code: apiError.code ?? null, status: response.status });
  }
  return body;
}

/** The photos of one post, in order: its own image, or a carousel's image slides. */
function imageUrlsOf(media) {
  const urls = [];
  if (media.media_type === 'IMAGE' && media.media_url) urls.push(media.media_url);
  for (const child of media.children?.data ?? []) {
    if (child.media_type === 'IMAGE' && child.media_url) urls.push(child.media_url);
  }
  return [...new Set(urls)];
}

function normalisePost(media, fallbackUsername) {
  if (!media?.permalink) return null;
  return {
    id: String(media.id ?? ''),
    permalink: media.permalink,
    caption: typeof media.caption === 'string' ? media.caption.trim() : '',
    timestamp: media.timestamp || null,
    mediaType: media.media_type || null,
    username: (media.username || fallbackUsername || '').toLowerCase() || null,
    imageUrls: imageUrlsOf(media),
  };
}

/** Recent posts of a Business/Creator account, newest first. */
export async function fetchAccountPosts(handle, { limit = 8 } = {}) {
  const fields = `business_discovery.username(${handle}){username,name,media.limit(${limit}){${POST_FIELDS},children{media_type,media_url}}}`;
  const body = await graphGet('{account}', { fields });
  const account = body?.business_discovery;
  return (account?.media?.data ?? [])
    .map((media) => normalisePost(media, account?.username || handle))
    .filter(Boolean);
}

/** Recent posts that tagged CardPop's account, newest first. */
export async function fetchTaggedPosts({ limit = 15 } = {}) {
  const body = await graphGet('{account}/tags', { fields: `${POST_FIELDS},username`, limit: String(limit) });
  return (body?.data ?? []).map((media) => normalisePost(media, null)).filter(Boolean);
}

/** The connected account's handle — the admin panel's "is it working" check. */
export async function fetchConnectedAccount() {
  const body = await graphGet('{account}', { fields: 'username' });
  return { username: body?.username || null };
}

function isMetaMediaUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && MEDIA_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

/**
 * Download one post photo for the model. Resolves `{ mediaType, data }`
 * (base64) or null — a photo that can't be read is skipped, never fatal, and
 * it is never stored.
 */
export async function downloadPostImage(rawUrl) {
  if (!isMetaMediaUrl(rawUrl)) return null;
  try {
    const response = await fetch(rawUrl, {
      redirect: 'error',
      signal: timeoutSignal(OUTBOUND_TIMEOUT_MS.instagram),
    });
    if (!response.ok) return null;
    const mediaType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!MEDIA_TYPES.includes(mediaType)) return null;
    if (Number(response.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return { mediaType, data: bytes.toString('base64') };
  } catch {
    return null;
  }
}
