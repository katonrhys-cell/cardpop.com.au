import { describe, it, expect } from 'vitest';
import {
  SCORE_CATEGORIES,
  SCORE_CATEGORY_IDS,
  isValidScore,
  toHalfStar,
  computeOverall,
  cleanScores,
  safeLink,
  cleanGallery,
  cleanPickups,
  normalizeReview,
  reviewPublishProblems,
  videoKind,
  cleanVideo,
  reviewVideoFileError,
  REVIEW_VIDEO_MAX_BYTES,
  hasScorecard,
  hasQuickFacts,
  formatAud,
  formatHours,
  formatScore,
  buildEventReviewJsonLd,
} from '@/utils/eventReview.js';
import { BLOG_CATEGORIES, EVENT_REVIEWS_CATEGORY } from '@/data/blogCategories.js';

describe('event review taxonomy', () => {
  it('files reviews under a real blog category', () => {
    expect(BLOG_CATEGORIES.some((c) => c.slug === EVENT_REVIEWS_CATEGORY)).toBe(true);
  });

  it('has five distinct scorecard categories with labels', () => {
    expect(SCORE_CATEGORIES).toHaveLength(5);
    expect(new Set(SCORE_CATEGORY_IDS).size).toBe(5);
    SCORE_CATEGORIES.forEach((c) => expect(c.label).toBeTruthy());
  });
});

describe('scores', () => {
  it('accepts only half-star values between 0.5 and 5', () => {
    expect(isValidScore(3)).toBe(true);
    expect(isValidScore(4.5)).toBe(true);
    expect(isValidScore('2.5')).toBe(true);
    expect(isValidScore(0)).toBe(false);
    expect(isValidScore(5.5)).toBe(false);
    expect(isValidScore(3.2)).toBe(false);
    expect(isValidScore(null)).toBe(false);
    expect(isValidScore('')).toBe(false);
  });

  it('snaps onto the half-star scale', () => {
    expect(toHalfStar(3.74)).toBe(3.5);
    expect(toHalfStar(3.76)).toBe(4);
    expect(toHalfStar(9)).toBe(5);
    expect(toHalfStar(0.1)).toBe(0.5);
    expect(toHalfStar(0)).toBeNull();
    expect(toHalfStar('abc')).toBeNull();
  });

  it('averages the set sub-scores and ignores the rest', () => {
    expect(computeOverall({ vendors: 5, prices: 3, venue: 4 })).toBe(4);
    expect(computeOverall({ vendors: 5, prices: 4 })).toBe(4.5);
    expect(computeOverall({ vendors: 4, prices: 'junk', bogus: 5 })).toBe(4);
    expect(computeOverall({})).toBeNull();
    expect(computeOverall(null)).toBeNull();
  });

  it('drops unknown categories and invalid values', () => {
    expect(cleanScores({ vendors: 4, bogus: 5, prices: 7, venue: '3.5' })).toEqual({ vendors: 4, venue: 3.5 });
  });
});

describe('links, gallery and pickups', () => {
  it('allows http(s) and site-relative links only', () => {
    expect(safeLink('https://cardpop.com.au/marketplace/abc')).toBe('https://cardpop.com.au/marketplace/abc');
    expect(safeLink('/shop/binders/9-pocket')).toBe('/shop/binders/9-pocket');
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('//evil.example')).toBeNull();
    expect(safeLink('   ')).toBeNull();
  });

  it('keeps only gallery entries with a usable url', () => {
    expect(cleanGallery([
      { url: 'https://x.test/a.webp', caption: ' Doors open ', alt: '' },
      { url: 'javascript:x', caption: 'bad' },
      { caption: 'no url' },
    ])).toEqual([{ url: 'https://x.test/a.webp', caption: 'Doors open', alt: null }]);
    expect(cleanGallery('nope')).toEqual([]);
  });

  it('keeps only named pickups and sanitises their fields', () => {
    expect(cleanPickups([
      { name: ' Charizard ', price_aud: '120', url: '/marketplace/1', image_url: 'javascript:x', note: '' },
      { name: '', price_aud: 5 },
      { name: 'Free promo', price_aud: 0 },
    ])).toEqual([
      { name: 'Charizard', price_aud: 120, url: '/marketplace/1', image_url: null, note: null },
      { name: 'Free promo', price_aud: 0, url: null, image_url: null, note: null },
    ]);
  });
});

