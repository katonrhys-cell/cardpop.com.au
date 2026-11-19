// Which cart lines a checkout is actually paying for.
//
// A mixed cart can pay for its shop lines alone ("Check out the shop item
// now") while its marketplace cards wait for sign-in or ID verification — the
// checkout page promises those cards "stay in your cart". The confirmation
// page used to empty the whole cart on any paid order, so the card the buyer
// meant to come back for was gone. The payment step records the keys of the
// lines it submitted here; the confirmation page removes exactly those.
//
// sessionStorage, because the Stripe return lands in the same tab. Every read
// and write is guarded: private windows and blocked site data throw.

const KEY = 'cardpop:checkout:paid-lines';

/** The cart's own key for a line — the same one useCart's removeFromCart takes. */
export const cartLineKey = (item) => item?.variant?.id || item?.product?.id || null;

export function rememberPaidLines(items) {
  try {
    const keys = (items || []).map(cartLineKey).filter(Boolean);
    window.sessionStorage.setItem(KEY, JSON.stringify(keys));
  } catch { /* storage unavailable — the confirmation page falls back to clearing the cart */ }
}

/** The recorded keys (and forget them), or null when nothing usable was recorded. */
export function takePaidLines() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    const keys = raw ? JSON.parse(raw) : null;
    return Array.isArray(keys) && keys.length > 0 && keys.every((k) => typeof k === 'string') ? keys : null;
  } catch {
    return null;
  }
}

// The confirmation page settles the cart once per payment. takePaidLines()
// forgets its record on the first read, so a reload, a restored phone tab or
// Back to the page fell through to "no record → empty the cart" and wiped the
// cards a shop-only checkout had kept, and anything added since.
const HANDLED_KEY = 'cardpop:checkout:handled-sessions';

/** True the first time a Stripe session id is seen in this tab; false after. */
export function claimCheckoutSession(sessionId) {
  if (!sessionId) return true;
  try {
    const raw = window.sessionStorage.getItem(HANDLED_KEY);
    const seen = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(seen) ? seen : [];
    if (list.includes(sessionId)) return false;
    window.sessionStorage.setItem(HANDLED_KEY, JSON.stringify([...list, sessionId].slice(-20)));
    return true;
  } catch {
    return true; // storage unavailable: behave as before
  }
}
