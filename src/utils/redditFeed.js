import { REDDIT_FEED_URL, parseRedditListing } from '../../utils/redditLinks.js';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';

/**
 * The newest posts in CardPop's subreddit (public listing, no credentials).
 * Reddit sometimes refuses datacentre traffic, so a failure resolves to an
 * empty list — the forum block simply hides — rather than throwing.
 */
export async function fetchSubredditPosts() {
  try {
    const res = await fetch(REDDIT_FEED_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'web:au.com.cardpop:1.0 (community feed reader)',
      },
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.reddit),
    });
    if (!res.ok) return [];
    return parseRedditListing(await res.json(), 5);
  } catch {
    return [];
  }
}
