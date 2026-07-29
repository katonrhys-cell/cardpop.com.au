/**
 * The OCR pass: one call to a cheap model, escalated to a stronger one when the
 * read is missing something the rest of the pipeline depends on.
 *
 * Lives here rather than inside the scan route so the scoring harness
 * (`scripts/score-card-identification.mjs`) runs the real model choice, prompt
 * and escalation policy instead of a copy that can drift from them.
 */

import { CardOCRPrompt } from '../constants/prompts.js';
import { mapCollectionType } from '../../utils/ocrResult.js';

// Cheap model handles most scans; escalate to the stronger model only when the
// cheap one left something out — keeps cost low while lifting accuracy on hard cards.
export const OCR_MODEL_FAST = 'claude-haiku-4-5-20251001';
export const OCR_MODEL_STRONG = 'claude-sonnet-4-6';

// Per-call timeouts are tightened so a fast call + an escalation still fit
// inside the serverless function budget (see vercel.json maxDuration).
const OCR_TIMEOUT_FAST = 12_000;
const OCR_TIMEOUT_STRONG = 15_000;

/** Pulls the JSON object out of a model reply. Returns null when unreadable. */
export function parseOcrJson(content) {
	try {
		const match = String(content ?? '').match(/\{[\s\S]*\}/);
		return match ? JSON.parse(match[0]) : null;
	} catch {
		return null;
	}
}

/**
 * Whether the fast model's read warrants a second pass with the stronger one,
 * and why. Returns null to accept the fast result.
 *
 * The test is about the fields the rest of the pipeline actually depends on,
 * not the model's opinion of itself. Self-reported confidence is a weak signal
 * and it used to be almost the only one — a read could come back with no
 * category, no set and no collector number and still be accepted, because it
 * had a name and said "medium".
 *
 * @param {object|null} data - parsed OCR JSON
 * @returns {string|null} short reason code, or null when the result is usable
 */
export function escalationReason(data) {
	if (!data) return 'unparseable';
	if (!data.name) return 'no-name';

	// collectionType chooses the CardSight segment. Without it the identify
	// call falls back to a ten-segment fan-out that ranks guesses from every
	// sport against each other — the single worst input we can hand it.
	//
	// Test the MAPPED value, not the raw string. A model answering "Basketball"
	// looks like a category here but maps to nothing downstream, so checking the
	// raw field let exactly the case this guard exists for slip through.
	if (!mapCollectionType(data.collectionType)) return 'no-category';

	if (String(data.confidence ?? '').toLowerCase() === 'low') return 'low-confidence';

	// The prompt tells the model to shortlist sets rather than guess one with
	// false confidence, so a non-empty shortlist is it saying "I'm not sure".
	if (Array.isArray(data.candidateSets) && data.candidateSets.length > 0) return 'uncertain-set';

	// Neither of the two fields the catalogue lookup can corroborate against.
	if (!data.cardNumber && !data.cardSetName) return 'no-identity';

	return null;
}

/** Tells the model how to read multiple images: first = front, rest = back/extra. */
export function buildPromptText(imageCount) {
	return imageCount > 1
		? `Analyze this trading card and extract all visible information as JSON. ${imageCount} images are provided: the first is the card front; the remaining images are the back and/or additional angles — use them to read set codes, collector numbers and copyright text.`
		: 'Analyze this trading card and extract all visible information as JSON.';
}

export async function requestOcr({ apiKey, model, system, promptText, imageBlocks, timeoutMs }) {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model,
			// Headroom over the ~15-field schema: `description` and `candidateSets`
			// are open-ended, and a truncated reply reads as unparseable JSON —
			// which costs a wasted escalation before failing.
			max_tokens: 1500,
			system,
			messages: [{
				role: 'user',
				content: [
					{ type: 'text', text: promptText },
					...imageBlocks,
				],
			}],
		}),
		signal: AbortSignal.timeout(timeoutMs),
	});

	if (!res.ok) {
		const errBody = await res.text().catch(() => '');
		throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
	}

	const data = await res.json();
	return data.content?.[0]?.text ?? '';
}

/**
 * Runs the fast pass and, when warranted, the strong one.
 *
 * @param {object} args
 * @param {string} args.apiKey
 * @param {Array<{type: string, source: object}>} args.imageBlocks - Anthropic image blocks
 * @param {(msg: string) => void} [args.log]
 * @returns {Promise<{ content: string, escalated: boolean, reason: string|null }>}
 */
export async function runCardOcr({ apiKey, imageBlocks, log = () => {} }) {
	const ocrArgs = {
		apiKey,
		system: CardOCRPrompt,
		promptText: buildPromptText(imageBlocks.length),
		imageBlocks,
	};

	let content = await requestOcr({ ...ocrArgs, model: OCR_MODEL_FAST, timeoutMs: OCR_TIMEOUT_FAST });

	// Quality-gated escalation: only pay for the stronger model when the fast
	// one left out something the rest of the pipeline depends on.
	const reason = escalationReason(parseOcrJson(content));
	if (!reason) return { content, escalated: false, reason: null };

	log(`Escalating to ${OCR_MODEL_STRONG}: ${reason}`);
	try {
		const stronger = await requestOcr({ ...ocrArgs, model: OCR_MODEL_STRONG, timeoutMs: OCR_TIMEOUT_STRONG });
		// Only take the escalation when it actually read a card — a flaky or
		// truncated second call must not replace a usable first one.
		if (parseOcrJson(stronger)?.name) return { content: stronger, escalated: true, reason };
		log('Escalation returned no usable read — keeping fast result');
	} catch (err) {
		// Keep the fast result rather than failing the whole scan.
		log(`Escalation failed, using fast result: ${err.message}`);
	}
	return { content, escalated: false, reason };
}

/** Builds Anthropic image blocks from uploaded files or raw buffers. */
export function toImageBlocks(files) {
	return files.map(file => ({
		type: 'image',
		source: {
			type: 'base64',
			media_type: file.mimetype,
			data: file.buffer.toString('base64'),
		},
	}));
}
