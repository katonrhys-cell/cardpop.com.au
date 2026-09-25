import { describe, it, expect } from 'vitest';
import {
  parseObjectUrl, objectUrl, isConvertible, optimizedPath, optimizedThumbPath, rewriteRowImages,
} from '../../src/utils/shopImageOptimize.js';
import { thumbStoragePath } from '../../utils/imageUrl.js';

const ORIGIN = 'https://vrfsaazuqjxotnieqlkd.supabase.co';
const BUCKET = 'palms off gaming products';
const SRC = `${ORIGIN}/storage/v1/object/public/palms%20off%20gaming%20products/Mag%20Lock%20Cases/MAG-55PT_front.png`;

describe('shop image optimization paths', () => {
  it('parses and rebuilds an encoded object URL round-trip', () => {
    const parsed = parseObjectUrl(SRC);
    expect(parsed).toEqual({ origin: ORIGIN, bucket: BUCKET, path: 'Mag Lock Cases/MAG-55PT_front.png' });
    expect(objectUrl(parsed.origin, parsed.bucket, parsed.path)).toBe(SRC);
    expect(objectUrl(ORIGIN, BUCKET, 'A & B/x.png')).toContain('/A%20%26%20B/x.png');
  });

  it('rejects non-storage URLs', () => {
    expect(parseObjectUrl('https://example.com/a.png')).toBeNull();
    expect(parseObjectUrl(null)).toBeNull();
  });

  it('only converts PNG/JPEG originals, never already-optimized files', () => {
    expect(isConvertible('x/a.png')).toBe(true);
    expect(isConvertible('x/a.JPG')).toBe(true);
    expect(isConvertible('x/a.webp')).toBe(false);
    expect(isConvertible('optimized/x/a.png')).toBe(false);
  });

  it('names the full image and a thumb that utils/imageUrl.js will derive', () => {
    const p = 'Mag Lock Cases/MAG-55PT_front.png';
    expect(optimizedPath(p)).toBe('optimized/Mag Lock Cases/MAG-55PT_front.opt.webp');
    expect(optimizedThumbPath(p)).toBe('optimized/Mag Lock Cases/MAG-55PT_front.opt.thumb.webp');
    expect(thumbStoragePath(optimizedPath(p))).toBe(optimizedThumbPath(p));
  });
});

describe('rewriteRowImages', () => {
  const OPT = objectUrl(ORIGIN, BUCKET, optimizedPath('Mag Lock Cases/MAG-55PT_front.png'));
  const done = new Map([[SRC, OPT]]);

  it('swaps converted URLs in image_url and images, keeping order and others', () => {
    const other = `${ORIGIN}/storage/v1/object/public/media/x.jpg`;
    expect(rewriteRowImages({ image_url: SRC, images: [SRC, other] }, done)).toEqual({ image_url: OPT, images: [OPT, other] });
  });

  it('leaves a row alone when a source failed or nothing matches', () => {
    expect(rewriteRowImages({ image_url: 'https://x/y.png', images: ['https://x/y.png'] }, done)).toBeNull();
    expect(rewriteRowImages({ image_url: null, images: null }, done)).toBeNull();
  });
});
