// CardPop's WhatsApp Business chat — one place for the number and the
// click-to-chat link. Dependency-free so the SPA and api/prerender.js agree.
//
// "Chat" is WhatsApp's own click-to-chat: https://wa.me/<number>?text=<message>
// opens the conversation in the WhatsApp app (phone) or WhatsApp Web / Desktop
// (computer) with the message pre-typed — nothing is sent until the visitor
// presses send, and no third-party script is loaded on the site.

/** The business number as Australians write it. */
export const WHATSAPP_NUMBER_LOCAL = '0406 378 473';

/** The same number in E.164 digits (no "+"), the form wa.me expects. */
export const WHATSAPP_NUMBER_E164 = '61406378473';

/** Human-readable international form, for display beside the link. */
export const WHATSAPP_NUMBER_DISPLAY = '+61 406 378 473';

export const WHATSAPP_GREETING = 'Hi CardPop! I have a question.';

const SITE_ORIGIN = 'https://cardpop.com.au';

// The public sections whose address tells support what the question is about.
// An allow-list on purpose: account, admin, checkout, sign-in and every other
// page falls through to the plain greeting, so a private URL is never named.
const PAGE_CONTEXT_PREFIXES = [
  '/shop', '/product', '/marketplace', '/collections', '/category', '/seller',
  '/events', '/giveaway', '/giveaways', '/blog', '/prices', '/players',
  '/card-shops', '/grading', '/community', '/pricing', '/shipping', '/returns',
];

/**
 * The message pre-typed into the chat. On a public shopping / content page it
 * names the page the visitor is on (path only — never the query string or
 * hash, which can carry tokens), so the question arrives with its context.
 */
export function whatsappMessageForPath(pathname) {
  const path = typeof pathname === 'string' ? pathname.split(/[?#]/)[0] : '';
  const named = PAGE_CONTEXT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  return named ? `Hi CardPop! I have a question about ${SITE_ORIGIN}${path}` : WHATSAPP_GREETING;
}

/** `https://wa.me/…` click-to-chat link, optionally with a pre-typed message. */
export function whatsappChatUrl(message = WHATSAPP_GREETING) {
  const text = String(message || '').trim().slice(0, 500);
  const base = `https://wa.me/${WHATSAPP_NUMBER_E164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** The plain link, with the default greeting — for non-JS surfaces. */
export const WHATSAPP_CHAT_URL = whatsappChatUrl();
