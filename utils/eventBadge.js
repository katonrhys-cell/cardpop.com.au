// "Listed on CardPop" website badge for organisers (Account → My Events).
//
// An organiser pastes this on their own site: a followed link from a real
// event site to its CardPop page is the strongest ranking signal the events
// section can earn. Dependency-free and HTML-escaped, since the title comes
// from the organiser.

export const EVENT_BADGE_IMAGE = 'https://cardpop.com.au/badges/listed-on-cardpop.svg';
const SITE = 'https://cardpop.com.au';

const escAttr = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Absolute URL of an event's public page. */
export const eventPublicUrl = (event) => `${SITE}/events/${encodeURIComponent(event?.slug || event?.id || '')}`;

/** The copy-paste HTML snippet for one event. */
export const eventBadgeSnippet = (event) => {
  const title = event?.title ? `${event.title} on CardPop` : 'Listed on CardPop';
  return `<a href="${escAttr(eventPublicUrl(event))}" title="${escAttr(title)}">`
    + `<img src="${EVENT_BADGE_IMAGE}" alt="Listed on CardPop — Australian trading card events" width="200" height="56" style="border:0" /></a>`;
};
