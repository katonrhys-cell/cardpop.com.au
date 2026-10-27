// Event reviews — the shared, dependency-free rules for an admin's first-hand
// review of a card show or TCG event.
//
// A review is a blog article (category `event-reviews`) plus an `event_reviews`
// row holding the structured parts: the star scorecard, the quick-facts panel,
// the photo gallery, the video and the pickups list. This module is the single source of
// truth for the scorecard categories, the quick-fact vocabularies, the
// overall-score arithmetic, the shape a row must have before it is saved, and
// the Review JSON-LD — so the admin editor, the article page, the event page
// teaser and api/prerender.js all agree. Keep it free of React and Supabase
// imports: the prerenderer runs it in a bare Node function.
// See docs/event-reviews.md.

import { parseVideoUrl } from './videoEmbed.js';

// The five things a show gets marked on. `id` is the key inside
// event_reviews.scores; `label` is what readers see; `hint` prompts the admin.
export const SCORE_CATEGORIES = [
  { id: 'vendors',    label: 'Vendors & stock',      hint: 'How many tables, how deep the stock, variety across games and sports' },
  { id: 'prices',     label: 'Prices',               hint: 'Were asking prices fair against market? Any room to deal?' },
  { id: 'venue',      label: 'Venue & organisation', hint: 'Space, queues, signage, parking, staff, how smoothly the day ran' },
  { id: 'atmosphere', label: 'Atmosphere',           hint: 'Crowd energy, trading culture, how welcoming it felt' },
  { id: 'value',      label: 'Value for money',      hint: 'Was the entry fee and the trip worth it?' },
];

export const SCORE_CATEGORY_IDS = SCORE_CATEGORIES.map((c) => c.id);

export const CROWD_LEVELS = [
  { id: 'quiet',  label: 'Quiet',  desc: 'Room to browse every table' },
  { id: 'steady', label: 'Steady', desc: 'Busy but easy to move around' },
  { id: 'busy',   label: 'Busy',   desc: 'Queues at the popular tables' },
  { id: 'packed', label: 'Packed', desc: 'Shoulder to shoulder' },
];

export const GO_AGAIN_OPTIONS = [
  { id: 'yes',   label: 'Yes',   desc: "We'd be back next time" },
  { id: 'maybe', label: 'Maybe', desc: 'Depends on the line-up' },
  { id: 'no',    label: 'No',    desc: "Wouldn't make the trip again" },
];

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const CROWD_LEVEL_MAP = byId(CROWD_LEVELS);
export const GO_AGAIN_MAP = byId(GO_AGAIN_OPTIONS);
export const SCORE_CATEGORY_MAP = byId(SCORE_CATEGORIES);

// Stars are given in half steps between 0.5 and 5. Anything else is "unset".
export const isValidScore = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0.5 && n <= 5 && Math.round(n * 2) === n * 2;
};

// Snap any number onto the half-star scale (or null when it isn't a score).
export const toHalfStar = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const snapped = Math.round(n * 2) / 2;
  return Math.min(5, Math.max(0.5, snapped));
};

// Average of the sub-scores that are set, snapped to a half star. Null when
// none are set, so the editor can tell "no scores yet" from "scored 0".
export const computeOverall = (scores) => {
  if (!scores || typeof scores !== 'object') return null;
  const values = SCORE_CATEGORY_IDS.map((id) => scores[id]).filter(isValidScore).map(Number);
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return toHalfStar(mean);
};

// Only known categories, only valid half-star values.
export const cleanScores = (scores) => {
  const out = {};
  if (!scores || typeof scores !== 'object') return out;
  for (const id of SCORE_CATEGORY_IDS) {
    if (isValidScore(scores[id])) out[id] = Number(scores[id]);
  }
  return out;
};