describe('normalizeReview', () => {
  it('produces the row shape with the overall derived from sub-scores', () => {
    const row = normalizeReview({
      event_id: ' evt-1 ',
      scores: { vendors: 5, prices: 4, venue: 4, atmosphere: 5, value: 4 },
      go_again: 'yes',
      verdict: '  Worth the trip  ',
      ticket_paid_aud: '15',
      hours_spent: '',
      crowd_level: 'busy',
      headline_pickup: '',
      gallery: [],
      pickups: [],
      extra: 'dropped',
    });
    expect(row).toEqual({
      event_id: 'evt-1',
      attended_on: null,
      overall_rating: 4.5,
      scores: { vendors: 5, prices: 4, venue: 4, atmosphere: 5, value: 4 },
      go_again: 'yes',
      verdict: 'Worth the trip',
      ticket_paid_aud: 15,
      hours_spent: null,
      crowd_level: 'busy',
      headline_pickup: null,
      gallery: [],
      video: null,
      pickups: [],
    });
    expect(row).not.toHaveProperty('extra');
  });

  it('lets a hand-set overall win over the average', () => {
    expect(normalizeReview({ overall_rating: 3, scores: { vendors: 5, prices: 5 } }).overall_rating).toBe(3);
  });

  it('rejects unknown vocab values', () => {
    const row = normalizeReview({ go_again: 'sometimes', crowd_level: 'insane' });
    expect(row.go_again).toBeNull();
    expect(row.crowd_level).toBeNull();
  });
});

describe('publishing rules', () => {
  const body = '<p>' + 'A long enough body of text for a review. '.repeat(3) + '</p>';
  const video = { url: 'https://youtu.be/dQw4w9WgXcQ' };
  const photo = { url: 'https://x.supabase.co/storage/v1/object/public/media/event-reviews/gallery/1-a.webp' };

  it('passes a complete review', () => {
    expect(reviewPublishProblems({ article: { title: 'T', content: body }, review: { event_id: 'evt', overall_rating: 4 } })).toEqual([]);
  });

  it('publishes any one part on its own: stars, photos, video or the report', () => {
    const base = { article: { title: 'T', content: '' } };
    expect(reviewPublishProblems({ ...base, review: { event_id: 'evt', overall_rating: 4 } })).toEqual([]);
    expect(reviewPublishProblems({ ...base, review: { event_id: 'evt', gallery: [photo] } })).toEqual([]);
    expect(reviewPublishProblems({ ...base, review: { event_id: 'evt', video } })).toEqual([]);
    expect(reviewPublishProblems({ article: { title: 'T', content: body }, review: { event_id: 'evt' } })).toEqual([]);
  });

  it('names each missing piece', () => {
    const problems = reviewPublishProblems({ article: { title: '', content: '' }, review: {} });
    expect(problems).toHaveLength(3);
    expect(problems.join(' ')).toMatch(/title/);
    expect(problems.join(' ')).toMatch(/event/);
    expect(problems.join(' ')).toMatch(/star rating, photos, a video or the written report/);
  });

  it('flags a report that was started but is too short to stand on its own', () => {
    const problems = reviewPublishProblems({ article: { title: 'T', content: '<p>hi</p>' }, review: { event_id: 'evt', overall_rating: 4 } });
    expect(problems).toEqual([expect.stringMatching(/very short/)]);
  });
});

