// Event prizes (events.event_prizes + events.prize_pool). The prize table for
// a tournament-style event — "1st Place: $1,500 USD, 4 Gold Foil Blossom of
// Spring and a Pro Tour Invitation" — with photos of the cards that can be
// won (or were won). Shown above the event videos. Dependency-free so the
// event form, the event page and api/prerender.js read the same shape.
//
// Stored shape: [{ place, reward, images: [url, …] }] in display order (put
// 1st place first), plus a free-text headline total in `prize_pool`.

import { safeImageUrl } from './eventGallery.js';

export const MAX_EVENT_PRIZES = 24;
export const MAX_PRIZE_PHOTOS = 6; // per prize
export const MAX_PRIZE_PLACE_CHARS = 40;
export const MAX_PRIZE_REWARD_CHARS = 300;
export const MAX_PRIZE_POOL_CHARS = 200;

const trimOrEmpty = (v) => (typeof v === 'string' ? v.trim() : '');

export const emptyPrize = () => ({ place: '', reward: '', photos: [] });

/**
 * Normalise whatever the DB (or the form) holds into display prizes: a prize
 * needs a place or a reward (a photo alone is not a prize), unsafe image URLs
 * are dropped, text is trimmed and capped. Returns [{ place, reward, images }].
 */
export const cleanEventPrizes = (prizes) => (Array.isArray(prizes) ? prizes : [])
  .map((p) => ({
    place: trimOrEmpty(p?.place).slice(0, MAX_PRIZE_PLACE_CHARS),
    reward: trimOrEmpty(p?.reward).slice(0, MAX_PRIZE_REWARD_CHARS),
    images: (Array.isArray(p?.images) ? p.images : []).map(safeImageUrl).filter(Boolean).slice(0, MAX_PRIZE_PHOTOS),
  }))
  .filter((p) => p.place || p.reward)
  .slice(0, MAX_EVENT_PRIZES);

export const cleanPrizePool = (v) => trimOrEmpty(v).slice(0, MAX_PRIZE_POOL_CHARS);

/** Whether there is anything to show in the Prizes section. */
export const hasPrizes = (prizes, prizePool) => cleanEventPrizes(prizes).length > 0 || Boolean(cleanPrizePool(prizePool));

/** Every prize photo in display order. */
export const prizeImageUrls = (prizes) => cleanEventPrizes(prizes).flatMap((p) => p.images);
