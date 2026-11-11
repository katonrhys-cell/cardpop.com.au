import React, { useEffect, useState } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import RedditIcon from '@/components/RedditIcon.jsx';
import { fetchPublicJson, PUBLIC_REDDIT_URL } from '@/lib/publicApi.js';
import { REDDIT_SUBREDDIT, REDDIT_SUBREDDIT_URL } from '@/utils/redditLinks.js';

/**
 * "Latest on Reddit" — the newest posts from CardPop's subreddit, read through
 * the edge-cached /public/reddit endpoint. Renders nothing until there is at
 * least one post, so a quiet subreddit or a blocked feed leaves no empty box.
 */
const RedditLatestPosts = () => {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicJson(PUBLIC_REDDIT_URL)
      .then((json) => { if (!cancelled && Array.isArray(json?.posts)) setPosts(json.posts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (posts.length === 0) return null;

  return (
    <section className="mb-8 bg-card border border-border rounded-2xl p-5" aria-label="Latest on Reddit">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <RedditIcon className="w-5 h-5 text-[#FF4500]" /> Latest on r/{REDDIT_SUBREDDIT}
        </h2>
        <a
          href={REDDIT_SUBREDDIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          Open subreddit <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <ul className="divide-y divide-border">
        {posts.map((p) => (
          <li key={p.id}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between gap-3 py-2.5 group"
            >
              <span className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{p.title}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5" /> {p.comments}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RedditLatestPosts;