describe('review video', () => {
  const upload = 'https://x.supabase.co/storage/v1/object/public/media/event-reviews/videos/1-abc-floor.mp4';

  it('tells uploads from YouTube/Vimeo links and refuses anything else', () => {
    expect(videoKind(upload)).toBe('file');
    expect(videoKind('https://youtu.be/dQw4w9WgXcQ')).toBe('embed');
    expect(videoKind('https://vimeo.com/123456789')).toBe('embed');
    expect(videoKind('https://example.com/page')).toBeNull();
    expect(videoKind('javascript:alert(1)//.mp4')).toBeNull();
  });

  it('cleans the stored shape', () => {
    expect(cleanVideo({ url: upload, poster_url: 'javascript:x', caption: '  The floor  ', extra: 1 }))
      .toEqual({ url: upload, poster_url: null, caption: 'The floor' });
    expect(cleanVideo({ url: 'https://example.com/page' })).toBeNull();
    expect(cleanVideo(null)).toBeNull();
    expect(normalizeReview({ video: { url: upload } }).video).toEqual({ url: upload, poster_url: null, caption: null });
    expect(normalizeReview({}).video).toBeNull();
  });

  it('checks a picked file before upload', () => {
    expect(reviewVideoFileError({ type: 'video/mp4', size: 10 * 1048576, name: 'a.mp4' })).toBeNull();
    expect(reviewVideoFileError({ type: 'video/quicktime', size: 1, name: 'a.mov' })).toBeNull();
    expect(reviewVideoFileError({ type: 'image/png', size: 1, name: 'a.png' })).toMatch(/MP4, MOV or WebM/);
    expect(reviewVideoFileError({ type: 'video/mp4', size: REVIEW_VIDEO_MAX_BYTES + 1, name: 'a.mp4' })).toMatch(/YouTube/);
  });
});

describe('render guards and formatting', () => {
  it('knows when there is something to show', () => {
    expect(hasScorecard({ overall_rating: 4 })).toBe(true);
    expect(hasScorecard({ scores: { vendors: 3 } })).toBe(true);
    expect(hasScorecard({ scores: {} })).toBe(false);
    expect(hasQuickFacts({ ticket_paid_aud: 0 })).toBe(true);
    expect(hasQuickFacts({ verdict: null })).toBe(false);
  });

  it('formats money, hours and scores for Australian readers', () => {
    expect(formatAud(0)).toBe('Free');
    expect(formatAud(15)).toBe('$15');
    expect(formatAud(12.5)).toBe('$12.50');
    expect(formatAud('x')).toBeNull();
    expect(formatHours(1)).toBe('1 hour');
    expect(formatHours(3.5)).toBe('3.5 hours');
    expect(formatHours(0)).toBeNull();
    expect(formatScore(4)).toBe('4 / 5');
    expect(formatScore(4.5)).toBe('4.5 / 5');
    expect(formatScore(null)).toBeNull();
  });
});

describe('buildEventReviewJsonLd', () => {
  const article = { id: 'a1', slug: 'vault-melbourne-2026-review', title: 'Vault Melbourne 2026', excerpt: 'Big room, fair prices.', published_at: '2026-10-05T00:00:00Z' };
  const event = { id: 'e1', slug: 'vault-melbourne', title: 'Vault – Melbourne Card & Collectible Show', start_date: '2026-10-04', venue_name: 'Melbourne Showgrounds', suburb: 'Ascot Vale', state: 'VIC', postcode: '3032' };

  it('emits a Review of an Event with a rating', () => {
    const ld = buildEventReviewJsonLd({ article, review: { overall_rating: 4.5 }, event });
    expect(ld['@type']).toBe('Review');
    expect(ld.reviewRating).toEqual({ '@type': 'Rating', ratingValue: 4.5, bestRating: 5, worstRating: 1 });
    expect(ld.itemReviewed['@type']).toBe('Event');
    expect(ld.itemReviewed.url).toBe('https://cardpop.com.au/events/vault-melbourne');
    expect(ld.itemReviewed.location.address.addressRegion).toBe('VIC');
    expect(ld.url).toBe('https://cardpop.com.au/blog/vault-melbourne-2026-review');
  });

  it('returns null without a rating (Google rejects a Review with no reviewRating)', () => {
    expect(buildEventReviewJsonLd({ article, review: { overall_rating: null }, event })).toBeNull();
    expect(buildEventReviewJsonLd({ article, review: null, event })).toBeNull();
  });

  it('still reviews the article title when the event is missing', () => {
    const ld = buildEventReviewJsonLd({ article, review: { overall_rating: 3 }, event: null });
    expect(ld.itemReviewed).toEqual({ '@type': 'Event', name: 'Vault Melbourne 2026' });
  });
});
