// CardPop's Reddit presence — one place for the URLs, the "Share to Reddit"
// link and the parser for the subreddit's public feed. Dependency-free so the
// SPA, the backend (src/utils/redditFeed.js) and api/prerender.js all agree.

export const REDDIT_SUBREDDIT = 'cardpop_aus_forum';
export const REDDIT_USER = 'cardpop_aus';

export const REDDIT_SUBREDDIT_URL = `https://www.reddit.com/r/${REDDIT_SUBREDDIT}/`;
export const REDDIT_PROFILE_URL = `https://www.reddit.com/user/${REDDIT_USER}/`;

/** Public JSON listing of the newest posts in the subreddit. */
export const REDDIT_FEED_URL = `${REDDIT_SUBREDDIT_URL}new.json?limit=8&raw_json=1`;

/** `https://www.reddit.com/submit?…` for sharing a CardPop page to Reddit. */
export function redditShareUrl(url, title) {
  const params = new URLSearchParams({ url: String(url || ''), title: String(title || '').slice(0, 300) });
  return `https://www.reddit.com/submit?${params.toString()}`;
}

/**
 * Shape Reddit's listing JSON into a small, safe list. Stickied, NSFW and
 * removed posts are dropped; only reddit.com permalinks are kept.
 */
export function parseRedditListing(json, limit = 5) {
  const children = json?.data?.children;
  if (!Array.isArray(children)) return [];
  const posts = [];
  for (const child of children) {
    const d = child?.data;
    if (!d || d.stickied || d.over_18 || d.removed_by_category || !d.title || !d.permalink) continue;
    if (!String(d.permalink).startsWith('/r/')) continue;
    posts.push({
      id: String(d.id || d.permalink),
      title: String(d.title).slice(0, 200),
      author: String(d.author || '').slice(0, 40),
      url: `https://www.reddit.com${d.permalink}`,
      comments: Number.isFinite(d.num_comments) ? d.num_comments : 0,
      score: Number.isFinite(d.score) ? d.score : 0,
      createdAt: Number.isFinite(d.created_utc) ? new Date(d.created_utc * 1000).toISOString() : null,
    });
    if (posts.length >= limit) break;
  }
  return posts;
}
