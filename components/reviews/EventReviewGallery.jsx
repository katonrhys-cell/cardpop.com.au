import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { cleanGallery } from '@/utils/eventReview.js';

// Photo gallery from the day: a responsive tile grid that opens a simple
// keyboard-navigable lightbox. Images are stored as canonical Supabase URLs and
// rewritten onto the image CDN at render time (utils/imageUrl.js).
// `headingId` keeps the section's aria-labelledby unique when the gallery is
// reused elsewhere (the event page's own photo gallery).
const EventReviewGallery = ({ gallery, title = 'Photos from the day', headingId = 'event-review-gallery' }) => {
  const photos = cleanGallery(gallery);
  const [open, setOpen] = useState(null); // index or null

  const step = useCallback((dir) => {
    setOpen((i) => (i == null ? i : (i + dir + photos.length) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (open == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  if (photos.length === 0) return null;
  const current = open != null ? photos[open] : null;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id={headingId} className="font-heading text-xl font-bold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({photos.length})</span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none p-0 m-0">
        {photos.map((p, i) => (
          <li key={`${p.url}-${i}`} className={i === 0 && photos.length >= 3 ? 'col-span-2 row-span-2' : ''}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block w-full h-full overflow-hidden rounded-xl bg-muted aspect-[4/3] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
              aria-label={`Open photo ${i + 1}${p.caption ? `: ${p.caption}` : ''}`}
            >
              <img
                src={toCdnUrl(p.url)}
                alt={p.alt || p.caption || `Photo ${i + 1} from the event`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {p.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-left text-xs font-medium text-white line-clamp-2">
                  {p.caption}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-5xl w-[96vw] p-0 bg-black border-none overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">{current?.caption || current?.alt || 'Event photo'}</DialogTitle>
          {current && (
            <figure className="relative m-0">
              <img
                src={toCdnUrl(current.url)}
                alt={current.alt || current.caption || 'Event photo'}
                className="block w-full max-h-[82vh] object-contain bg-black"
              />
              {(current.caption || photos.length > 1) && (
                <figcaption className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/90 bg-black">
                  <span className="min-w-0 truncate">{current.caption || ''}</span>
                  <span className="shrink-0 text-xs text-white/50 tabular-nums">{open + 1} / {photos.length}</span>
                </figcaption>
              )}
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={() => step(-1)} aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => step(1)} aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default EventReviewGallery;
