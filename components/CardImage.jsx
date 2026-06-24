import React, { useState } from 'react';

/**
 * Image for product/listing card grids.
 *
 * Designed to sit inside an existing `relative` aspect-ratio container (the
 * cards already reserve space, so there's no layout shift). It adds the polish
 * that was missing: a shimmer placeholder while loading, a smooth fade-in, and
 * a graceful "No Image" fallback for missing or broken photos.
 */
const CardImage = ({
  src,
  alt = '',
  imgClassName = 'w-full h-full object-cover',
  width,
  height,
  loading = 'lazy',
  ...props
}) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'

  if (!src || status === 'error') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-muted-foreground text-sm font-medium">
        No Image
      </div>
    );
  }

  return (
    <>
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`${imgClassName} transition-opacity duration-500 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </>
  );
};

export default CardImage;
