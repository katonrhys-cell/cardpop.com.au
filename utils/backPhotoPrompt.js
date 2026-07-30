/**
 * Deciding when to ask a seller for a photo of the card's back.
 *
 * This exists because of a measurement, not a hunch. Running the scoring
 * harness (scripts/score-card-identification.mjs) over the real fixtures,
 * every missing `year` and `cardNumber` came from a front-only fixture, and
 * both fixtures that included a back photo got both fields right. The set
 * code, the collector number and the copyright year are routinely printed on
 * the back and simply absent from the front, so no amount of prompt work
 * recovers them from one photo — the information isn't in the image.
 *
 * The prompt is deliberately narrow. A hint shown on every scan is furniture
 * that sellers learn to ignore; one that appears only when a specific, known
 * -recoverable field is actually missing is a request they can act on.
 */

// Only the fields a back photo plausibly recovers. Deliberately not `name` or
// `setName` — those read off the front, so a back photo is not the fix, and
// asking for one would send the seller after the wrong thing.
const RECOVERABLE = [
	{ key: 'releaseYear', label: 'year' },
	{ key: 'cardNumber', label: 'card number' },
];

/**
 * The recoverable identity fields this read failed to fill.
 *
 * @param {object|null|undefined} scanResult - a mapOCRResult shape
 * @returns {string[]} human labels, e.g. ['year', 'card number']
 */
export function missingBackFields(scanResult) {
	if (!scanResult) return [];
	return RECOVERABLE
		.filter(({ key }) => !String(scanResult[key] ?? '').trim())
		.map(({ label }) => label);
}

/**
 * Whether to ask for a back photo after an identification.
 *
 * @param {object} args
 * @param {object|null} args.scanResult      - the read, or null if none ran
 * @param {number} args.analysedImageCount   - images actually sent to the model
 * @returns {boolean}
 */
export function shouldPromptForBack({ scanResult, analysedImageCount }) {
	// Nothing to say before a read, and a failed read shows its own error.
	if (!scanResult) return false;
	// A back was already sent and the field is still missing, so the back is not
	// the missing ingredient — repeating the ask would just be wrong.
	if (Number(analysedImageCount) > 1) return false;
	return missingBackFields(scanResult).length > 0;
}

/**
 * The sentence to show. Names the fields that are actually missing so the ask
 * is concrete ("the year") rather than generic ("more photos").
 *
 * @param {string[]} fields - from missingBackFields
 * @returns {string}
 */
export function backPhotoPromptText(fields) {
	if (!fields?.length) return '';
	const list = fields.length === 1 ? fields[0] : `${fields.slice(0, -1).join(', ')} and ${fields.at(-1)}`;
	return `Add a photo of the back to fill in the ${list} — it's usually printed there, not on the front.`;
}
