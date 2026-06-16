// Image optimization utilities

/**
 * Generate alt text for trading card images
 */
export const generateCardAltText = (card) => {
  if (!card) return 'Trading card image';
  
  const parts = [];
  
  if (card.name || card.title || card.cardName) {
    parts.push(card.name || card.title || card.cardName);
  }
  
  if (card.set || card.series) {
    parts.push(`from ${card.set || card.series}`);
  }
  
  if (card.condition) {
    parts.push(`in ${card.condition} condition`);
  }
  
  if (card.game) {
    parts.push(card.game);
  }
  
  return parts.length > 0 ? parts.join(' ') : 'Trading card image';
};

/**
 * Generate responsive image sizes
 */
export const generateResponsiveSizes = (maxWidth = 1200) => {
  return [
    320,
    480,
    640,
    768,
    1024,
    1200,
    maxWidth
  ].filter(size => size <= maxWidth);
};

/**
 * Generate srcset for images
 */
export const generateSrcSet = (baseUrl, sizes) => {
  return sizes
    .map(size => {
      const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'https://cardpop.com.au');
      url.searchParams.set('w', size);
      url.searchParams.set('q', '80');
      url.searchParams.set('fm', 'webp');
      return `${url.toString()} ${size}w`;
    })
    .join(', ');
};

/**
 * Generate image CDN URL with optimization parameters
 */
export const generateOptimizedImageUrl = (imageUrl, options = {}) => {
  const {
    width = 800,
    height,
    quality = 80,
    format = 'webp',
    fit = 'cover'
  } = options;
  
  try {
    const url = new URL(imageUrl, typeof window !== 'undefined' ? window.location.origin : 'https://cardpop.com.au');
    url.searchParams.set('w', width);
    url.searchParams.set('q', quality);
    url.searchParams.set('fm', format);
    url.searchParams.set('fit', fit);
    
    if (height) {
      url.searchParams.set('h', height);
    }
    
    return url.toString();
  } catch (error) {
    console.error('Error generating optimized image URL:', error);
    return imageUrl;
  }
};

/**
 * Calculate aspect ratio for images
 */
export const calculateAspectRatio = (width, height) => {
  if (!width || !height) return '16/9';
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}/${height / divisor}`;
};

/**
 * Generate placeholder color based on image hash
 */
export const generatePlaceholderColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 80%)`;
};
