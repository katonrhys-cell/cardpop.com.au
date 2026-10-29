import React, { useEffect, useRef } from 'react';
import { Video } from 'lucide-react';
import { youTubeEmbedUrl, videoLabel, VIDEO_AUTOPLAY_DELAY_MS } from '@/utils/eventVideos.js';

// The event page's videos (events.event_videos, normalised by
// cleanEventVideos), shown below the photo gallery: one YouTube embed per
// video with its title underneath, plus the optional Facebook video embed
// last. Renders nothing without a usable video.
//
// The first YouTube video starts by itself VIDEO_AUTOPLAY_DELAY_MS after the
// page loads, through the iframe player API via postMessage (enabled by
// ?enablejsapi=1 on the embed src) rather than swapping in an autoplay URL,
// so the frame never reloads — a visitor who already pressed play keeps
// watching uninterrupted. Muted first: browsers block programmatic autoplay
// with sound. Only the first video starts; several playing at once would be
// noise.
const EventVideos = ({ videos = [], fbEmbedUrl = null, eventName = '', headingId = 'event-videos' }) => {
  const firstFrameRef = useRef(null);
  const firstId = videos[0]?.id || null;

  useEffect(() => {
    if (!firstId) return undefined;
    const timer = setTimeout(() => {
      const win = firstFrameRef.current?.contentWindow;
      if (!win) return;
      ['mute', 'playVideo'].forEach((func) =>
        win.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'),
      );
    }, VIDEO_AUTOPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [firstId]);

  if (videos.length === 0 && !fbEmbedUrl) return null;
  const count = videos.length + (fbEmbedUrl ? 1 : 0);
  const title = count > 1 ? 'Event Videos' : 'Event Video';
  const name = eventName || 'Event';

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id={headingId} className="font-heading text-xl font-bold text-foreground">{title}</h2>
        {count > 1 && <span className="text-xs text-muted-foreground">({count})</span>}
      </div>

      <div className="space-y-6">
        {videos.map((video, i) => {
          const label = videoLabel(video, i);
          return (
            <figure key={video.id} className="m-0">
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-md">
                <iframe
                  ref={i === 0 ? firstFrameRef : undefined}
                  src={`${youTubeEmbedUrl(video.id)}?enablejsapi=1`}
                  title={video.title ? `${name} — ${video.title}` : (videos.length > 1 ? `${name} — event video ${i + 1}` : `${name} — event video`)}
                  className="w-full h-full"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              {video.title && (
                <figcaption className="mt-2 text-sm font-semibold text-foreground">{label}</figcaption>
              )}
            </figure>
          );
        })}

        {fbEmbedUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-md">
            <iframe
              src={fbEmbedUrl}
              title={`${name} — Facebook video`}
              className="w-full h-full"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default EventVideos;
