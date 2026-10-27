import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { EventPhotoGrid } from '@/components/reviews/EventReviewGallery.jsx';
import { albumLabel } from '@/utils/eventGallery.js';

// The event page's photo gallery, grouped into albums (events.gallery_albums,
// normalised by cleanGalleryAlbums). One album renders as a plain gallery;
// more than one adds a row of chips — "2025 (6)", "2024 (12)" — above the
// grid, and the lightbox cycles within the chosen album.
const EventPhotoAlbums = ({ albums = [], eventName = '', title = 'Event Photos', headingId = 'event-photo-gallery' }) => {
  const [selected, setSelected] = useState(0);
  if (albums.length === 0) return null;
  const index = Math.min(selected, albums.length - 1);
  const album = albums[index];
  const total = albums.reduce((sum, a) => sum + a.images.length, 0);
  const label = albumLabel(album, index);
  const altPrefix = eventName ? `Photo from ${eventName}` : 'Event photo';
  const photos = album.images.map((url, i) => ({
    url,
    alt: `${altPrefix}${album.title ? ` — ${album.title}` : ''} (${i + 1} of ${album.images.length})`,
  }));

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id={headingId} className="font-heading text-xl font-bold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({total})</span>
      </div>

      {albums.length > 1 && (
        <div role="group" aria-label="Photo albums" className="flex flex-wrap gap-2">
          {albums.map((a, i) => {
            const active = i === index;
            return (
              <button
                key={`${albumLabel(a, i)}-${i}`}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
                  active
                    ? 'border-brand-red bg-brand-red text-white'
                    : 'border-border bg-background text-foreground hover:border-brand-red/60 hover:text-brand-red'
                }`}
              >
                {albumLabel(a, i)}
                <span className={`text-xs tabular-nums ${active ? 'text-white/80' : 'text-muted-foreground'}`}>({a.images.length})</span>
              </button>
            );
          })}
        </div>
      )}

      <EventPhotoGrid key={index} photos={photos} lightboxTitle={albums.length > 1 ? `${label} — ${eventName || title}` : ''} />
    </section>
  );
};

export default EventPhotoAlbums;
