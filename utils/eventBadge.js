// "Listed on CardPop" website badge for organisers (Account → My Events).
//
// An organiser pastes this on their own site: a followed link from a real
// event site to its CardPop page is the strongest ranking signal the events
// section can earn. Built on the shared badge helpers in utils/websiteBadge.js.

import { SITE, BADGES, badgeSnippet } from './websiteBadge.js';

export const EVENT_BADGE_IMAGE = `${SITE}${BADGES.event.path}`;

/** Absolute URL of an event's public page. */
export const eventPublicUrl = (event) => `${SITE}/events/${encodeURIComponent(event?.slug || event?.id || '')}`;

/** The copy-paste HTML snippet for one event. */
export const eventBadgeSnippet = (event) => badgeSnippet(
  'event',
  eventPublicUrl(event),
  event?.title ? `${event.title} on CardPop` : 'Listed on CardPop',
);
