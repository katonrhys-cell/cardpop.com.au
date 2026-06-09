import React, { useState, useRef, useEffect } from 'react';

const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  className = '',
  loading = 'lazy',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  priority = false,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef(null);

  // Generate srcset with different sizes
  const generateSrcSet = (baseSrc) => {
    const sizes = [320, 640, 768, 1024, 1200, 1920];
    return sizes
      .map(size => {
        // Replace extension with size parameter
        const url = new URL(baseSrc, window.location.origin);
        url.searchParams.set('w', size);
        url.searchParams.set('q', '80');
        url.searchParams.set('fm', 'webp');
        return `${url.toString()} ${size}w`;
      })
      .join(', ');
  };

  // Generate WebP and AVIF sources
  const generateSources = (baseSrc) => {
    const formats = ['image/avif', 'image/webp'];
    return formats.map(format => ({
      type: format,
      srcSet: generateSrcSet(baseSrc)
    }));
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    console.error('Image failed to load:', src);
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ width, height }}
        />
      )}
      <picture>
        {generateSources(src).map((source, index) => (
          <source
            key={index}
            type={source.type}
            srcSet={source.srcSet}
            sizes={sizes}
          />
        ))}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          width={width}
          height={height}
          loading={priority ? 'eager' : loading}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...props}
        />
      </picture>
    </div>
  );
};

export default OptimizedImage;
