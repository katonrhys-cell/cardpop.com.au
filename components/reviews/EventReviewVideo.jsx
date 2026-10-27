import React from 'react';
import { Video } from 'lucide-react';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { parseVideoUrl } from '@/utils/videoEmbed.js';
import { cleanVideo, videoKind } from '@/utils/eventReview.js';

// The review's video: an uploaded clip played in a native <video>, or a
// YouTube / Vimeo link embedded through the hosts already in the CSP
// frame-src. The clip's src stays the canonical Supabase URL because the CSP
// media-src allows the Supabase host, not the image CDN; the poster is an image
// and goes through the CDN like every other photo. Renders nothing without a
// usable video.
const EventReviewVideo = ({ video, title = 'Video from the day' }) => {
  const v = cleanVideo(video);
  if (!v) return null;
  const kind = videoKind(v.url);
  const embed = kind === 'embed' ? parseVideoUrl(v.url) : null;

  return (
    <section aria-labelledby="event-review-video" className="space-y-4">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id="event-review-video" className="font-heading text-xl font-bold text-foreground">{title}</h2>
      </div>
      <figure className="m-0">
        <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
          {embed ? (
            <iframe
              src={embed.embedUrl}
              title={v.caption || title}
              className="block w-full h-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <video
              src={v.url}
              poster={v.poster_url ? toCdnUrl(v.poster_url) : undefined}
              controls
              playsInline
              preload="metadata"
              className="block w-full h-full object-contain"
              aria-label={v.caption || title}
            />
          )}
        </div>
        {v.caption && <figcaption className="mt-2 text-sm text-muted-foreground">{v.caption}</figcaption>}
      </figure>
    </section>
  );
};

export default EventReviewVideo;
