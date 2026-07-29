/**
 * Collector-number parsing, shared by the catalogue route and the OCR bridge.
 *
 * The collector number is the most discriminating thing printed on a trading
 * card — a name alone can match hundreds of printings, but "4/102" pins down
 * one. Both the server-side catalogue query and the client-side match check
 * depend on reading it the same way, so the logic lives in one place.
 *
 * Printed forms vary: "4/102", "004/102", "SWSH114", "TG12/TG30", "#25".
 */

/** Strips punctuation, leading zeros and case from one part of a number. */
function clean(part) {
  return String(part ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .replace(/^0+(?=\w)/, '')
    .toLowerCase();
}

/**
 * Splits a printed number into its own value and the set total after the slash.
 * "004/102" → { value: '4', total: '102' }; "SWSH114" → { value: 'swsh114', total: '' }
 *
 * @param {string|number|null|undefined} printed
 * @returns {{ value: string, total: string }}
 */
export function parseCardNumber(printed) {
  const [value, total = ''] = String(printed ?? '').split('/');
  return { value: clean(value), total: clean(total) };
}

/**
 * The card's own number, without the "/total" suffix — what catalogue APIs
 * store and what their number filters expect. Empty string when unreadable.
 *
 * @param {string|number|null|undefined} printed
 * @returns {string}
 */
export function leadingCardNumber(printed) {
  return parseCardNumber(printed).value;
}

/**
 * Whether two printed numbers refer to the same card.
 *
 * Both totals are compared when both are present: "4/102" and "4/165" are
 * different cards from different sets, and treating them as equal (as a
 * leading-digits-only comparison does) lets a candidate from the wrong set
 * corroborate a match it has nothing to do with.
 *
 * @returns {boolean} false when either number is unreadable — unknown is not a match
 */
export function cardNumbersMatch(a, b) {
  const pa = parseCardNumber(a);
  const pb = parseCardNumber(b);
  if (!pa.value || !pb.value) return false;
  if (pa.value !== pb.value) return false;
  if (pa.total && pb.total && pa.total !== pb.total) return false;
  return true;
}

/**
 * Whether two printed numbers positively disagree. Distinct from
 * `!cardNumbersMatch`: an unreadable number is unknown, not a conflict, and
 * must not disqualify an otherwise good candidate.
 *
 * @returns {boolean}
 */
export function cardNumbersConflict(a, b) {
  const pa = parseCardNumber(a);
  const pb = parseCardNumber(b);
  if (!pa.value || !pb.value) return false;
  return !cardNumbersMatch(a, b);
}
