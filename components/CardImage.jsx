import React, { useState, useEffect, useRef } from 'react';
import { markTransformsUnavailable } from '@/utils/imageUrl.js';

/**
 * Image for product/listing card grids.
 *
 * Designed to sit inside an existing `relative` aspect-ratio container (the
 * cards already reserve space, so there's no layout shift). It adds the polish
 * that was missing: a shimmer placeholder while loading, a smooth fade-in, and
 * a graceful "No Image" fallback for missing or broken photos.
 *
 * Responsive: pass `srcSet` + `sizes` (built via `getCardImage`) to let the
 * browser fetch a right-sized, auto-WebP image from Supabase. If a transformed
 * URL fails (e.g. image transformations aren't enabled on the plan), it falls
 * back to `fallbackSrc` (the untransformed original) and flags transforms as
 * unavailable for the rest of the session, so we don't keep retrying them.
 */
const CardImage = ({
  src,
  srcSet,
  sizes,
  fallbackSrc,
  alt = '',
  imgClassName = 'w-full h-full object-cover',
  width,
  height,
  loading = 'lazy',
  ...props
}) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'
  const [useFallback, setUseFallback] = useState(false);
  const imgRef = useRef(null);

  // Reset when the source changes (e.g. a card re-used in a virtualised list,
  // or the session flipping to untransformed URLs after a transformed one
  // 404s — which swaps `src` for every card at once). Only blank back to the
  // shimmer if we have not already shown an image; if a photo is already on
  // screen, keep it visible (opacity-100) and let the browser swap the new
  // source in place. Forcing opacity-0 here made loaded homepage photos
  // visibly flicker/disappear on every such re-render (e.g. while scrolling).
  useEffect(() => {
    setUseFallback(false);
    setStatus((prev) => (prev === 'loaded' ? 'loaded' : 'loading'));
  }, [src]);

  const canFallback = !useFallback && fallbackSrc && fallbackSrc !== src;
  const effectiveSrc = useFallback ? fallbackSrc : src;
  const effectiveSrcSet = useFallback ? undefined : srcSet;

  // A cached image can finish loading before React attaches `onLoad` — most
  // often when the component remounts (e.g. scrolling back to a card or
  // navigating back to the page) and the browser already has the file. In that
  // case the `load` event never reaches our handler and the image would stay
  // stuck at opacity-0. Sync from the element's own `complete` flag after each
  // render so a ready image reveals itself even without an `onLoad` callback.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setStatus('loaded');
    }
  }, [effectiveSrc]);

  if (!effectiveSrc || status === 'error') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-muted-foreground text-sm font-medium">
        No Image
      </div>
    );
  }

  const handleError = () => {
    if (canFallback) {
      // Transformed URL failed → drop to the original and stop using transforms.
      markTransformsUnavailable();
      setUseFallback(true);
      setStatus('loading');
    } else {
      setStatus('error');
    }
  };

  return (
    <>
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      <img
        ref={imgRef}
        src={effectiveSrc}
        srcSet={effectiveSrcSet}
        sizes={effectiveSrcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={handleError}
        className={`${imgClassName} transition-opacity duration-500 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </>
  );
};

export default CardImage;
