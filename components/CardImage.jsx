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
 * browser fetch a right-sized, auto-WebP image from Supabase. Sources are tried
 * in order and it steps to the next one on load failure:
 *   0. `thumbSrc` — the pre-generated grid thumbnail (uploads since
 *      THUMBNAILS_SINCE store one). A failed thumb is remembered for the
 *      session so it's never probed twice.
 *   1. `src` (+ `srcSet`) — the transformed, CDN-routed image.
 *   2. `fallbackSrc` — the untransformed original (still CDN-routed). Reaching
 *      it flags transforms as unavailable for the session, so we stop retrying
 *      them (e.g. when image transformations aren't enabled on the plan).
 *   3. `canonicalSrc` — the object straight from the Supabase origin, so an
 *      image-CDN outage self-heals instead of showing a broken thumbnail.
 * Only then does it show "No Image".
 */

// Thumbnail URLs that 404'd/errored this session — skipped on later renders so
// a missing companion thumb costs at most one request per session.
const failedThumbs = new Set();
// URLs that have already loaded this session. A card that remounts on one of
// them (navigating back to a grid, re-filtering, a parent refetch) starts
// visible instead of replaying the shimmer + fade over an image the browser
// already has — that replay made every card on the page blink.
const loadedUrls = new Set();
const CardImage = ({
  src,
  srcSet,
  sizes,
  fallbackSrc,
  canonicalSrc,
  thumbSrc,
  alt = '',
  imgClassName = 'w-full h-full object-cover',
  width,
  height,
  loading = 'lazy',
  // Mark the above-the-fold LCP image (e.g. the first card in a grid). Lazy-
  // loading the LCP image is a documented anti-pattern that delays Largest
  // Contentful Paint, so a priority image loads eagerly at high fetch priority
  // and skips the opacity fade-in (which would push its first paint ~500ms
  // later). Leave false for everything below the fold.
  priority = false,
  ...props
}) => {
  // Ordered, de-duplicated list of sources to try. The primary carries the
  // srcSet; every fallback is a single untransformed URL. Filtering out
  // duplicates keeps the error handler from "advancing" to the same URL (which
  // would loop) when, say, fallbackSrc === src (no CDN configured). The thumb
  // stays in the list even once it has failed — a known-dead thumb is skipped
  // by starting past it (startTier) instead. Dropping it from the list
  // re-indexed every later entry, so the tier just advanced to (and every other
  // card showing that thumb) jumped past the primary to the wrong source.
  const candidates = [];
  if (thumbSrc) candidates.push({ url: thumbSrc, kind: 'thumb' });
  if (src) candidates.push({ url: src, srcSet: srcSet || undefined, kind: 'primary' });
  if (fallbackSrc && fallbackSrc !== src) candidates.push({ url: fallbackSrc });
  if (canonicalSrc && canonicalSrc !== src && canonicalSrc !== fallbackSrc) {
    candidates.push({ url: canonicalSrc });
  }
  const startTier = thumbSrc && failedThumbs.has(thumbSrc) ? 1 : 0;

  const [tier, setTier] = useState(startTier); // index into `candidates`
  const [status, setStatus] = useState( // 'loading' | 'loaded' | 'error'
    () => (loadedUrls.has(candidates[startTier]?.url) ? 'loaded' : 'loading'),
  );
  const imgRef = useRef(null);

  // Reset when the source changes (e.g. a card re-used in a virtualised list,
  // or the session flipping to untransformed URLs after a transformed one
  // 404s — which swaps `src` for every card at once). Only blank back to the
  // shimmer if we have not already shown an image; if a photo is already on
  // screen, keep it visible (opacity-100) and let the browser swap the new
  // source in place. Forcing opacity-0 here made loaded homepage photos
  // visibly flicker/disappear on every such re-render (e.g. while scrolling).
  useEffect(() => {
    setTier(startTier);
    setStatus((prev) => (prev === 'loaded' ? 'loaded' : 'loading'));
  }, [src, thumbSrc]);

  const active = candidates[tier];
  const effectiveSrc = active?.url ?? null;
  const effectiveSrcSet = active?.srcSet;

  // A cached image can finish loading before React attaches `onLoad` — most
  // often when the component remounts (e.g. scrolling back to a card or
  // navigating back to the page) and the browser already has the file. In that
  // case the `load` event never reaches our handler and the image would stay
  // stuck at opacity-0. Sync from the element's own `complete` flag after each
  // render so a ready image reveals itself even without an `onLoad` callback.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      loadedUrls.add(effectiveSrc);
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
    // A dead thumbnail (e.g. a timestamp past the cutoff whose thumb upload
    // failed) is remembered so later renders skip straight to the full image.
    if (active?.kind === 'thumb') failedThumbs.add(active.url);
    // Leaving the transformed primary means transforms may be unavailable —
    // flag it so getCardImage stops emitting transform URLs this session.
    if (active?.kind === 'primary') markTransformsUnavailable();
    if (tier < candidates.length - 1) {
      setTier(tier + 1);
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
        loading={priority ? 'eager' : loading}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        // This component runs its own multi-tier fallback (above), so the
        // global CDN→origin safety net in utils/imageCdnFallback.js must not
        // also mutate its src — opt out.
        data-managed-image=""
        onLoad={() => { loadedUrls.add(effectiveSrc); setStatus('loaded'); }}
        onError={handleError}
        // Priority (LCP) images render at full opacity immediately — the fade-in
        // used for below-the-fold cards would delay their first paint.
        className={`${imgClassName} ${
          priority
            ? ''
            : `transition-opacity duration-500 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`
        }`}
        {...props}
      />
    </>
  );
};

export default CardImage;
