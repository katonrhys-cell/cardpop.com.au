
import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import CardImage from '@/components/CardImage.jsx';
import { getCardImage } from '@/utils/imageUrl.js';
import CardMicroscope from '@/components/CardMicroscope.jsx';

// The detail-page hero image is the LCP on listing/product pages, so it's loaded
// eagerly at high priority and served responsively (480/800/1200 w, auto-WebP).
const MAIN_SIZES = '(min-width: 1024px) 700px, 90vw';

const ProductImageCarousel = ({ images = [], record = null, frameClassName = 'bg-white dark:bg-zinc-950' }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [microscopeOpen, setMicroscopeOpen] = useState(false);

  // The underlying storage path / URL for a given slot. A record's storage_path
  // wins (single-image vault records); otherwise the array entry is the source.
  const sourceFor = (img) => {
    if (record && record.storage_path) return record.storage_path;
    return typeof img === 'string' ? img : null;
  };

  const validImages = Array.isArray(images) ? images : (images ? [images] : []);
  const mainSource = validImages.length > 0 ? sourceFor(validImages[activeIndex]) : null;
  const main = getCardImage(mainSource, { widths: [480, 800, 1200], quality: 78 });

  if (validImages.length === 0 || !main.src) {
    return (
      <div className="w-full aspect-[4/5] md:aspect-square bg-muted/40 rounded-3xl border border-border flex flex-col items-center justify-center text-muted-foreground">
        <ImageOff className="w-16 h-16 mb-4 opacity-20" />
        <p className="font-medium text-sm">No images available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image with Microscope */}
      <div
        onClick={() => setMicroscopeOpen(true)}
        className={cn("relative w-full aspect-[4/5] md:aspect-square rounded-3xl border border-border overflow-hidden cursor-zoom-in group shadow-sm", frameClassName)}
      >
        <CardImage
          src={main.src}
          srcSet={main.srcSet}
          sizes={MAIN_SIZES}
          fallbackSrc={main.fallbackSrc}
          alt={`Product view ${activeIndex + 1}`}
          imgClassName="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
      </div>

      {/* The magnifier needs full resolution — give it the untransformed original. */}
      <CardMicroscope
        isOpen={microscopeOpen}
        onClose={() => setMicroscopeOpen(false)}
        imageUrl={main.fallbackSrc}
        altText={`Product view ${activeIndex + 1}`}
      />

      {/* Thumbnails */}
      {validImages.length > 1 && (
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
                <CardImage
                  src={thumb.src}
                  srcSet={thumb.srcSet}
                  sizes="80px"
                  fallbackSrc={thumb.fallbackSrc}
                  alt={`Thumbnail ${idx + 1}`}
                  imgClassName="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductImageCarousel;
