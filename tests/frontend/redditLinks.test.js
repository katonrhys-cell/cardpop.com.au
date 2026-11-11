import { describe, it, expect } from 'vitest';
import { redditShareUrl, parseRedditListing, REDDIT_SUBREDDIT_URL } from '@/utils/redditLinks.js';

describe('redditShareUrl', () => {
  it('encodes the page url and title', () => {
    const u = new URL(redditShareUrl('https://cardpop.com.au/community/discussion/1?a=b&c=d', 'PSA 10 & more'));
    expect(u.origin + u.pathname).toBe('https://www.reddit.com/submit');
    expect(u.searchParams.get('url')).toBe('https://cardpop.com.au/community/discussion/1?a=b&c=d');
    expect(u.searchParams.get('title')).toBe('PSA 10 & more');
  });
});

describe('parseRedditListing', () => {
  const child = (over) => ({ data: { id: 'a', title: 'Hello', permalink: '/r/x/comments/a/hello/', author: 'u', num_comments: 3, score: 5, created_utc: 1700000000, ...over } });

  it('keeps normal posts with reddit.com permalinks', () => {
    const [p] = parseRedditListing({ data: { children: [child()] } });
    expect(p.url).toBe('https://www.reddit.com/r/x/comments/a/hello/');
    expect(p.comments).toBe(3);
  });

  it('drops stickied, NSFW, removed and non-/r/ posts', () => {
    const json = { data: { children: [child({ stickied: true }), child({ over_18: true }), child({ removed_by_category: 'moderator' }), child({ permalink: 'https://evil.example' })] } };
    expect(parseRedditListing(json)).toEqual([]);
  });

  it('is safe on garbage and respects the limit', () => {
    expect(parseRedditListing(null)).toEqual([]);
    const many = { data: { children: Array.from({ length: 9 }, (_, i) => child({ id: String(i) })) } };
    expect(parseRedditListing(many, 3)).toHaveLength(3);
  });

  it('points at the subreddit', () => {
    expect(REDDIT_SUBREDDIT_URL).toBe('https://www.reddit.com/r/cardpop_aus_forum/');
  });
});
