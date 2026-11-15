import { describe, it, expect } from 'vitest';
import {
  MAX_STORE_PHOTOS,
  absoluteMediaUrl,
  cleanStorePhotos,
  cleanStoreVideos,
  normalizeStoreInput,
  storeHoursLines,
  storeIsIndexable,
  storeJsonLd,
  storeLogoUrl,
  storePageDescription,
  storePageTitle,
  storePath,
  storeSlug,
} from '@/utils/storePage.js';

const swapItt = {
  slug: 'swap-itt-melbourne',
  name: 'Swap Itt',
  suburb: 'Melbourne',
  city: 'melbourne',
  state: 'VIC',
  status: 'approved',
  address: '488 La Trobe St, Melbourne VIC',
  website: 'https://swapitt.com.au/',
  description: 'Buy, sell and trade card shop.',
  opening_hours: 'Monday: Closed\n\nTuesday to Friday: 11am – 7pm\n',
  photos: [
    { url: '/stores/swap-itt-melbourne/storefront.webp', caption: 'The entrance' },
    { url: 'https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/media/stores/x/photos/1.webp' },
  ],
  videos: [{ url: '/stores/swap-itt-melbourne/street.mp4', poster_url: '/stores/swap-itt-melbourne/street.poster.jpg' }],
};

describe('store pages', () => {
  it('builds the page path from the city and slug', () => {
    expect(storePath(swapItt)).toBe('/card-shops/melbourne/swap-itt-melbourne');
    expect(storePath({ slug: 'x' })).toBeNull();
  });

  it('keeps safe photos only, without duplicates, up to the cap', () => {
    const photos = cleanStorePhotos([
      ...swapItt.photos,
      swapItt.photos[0],
      { url: 'javascript:alert(1)' },
      { url: '//evil.test/x.jpg' },
      null,
    ]);
    expect(photos.map((p) => p.url)).toEqual(swapItt.photos.map((p) => p.url));
    expect(photos[0].caption).toBe('The entrance');
    const many = Array.from({ length: 40 }, (_, i) => ({ url: `/stores/a/${i}.webp` }));
    expect(cleanStorePhotos(many)).toHaveLength(MAX_STORE_PHOTOS);
    expect(cleanStorePhotos('nope')).toEqual([]);
  });

  it('keeps uploaded clips and YouTube links, and drops anything else', () => {
    const videos = cleanStoreVideos([
      ...swapItt.videos,
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { url: 'https://example.com/page.html' },
    ]);
    expect(videos).toHaveLength(2);
    expect(videos[0].poster_url).toBe('/stores/swap-itt-melbourne/street.poster.jpg');
  });

  it('splits opening hours into non-empty lines', () => {
    expect(storeHoursLines(swapItt.opening_hours)).toEqual(['Monday: Closed', 'Tuesday to Friday: 11am – 7pm']);
    expect(storeHoursLines(null)).toEqual([]);
  });

  it('indexes a page only when it has more than its directory line', () => {
    expect(storeIsIndexable(swapItt)).toBe(true);
    const bare = { ...swapItt, photos: [], videos: [], opening_hours: null };
    expect(storeIsIndexable(bare)).toBe(false);
    expect(storeIsIndexable({ ...bare, opening_hours: 'Daily: 10am – 5pm' })).toBe(true);
    expect(storeIsIndexable({ ...swapItt, status: 'pending' })).toBe(false);
  });

  it('writes the title, description and Store JSON-LD from the row', () => {
    expect(storePageTitle(swapItt, 'Melbourne')).toBe('Swap Itt — Card Shop in Melbourne | CardPop');
    expect(storePageDescription(swapItt, 'Melbourne')).toBe('Swap Itt in Melbourne: Buy, sell and trade card shop.');
    expect(storePageDescription({ ...swapItt, suburb: 'Carlton' }, 'Melbourne')).toContain('Swap Itt in Carlton, Melbourne:');
    const ld = storeJsonLd(swapItt);
    expect(ld['@type']).toBe('Store');
    expect(ld.url).toBe('https://cardpop.com.au/card-shops/melbourne/swap-itt-melbourne');
    expect(ld.image[0]).toBe('https://cardpop.com.au/stores/swap-itt-melbourne/storefront.webp');
    expect(ld.address).toMatchObject({ streetAddress: '488 La Trobe St, Melbourne VIC', addressRegion: 'VIC', addressCountry: 'AU' });
    expect(ld.sameAs).toEqual(['https://swapitt.com.au/']);
    expect(absoluteMediaUrl('https://cdn.test/a.jpg')).toBe('https://cdn.test/a.jpg');
  });

  it('normalises what the admin editor saves and refuses unsafe links', () => {
    const values = normalizeStoreInput({ ...swapItt, instagram_url: '', photos: [...swapItt.photos, { url: 'data:x' }] });
    expect(values.photos).toHaveLength(2);
    expect(values.photos[0]).toEqual({ url: '/stores/swap-itt-melbourne/storefront.webp', caption: 'The entrance' });
    expect(values.opening_hours).toBe('Monday: Closed\nTuesday to Friday: 11am – 7pm');
    expect(values.instagram_url).toBeNull();
    expect(values).not.toHaveProperty('slug');
    expect(values).not.toHaveProperty('status');
    expect(() => normalizeStoreInput({ ...swapItt, website: 'javascript:alert(1)' })).toThrow(/Website/);
    expect(() => normalizeStoreInput({ ...swapItt, website: '/relative' })).toThrow(/Website/);
    expect(() => normalizeStoreInput({ ...swapItt, name: ' ' })).toThrow(/name/i);
  });

  it('uses a safe logo link only, and puts it on the Store markup', () => {
    const withLogo = { ...swapItt, logo_url: 'https://x.supabase.co/storage/v1/object/public/media/stores/swap-itt-melbourne/logo/1.webp' };
    expect(storeLogoUrl(withLogo)).toBe(withLogo.logo_url);
    expect(storeJsonLd(withLogo).logo).toBe(withLogo.logo_url);
    expect(storeLogoUrl({ logo_url: 'javascript:alert(1)' })).toBeNull();
    expect(storeLogoUrl(swapItt)).toBeNull();
    expect(storeJsonLd(swapItt)).not.toHaveProperty('logo');
    expect(normalizeStoreInput(withLogo).logo_url).toBe(withLogo.logo_url);
    expect(normalizeStoreInput({ ...swapItt, logo_url: '' }).logo_url).toBeNull();
  });

  it('derives a new store slug the way the public form does', () => {
    expect(storeSlug('Swap Itt', 'Melbourne')).toBe('swap-itt-melbourne');
    expect(storeSlug('Café Pokémon!', 'St Kilda')).toBe('cafe-pokemon-st-kilda');
  });
});
