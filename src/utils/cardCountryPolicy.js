// Which countries a buyer's payment method may be issued in.
//
// CardPop sells to Australia only. The shipping address is already gated at
// checkout (checkAustralianAddress in addressValidation.js), but that alone
// doesn't stop an overseas buyer paying with a foreign card and shipping to an
// Australian address or forwarder — and a foreign card also costs 3.5% rather
// than 1.75%.
//
// The country of a card is only knowable from its BIN, which Stripe resolves
// when the payment is authorised — i.e. AFTER the money is captured, since
// Checkout captures on completion. So this is enforced in the webhook by
// refusing to fulfil and refunding in full, not by blocking at checkout.
//
// The cheaper front line is a Stripe Radar rule (`Block if :card_country: !=
// 'AU'`), which declines before capture and costs nothing. That's a dashboard
// step; this is the backstop that holds whether or not it is in place.

const DEFAULT_ALLOWED = ['AU'];

/** @returns {string[]} uppercase ISO-3166 alpha-2 codes */
export function allowedCardCountries() {
  const raw = process.env.ALLOWED_CARD_COUNTRIES;
  if (typeof raw !== 'string' || raw.trim() === '') return [...DEFAULT_ALLOWED];

  // 'any' switches the check off entirely — for opening up to international
  // buyers later without a deploy.
  const list = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (list.length === 1 && list[0] === 'ANY') return [];
  return list.length > 0 ? list : [...DEFAULT_ALLOWED];
}

/**
 * Is a payment from this card country allowed?
 *
 * An UNKNOWN country is allowed. Stripe only reports a country for methods that
 * have one — PayPal, wallets and some local methods may report none — and
 * refusing those would refund perfectly good domestic payments for the sake of
 * a field Stripe never populated. The check only ever fires on a country we
 * positively know is outside the list.
 *
 * @param {string|null|undefined} country ISO-3166 alpha-2, as Stripe reports it
 */
export function isCardCountryAllowed(country) {
  const allowed = allowedCardCountries();
  if (allowed.length === 0) return true; // check disabled

  const code = String(country ?? '').trim().toUpperCase();
  if (!code) return true; // unknown — see above

  return allowed.includes(code);
}

export { DEFAULT_ALLOWED };
