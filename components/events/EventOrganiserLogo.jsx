import React, { useState } from 'react';
import { publicImageUrl, publicVideoUrl } from '@/utils/imageUrl.js';
import { isVideoLogoUrl, safeLogoUrl, logoAltText } from '@/utils/eventOrganiserLogo.js';

// The organiser's logo on an event page (events.organizer_logo_url): a still
// or animated image, or a short muted video loop. Renders nothing when the
// event has no logo or it fails to load, so the layout can fall back to the
// full-width title. `title` is the "Presented by" caption's organiser name.
export default function EventOrganiserLogo({ event, className = '' }) {
  const url = safeLogoUrl(event?.organizer_logo_url);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;

  const alt = logoAltText(event);
  const media = isVideoLogoUrl(url) ? (
    // The canonical storage URL (not the image CDN) — the CSP media-src only
    // allows the Supabase host, and the Worker is built for small images.
    <video
      src={publicVideoUrl(url)}
      autoPlay
      muted
      loop
      playsInline
      aria-label={alt}
      onError={() => setFailed(true)}
      className="max-h-28 md:max-h-36 w-auto max-w-full object-contain"
      data-testid="organiser-logo-video"
    />
  ) : (
    <img
      src={publicImageUrl(url)}
      alt={alt}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      className="max-h-28 md:max-h-36 w-auto max-w-full object-contain"
      data-testid="organiser-logo"
    />
  );

  return (
    <figure className={`flex flex-col items-center justify-center gap-2 text-center ${className}`}>
      {media}
      {event?.organizer_name && (
        <figcaption className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Presented by {event.organizer_name}
        </figcaption>
      )}
    </figure>
  );
}