const trimOrNull = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const numberOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Only http(s) URLs or site-relative paths may be stored as links — a
// `javascript:` URL pasted into a pickup link must never reach an <a href>.
export const safeLink = (v) => {
  const s = trimOrNull(v);
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

export const cleanGallery = (gallery) => {
  if (!Array.isArray(gallery)) return [];
  return gallery
    .map((g) => ({
      url: safeLink(g?.url),
      caption: trimOrNull(g?.caption),
      alt: trimOrNull(g?.alt),
    }))
    .filter((g) => g.url);
};

export const cleanPickups = (pickups) => {
  if (!Array.isArray(pickups)) return [];
  return pickups
    .map((p) => ({
      name: trimOrNull(p?.name),
      price_aud: numberOrNull(p?.price_aud),
      url: safeLink(p?.url),
      image_url: safeLink(p?.image_url),
      note: trimOrNull(p?.note),
    }))
    .filter((p) => p.name);
};

// The review video: an upload to the media bucket (played in a <video>) or a
// YouTube / Vimeo link (embedded). The bucket caps an object at 50 MB, so a
// longer clip goes up as a link.
export const REVIEW_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const REVIEW_VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
const VIDEO_FILE_RE = /\.(mp4|webm|mov|m4v)$/i;

// 'file' | 'embed' | null for a stored video URL.
export const videoKind = (url) => {
  const safe = safeLink(url);
  if (!safe) return null;
  if (parseVideoUrl(safe)) return 'embed';
  let path = safe;
  try { path = new URL(safe, 'https://cardpop.com.au').pathname; } catch { /* keep raw */ }
  return VIDEO_FILE_RE.test(path) ? 'file' : null;
};

// Picked File → error message, or null when it can be uploaded.
export const reviewVideoFileError = (file) => {
  if (!file) return 'No video selected.';
  const typeOk = /^video\/(mp4|webm|quicktime)$/i.test(file.type) || (!file.type && VIDEO_FILE_RE.test(file.name || ''));
  if (!typeOk) return 'Video must be an MP4, MOV or WebM file.';
  if (file.size > REVIEW_VIDEO_MAX_BYTES) {
    return `Video must be under ${Math.round(REVIEW_VIDEO_MAX_BYTES / 1048576)} MB — upload it to YouTube and paste the link instead.`;
  }
  return null;
};

// { url, poster_url, caption } or null. Anything that isn't a playable upload
// or a supported YouTube/Vimeo link is dropped.
export const cleanVideo = (video) => {
  if (!video || typeof video !== 'object') return null;
  const url = safeLink(video.url);
  if (!url || !videoKind(url)) return null;
  return {
    url,
    poster_url: safeLink(video.poster_url),
    caption: trimOrNull(video.caption),
  };
};

// Plain text of the report body, for "has the admin written anything?".
const reportText = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export const REPORT_MIN_CHARS = 40;
export const hasReport = (html) => reportText(html).length >= REPORT_MIN_CHARS;

// Empty form state for the editor.
export const emptyReview = () => ({
  event_id: null,
  attended_on: null,
  overall_rating: null,
  scores: {},
  go_again: null,
  verdict: '',
  ticket_paid_aud: '',
  hours_spent: '',
  crowd_level: null,
  headline_pickup: '',
  gallery: [],
  video: null,
  pickups: [],
});

// Form state → the exact row written to event_reviews. Unknown keys dropped,
// strings trimmed, blanks nulled, scores validated, links sanitised. The
// overall falls back to the average of the sub-scores when not set by hand.
export const normalizeReview = (input = {}) => {
  const scores = cleanScores(input.scores);
  const overall = isValidScore(input.overall_rating)
    ? Number(input.overall_rating)
    : computeOverall(scores);
  return {
    event_id: trimOrNull(input.event_id),
    attended_on: trimOrNull(input.attended_on),
    overall_rating: overall,
    scores,
    go_again: GO_AGAIN_MAP[input.go_again] ? input.go_again : null,
    verdict: trimOrNull(input.verdict),
    ticket_paid_aud: numberOrNull(input.ticket_paid_aud),
    hours_spent: numberOrNull(input.hours_spent),
    crowd_level: CROWD_LEVEL_MAP[input.crowd_level] ? input.crowd_level : null,
    headline_pickup: trimOrNull(input.headline_pickup),
    gallery: cleanGallery(input.gallery),
    video: cleanVideo(input.video),
    pickups: cleanPickups(input.pickups),
  };
};

// What must be true before a review can be published. Drafts may be saved with
// anything. The star rating, the photos, the video and the written report are
// each optional on their own — a review can be just a rating, just a gallery,
// just a video or just the report — but it has to carry at least one of them.
export const reviewPublishProblems = ({ article = {}, review = {} } = {}) => {
  const problems = [];
  if (!trimOrNull(article.title)) problems.push('Give the review a title.');
  if (!review.event_id) problems.push('Pick the event this review is about.');
  const text = reportText(article.content);
  if (text.length > 0 && text.length < REPORT_MIN_CHARS) {
    problems.push('The report is very short — write a few sentences, or clear it to publish without one.');
  }
  const hasSomething =
    isValidScore(review.overall_rating) ||
    cleanGallery(review.gallery).length > 0 ||
    Boolean(cleanVideo(review.video)) ||
    text.length >= REPORT_MIN_CHARS;
  if (!hasSomething) problems.push('Add at least one of: a star rating, photos, a video or the written report.');
  return problems;
};

// A review has "structured" content worth rendering when any of these are set.
export const hasScorecard = (review) =>
  Boolean(review && (isValidScore(review.overall_rating) || Object.keys(cleanScores(review.scores)).length));

export const hasQuickFacts = (review) =>
  Boolean(review && (
    review.attended_on || review.go_again || review.verdict || review.crowd_level ||
    review.ticket_paid_aud != null || review.hours_spent != null || review.headline_pickup
  ));

export const formatAud = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return 'Free';
  const whole = Number.isInteger(n);
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
};

