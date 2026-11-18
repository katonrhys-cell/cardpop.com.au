import React from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { parseVideoUrl } from '@/utils/videoEmbed.js';
import { cleanVideos, videoKind } from '@/utils/eventReview.js';
import { mediaVideoKey, watchVideoPath } from '@/utils/videoWatch.js';

// One playable video: an uploaded clip in a native <video>, or a YouTube /
// Vimeo link embedded through the hosts already in the CSP frame-src. The
// clip's src stays the canonical Supabase URL because the CSP media-src allows
// the Supabase host, not the image CDN; the poster is an image and goes through
// the CDN like every other photo.
//
// `watchBase` is the path of the page the video belongs to: the player then
// links to the video's own watch page (utils/videoWatch.js) — the page Google
// indexes it on; this one only plays it.
export const ReviewVideoPlayer = ({ video, title, watchBase = null }) => {
  const kind = videoKind(video.url);
  const watchKey = watchBase ? mediaVideoKey(video.url) : null;
  const embed = kind === 'embed' ? parseVideoUrl(video.url) : null;
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        {embed ? (
          <iframe
            src={embed.embedUrl}
            title={video.caption || title}
            className="block w-full h-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <video
            src={video.url}
            poster={video.poster_url ? toCdnUrl(video.poster_url) : undefined}
            controls
            playsInline
            preload="metadata"
            className="block w-full h-full object-contain"
            aria-label={video.caption || title}
          />
        )}
      </div>
      {(video.caption || watchKey) && (
        <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {video.caption && <span>{video.caption}</span>}
          {watchKey && (
            <Link to={watchVideoPath(watchBase, watchKey)} className="text-xs font-medium underline-offset-2 hover:text-primary hover:underline">
              Open video page
            </Link>
          )}
        </figcaption>
      )}
    </figure>
  );
};

// The review's videos, in order. Takes `videos` (the list) or the legacy single
// `video`. Renders nothing without a usable video.
const EventReviewVideo = ({ videos, video, title, watchBase = null }) => {
  const list = cleanVideos(videos, video);
  if (list.length === 0) return null;
  const heading = title || (list.length > 1 ? 'Videos from the day' : 'Video from the day');

  return (
    <section aria-labelledby="event-review-video" className="space-y-4">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id="event-review-video" className="font-heading text-xl font-bold text-foreground">{heading}</h2>
      </div>
      <div className={list.length > 1 ? 'grid gap-6 md:grid-cols-2' : ''}>
        {list.map((v) => <ReviewVideoPlayer key={v.url} video={v} title={heading} watchBase={watchBase} />)}
      </div>
    </section>
  );
};

export default EventReviewVideo;
