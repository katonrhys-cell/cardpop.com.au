import { describe, it, expect } from 'vitest';
import {
  youTubeVideoId,
  youTubeEmbedUrl,
  youTubeThumbnailUrl,
  facebookEmbedUrl,
  buildVideoJsonLd,
  buildEventJsonLd,
  formatEntryFee,
  MAX_JSON_LD_GALLERY_IMAGES,
} from '@/lib/eventSeo.js';

describe('youTubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('extracts the id from %s', (url, id) => {
    expect(youTubeVideoId(url)).toBe(id);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['https://vimeo.com/12345678'],
    ['https://example.com/watch?v=dQw4w9WgXcQ'],
    ['not a url'],
    ['dQw4w9WgXcQ'], // bare ids are not accepted — admins paste full URLs
  ])('returns null for %s', (url) => {
    expect(youTubeVideoId(url)).toBeNull();
  });
});

describe('youTubeEmbedUrl / youTubeThumbnailUrl', () => {
  it('builds privacy-enhanced embed and thumbnail URLs', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(youTubeEmbedUrl(url)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(youTubeThumbnailUrl(url)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('returns null when the URL is not YouTube', () => {
    expect(youTubeEmbedUrl('https://vimeo.com/1')).toBeNull();
    expect(youTubeThumbnailUrl(null)).toBeNull();
  });
});

describe('buildVideoJsonLd', () => {
  const event = {
    title: 'Brisbane Card Show',
    short_description: 'Two days of trading cards.',
    youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
    updated_at: '2026-07-16T00:00:00+00:00',
  };

  it('builds a schema.org VideoObject from the event', () => {
    const ld = buildVideoJsonLd(event);
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'Brisbane Card Show — Event Video',
      description: 'Two days of trading cards.',
      thumbnailUrl: ['https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'],
      uploadDate: '2026-07-16T00:00:00+00:00',
      contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    });
  });

  it('returns null when the event has no usable youtube_url', () => {
    expect(buildVideoJsonLd({ ...event, youtube_url: null })).toBeNull();
    expect(buildVideoJsonLd({ ...event, youtube_url: 'https://vimeo.com/1' })).toBeNull();
    expect(buildVideoJsonLd(null)).toBeNull();
  });
});

describe('formatEntryFee', () => {
  it('formats free, GA-only, GA+presale and presale-only pricing', () => {
    expect(formatEntryFee({ is_free: true })).toBe('Free entry');
    expect(formatEntryFee({ entry_fee_aud: 15 })).toBe('$15.00 AUD');
    expect(formatEntryFee({ entry_fee_aud: 15, presale_fee_aud: 25 }))
      .toBe('$15.00 AUD (presale/early bird $25.00)');
    expect(formatEntryFee({ presale_fee_aud: 40 })).toBe('Presale/early bird $40.00 AUD');
    expect(formatEntryFee({})).toBe('See organiser for ticket pricing');
  });
});

describe('buildEventJsonLd image', () => {
  const base = { slug: 'test-show', title: 'Test Show', start_date: '2026-10-01' };

  it('lists the cover first, then the gallery photos across albums, capped', () => {
    const ld = buildEventJsonLd({
      ...base,
      image_url: 'https://cdn.test/cover.jpg',
      gallery_albums: [
        { title: '2025', images: Array.from({ length: 6 }, (_, i) => `https://cdn.test/25-${i}.jpg`) },
        { title: '2024', images: Array.from({ length: 6 }, (_, i) => `https://cdn.test/24-${i}.jpg`) },
      ],
    });
    expect(ld.image[0]).toBe('https://cdn.test/cover.jpg');
    expect(ld.image).toHaveLength(1 + MAX_JSON_LD_GALLERY_IMAGES);
    expect(ld.image[1]).toBe('https://cdn.test/25-0.jpg');
    expect(ld.image.at(-1)).toBe('https://cdn.test/24-1.jpg');
  });

  it('falls back to the flat gallery list and the site image', () => {
    expect(buildEventJsonLd({ ...base, gallery_images: ['https://cdn.test/a.jpg'] }).image)
      .toEqual(['https://cardpop.com.au/og-image.jpg', 'https://cdn.test/a.jpg']);
  });
});

describe('buildEventJsonLd offers', () => {
  const base = { slug: 'test-show', title: 'Test Show', start_date: '2026-10-01' };

  it('emits a single GA offer when there is no presale price', () => {
    const ld = buildEventJsonLd({ ...base, entry_fee_aud: 15 });
    expect(ld.offers).toMatchObject({ '@type': 'Offer', price: 15, priceCurrency: 'AUD' });
  });

  it('emits GA + presale offers when both prices are known', () => {
    const ld = buildEventJsonLd({ ...base, entry_fee_aud: 15, presale_fee_aud: 25 });
    expect(ld.offers).toHaveLength(2);
    expect(ld.offers[0]).toMatchObject({ name: 'General admission', price: 15 });
    expect(ld.offers[1]).toMatchObject({ name: 'Presale / early bird', price: 25 });
  });

  it('adds an offer per extra ticket price, after GA and presale', () => {
    const ld = buildEventJsonLd({
      ...base, entry_fee_aud: 15, presale_fee_aud: 12,
      ticket_prices: [{ type: 'group', group_size: 5, price_aud: 60 }, { type: 'child', price_aud: 5 }],
    });
    expect(ld.offers.map(o => [o.name, o.price])).toEqual([
      ['General admission', 15], ['Presale / early bird', 12], ['Child ticket', 5], ['Group ticket (5 people)', 60],
    ]);
  });

  it('lists only the extra prices when no GA price is published', () => {
    const ld = buildEventJsonLd({ ...base, entry_fee_aud: 0, is_free: false, ticket_prices: [{ type: 'vip', price_aud: 80 }] });
    expect(ld.offers).toMatchObject({ name: 'VIP ticket', price: 80 });
  });

  it('ignores extra prices on a free event', () => {
    const ld = buildEventJsonLd({ ...base, is_free: true, ticket_prices: [{ type: 'vip', price_aud: 80 }] });
    expect(ld.offers).toMatchObject({ name: 'General admission', price: 0 });
  });

  it('emits the presale offer alone when the GA price is unpublished', () => {
    const ld = buildEventJsonLd({ ...base, entry_fee_aud: 0, is_free: false, presale_fee_aud: 40 });
    expect(ld.offers).toMatchObject({ '@type': 'Offer', name: 'Presale / early bird', price: 40 });
  });

  it('keeps the free-event offer at price 0 alongside a presale price', () => {
    const ld = buildEventJsonLd({ ...base, is_free: true, presale_fee_aud: 10 });
    expect(ld.offers[0]).toMatchObject({ name: 'General admission', price: 0 });
  });
});

describe('facebookEmbedUrl', () => {
  it.each([
    'https://www.facebook.com/somepage/videos/1234567890/',
    'https://www.facebook.com/reel/1234567890',
    'https://www.facebook.com/watch/?v=1234567890',
    'https://fb.watch/abc123/',
    'https://www.facebook.com/share/v/abc123/',
    'https://www.facebook.com/share/r/abc123/',
    'https://m.facebook.com/somepage/videos/1234567890/',
  ])('uses the video player plugin for %s', (url) => {
    expect(facebookEmbedUrl(url)).toBe(
      `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
    );
  });

  it('uses the post plugin for a non-video public post URL', () => {
    const url = 'https://www.facebook.com/somepage/posts/1234567890';
    expect(facebookEmbedUrl(url)).toBe(
      `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}`,
    );
  });

  it.each([
    ['null', null],
    ['empty string', ''],
    ['not a URL', 'not a url'],
    ['non-facebook host', 'https://www.youtube.com/watch?v=abc'],
    ['lookalike domain', 'https://facebook.com.evil.com/videos/1'],
    ['lookalike prefix', 'https://notfacebook.com/videos/1'],
    ['non-http scheme', 'javascript:alert(1)'],
  ])('returns null for %s', (_label, url) => {
    expect(facebookEmbedUrl(url)).toBeNull();
  });
});

describe('buildEventJsonLd typicalAgeRange', () => {
  const base = { slug: 'test-show', title: 'Test Show', start_date: '2026-10-01' };

  it('emits typicalAgeRange when the event has age restrictions', () => {
    const ld = buildEventJsonLd({ ...base, age_restrictions: '18+' });
    expect(ld.typicalAgeRange).toBe('18+');
  });

  it('omits typicalAgeRange when age restrictions are not set', () => {
    const ld = buildEventJsonLd(base);
    expect(ld).not.toHaveProperty('typicalAgeRange');
  });
});