export const formatHours = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? 'hour' : 'hours'}`;
};

// One line for the stars, e.g. "4.5 / 5".
export const formatScore = (v) => (isValidScore(v) ? `${Number(v).toFixed(1).replace(/\.0$/, '')} / 5` : null);

// schema.org Review for the article page / prerender. `article` is the
// blog_articles row, `review` the event_reviews row, `event` the events row (any
// may be partial). Returns null when there's no rating to report — Google
// rejects a Review node without a reviewRating.
export const buildEventReviewJsonLd = ({ article, review, event, siteUrl = 'https://cardpop.com.au' } = {}) => {
  if (!article || !review || !isValidScore(review.overall_rating)) return null;
  const eventUrl = event ? `${siteUrl}/events/${event.slug || event.id}` : null;
  const location = event && (event.venue_name || event.suburb || event.state)
    ? {
        '@type': 'Place',
        name: event.venue_name || [event.suburb, event.state].filter(Boolean).join(', '),
        address: {
          '@type': 'PostalAddress',
          ...(event.address ? { streetAddress: event.address } : {}),
          ...(event.suburb ? { addressLocality: event.suburb } : {}),
          ...(event.state ? { addressRegion: event.state } : {}),
          ...(event.postcode ? { postalCode: event.postcode } : {}),
          addressCountry: 'AU',
        },
      }
    : null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: article.title,
    ...(article.excerpt ? { reviewBody: article.excerpt } : {}),
    url: `${siteUrl}/blog/${article.slug || article.id}`,
    author: { '@type': 'Organization', name: 'CardPop', url: siteUrl },
    publisher: { '@type': 'Organization', name: 'CardPop', url: siteUrl },
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: Number(review.overall_rating),
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: {
      '@type': 'Event',
      name: event?.title || article.title,
      ...(eventUrl ? { url: eventUrl } : {}),
      ...(event?.start_date ? { startDate: event.start_date } : {}),
      ...(event?.image_url ? { image: event.image_url } : {}),
      ...(location ? { location } : {}),
    },
  };
};
