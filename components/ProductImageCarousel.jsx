
import React, { useState, useRef } from 'react';
import { ImageOff, Play, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import CardImage from '@/components/CardImage.jsx';
import CardShowcase from '@/components/vault/CardShowcase.jsx';
import { normalizeStyle, DEFAULT_STYLE } from '@/lib/displayStyles.js';
import { getCardImage, publicImageUrl, publicVideoUrl } from '@/utils/imageUrl.js';
import { videoPosterPath } from '@/utils/cardVideo.js';
import CardMicroscope from '@/components/CardMicroscope.jsx';

// The detail-page hero image is the LCP on listing/product pages, so it's loaded
// eagerly at high priority and served responsively (480/800/1200 w, auto-WebP).
const MAIN_SIZES = '(min-width: 1024px) 700px, 90vw';

// The seller's optional clip, as a thumbnail with a play badge. The poster is a
// pre-generated frame; if it's missing the badge sits on a dark tile.
const VideoThumb = ({ videoPath, frameClassName, active, onClick }) => {
  const [posterFailed, setPosterFailed] = useState(false);
  const poster = posterFailed ? null : publicImageUrl(videoPosterPath(videoPath));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Play video"
      className={cn(
        "relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 snap-start bg-black",
        frameClassName,
        active
          ? "border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
          : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
      )}
    >
      {poster && (
        <img
          src={poster}
          alt=""
          loading="lazy"
          onError={() => setPosterFailed(true)}
          className="w-full h-full object-cover"
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="bg-black/60 rounded-full p-1.5">
          <Play className="w-4 h-4 text-white fill-white" />
        </span>
      </span>
    </button>
  );
};

const ProductImageCarousel = ({ images = [], video = null, record = null, displayStyle, frameClassName = 'bg-white dark:bg-zinc-950' }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [microscopeOpen, setMicroscopeOpen] = useState(false);
  // Descriptive alt text: the card's name plus which view this is. "Product
  // view 2" told a screen reader (and Google Images) nothing.
  const subject = record?.name || record?.card_name || record?.title || record?.vault_item?.card_name || 'Card';
  const viewLabel = (idx) => (idx === 0 ? 'front' : idx === 1 ? 'back' : `photo ${idx + 1}`);
  const altFor = (idx) => `${subject} – ${viewLabel(idx)}`;
  // Swipe between photos on touch — thumbnails alone are easy to miss on a phone.
  const touchStartX = useRef(null);

  // The underlying storage path / URL for a given slot. A record's storage_path
  // wins (single-image vault records); otherwise the array entry is the source.
  const sourceFor = (img) => {
    if (record && record.storage_path) return record.storage_path;
    return typeof img === 'string' ? img : null;
  };

  const validImages = Array.isArray(images) ? images : (images ? [images] : []);
  // The video, when there is one, is the last slot after the photos. Its index
  // equals validImages.length, so photo indices are unchanged.
  const videoIndex = video && validImages.length > 0 ? validImages.length : -1;
  const slotCount = validImages.length + (videoIndex !== -1 ? 1 : 0);
  const videoActive = videoIndex !== -1 && activeIndex === videoIndex;
  const mainSource = validImages.length > 0 && !videoActive ? sourceFor(validImages[activeIndex]) : null;
  const main = getCardImage(mainSource, { widths: [480, 800, 1200], quality: 78 });

  // A vault listing carries the seller's chosen display style. Anything other
  // than Classic renders the hero through the Card Showcase Engine so the style
  // the seller paid for is what a buyer actually sees on the listing page.
  //
  // The style applies to the FIRST photograph only — that's the term of the
  // feature. Every listing's first photo is the card front the showcase frames
  // (shine, slab, glass cabinet…); the extra shots are backs, corners, edges
  // and flaws a buyer is inspecting for condition, so they stay plain and
  // unembellished rather than being dressed up by an effect layer.
  const style = normalizeStyle(displayStyle);
  const useShowcase = style !== DEFAULT_STYLE && activeIndex === 0;

  if (validImages.length === 0 || (!videoActive && !main.src)) {
    return (
      <div className="w-full aspect-[4/5] md:aspect-square bg-muted/40 rounded-3xl border border-border flex flex-col items-center justify-center text-muted-foreground">
        <ImageOff className="w-16 h-16 mb-4 opacity-20" />
        <p className="font-medium text-sm">No images available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {videoActive ? (
        <div className="relative w-full aspect-[4/5] md:aspect-square rounded-3xl border border-border overflow-hidden bg-black shadow-sm">
          <video
            key={video}
            src={publicVideoUrl(video)}
            poster={publicImageUrl(videoPosterPath(video)) || undefined}
            controls
            autoPlay
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>
      ) : (
      <div
        onClick={() => setMicroscopeOpen(true)}
        onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const start = touchStartX.current; touchStartX.current = null;
          if (start == null || slotCount < 2) return;
          const dx = (e.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(dx) < 40) return;
          e.preventDefault();
          setActiveIndex((i) => (dx < 0 ? (i + 1) % slotCount : (i - 1 + slotCount) % slotCount));
        }}
        className={cn("relative w-full aspect-[4/5] md:aspect-square rounded-3xl border border-border overflow-hidden cursor-zoom-in group shadow-sm", frameClassName)}
      >
        {useShowcase ? (
          // The showcase frames the card itself (shine, slab, glass cabinet…),
          // so it gets a card-proportioned stage centred in the square hero
          // rather than the full frame — otherwise the effect layers spill
          // across the empty gutter either side of a portrait card.
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
            <div className="relative h-full aspect-[5/7] max-w-full">
              <CardShowcase
                src={main.src}
                srcSet={main.srcSet}
                sizes={MAIN_SIZES}
                fallbackSrc={main.fallbackSrc}
                alt={altFor(activeIndex)}
                displayStyle={style}
                loading="eager"
                priority
              />
            </div>
          </div>
        ) : (
          <CardImage
            src={main.src}
            srcSet={main.srcSet}
            sizes={MAIN_SIZES}
            fallbackSrc={main.fallbackSrc}
            alt={altFor(activeIndex)}
            imgClassName="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            loading="eager"
            fetchPriority="high"
          />
        )}
        {/* Decorative only — pointer-events pass through so the interactive
            display styles (holographic pointer tracking) still see the cursor. */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 pointer-events-none" />
        {/* Zoom affordance: always visible on touch screens (there is no hover),
            hover-revealed on pointer devices. */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-300">
          <ZoomIn className="h-4 w-4" aria-hidden="true" /> Tap to zoom
        </div>
        {slotCount > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + slotCount) % slotCount); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-md hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % slotCount); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-md hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground shadow-sm backdrop-blur-md" aria-live="polite">
              {activeIndex + 1} / {slotCount}
            </span>
          </>
        )}
      </div>
      )}

      {/* The magnifier needs full resolution — give it the untransformed original. */}
      <CardMicroscope
        isOpen={microscopeOpen}
        onClose={() => setMicroscopeOpen(false)}
        imageUrl={main.fallbackSrc}
        altText={altFor(activeIndex)}
      />

      {/* Thumbnails */}
      {(validImages.length > 1 || videoIndex !== -1) && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {validImages.map((img, idx) => {
            const thumb = getCardImage(sourceFor(img), { widths: [80, 160] });
            return (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  "relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 snap-start",
                  frameClassName,
                  activeIndex === idx
                    ? "border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                    : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
                )}
              >
                {/* An 80 px tile: load the 480 px companion thumb where one exists
                    rather than the full photo, and let the hero win the bandwidth
                    race — ten supplier PNGs downloading at once held the hero's
                    placeholder on screen for the whole gallery's weight. */}
                <CardImage
                  thumbSrc={thumb.thumbSrc}
                  src={thumb.src}
                  srcSet={thumb.srcSet}
                  sizes="80px"
                  fallbackSrc={thumb.fallbackSrc}
                  canonicalSrc={thumb.canonicalSrc}
                  alt={`${altFor(idx)} thumbnail`}
                  imgClassName="w-full h-full object-cover"
                  fetchPriority="low"
                />
              </button>
            );
          })}
          {videoIndex !== -1 && (
            <VideoThumb
              videoPath={video}
              frameClassName={frameClassName}
              active={videoActive}
              onClick={() => setActiveIndex(videoIndex)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ProductImageCarousel;
