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
//
// Claude Haiku 5.5 ($0.10 / $0.50 per MTok) replaces Haiku 4.5 ($1 / $5) and
// Claude Sonnet 5.5 ($2 / $10) replaces Sonnet 4.6 ($3 / $15): the current
// generation of each tier, cheaper and better at instruction following. Both
// run adaptive thinking by default, which this fixed-schema read neither needs
// nor has time for (12–15 s budgets), so each request pins the lowest thinking
// setting its model accepts: `disabled` on Haiku (allowed at effort ≤ high) and
// `between_tools` on Sonnet 5.5 (`disabled` is a 400 there). Replies are read
// by block type, never `content[0]`, so a thinking block can't swallow the JSON.
export const OCR_MODEL_FAST = 'claude-haiku-5-5';
export const OCR_MODEL_STRONG = 'claude-sonnet-5-5';

/** The thinking setting that keeps each model on the task, not on deliberation. */
export function thinkingFor(model) {
	return model === OCR_MODEL_STRONG ? { type: 'between_tools' } : { type: 'disabled' };
}

/** Joins a Messages API reply's text blocks; thinking blocks are skipped. */
export function textFromContent(content) {
	return (Array.isArray(content) ? content : [])
		.filter((block) => block?.type === 'text')
		.map((block) => block.text ?? '')
		.join('');
}

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

/**
 * Turns a provider failure into something safe to show a seller.
 *
 * The raw message must never reach the browser. Anthropic's replies carry our
 * account state — "Your credit balance is too low", key problems, rate-limit
 * details — which is both meaningless to a seller and not theirs to see. The
 * full error still goes to the logs, where it is the thing an operator needs.
 *
 * @param {Error} err
 * @returns {string} a message intended for the seller
 */
export function describeOcrFailure(err) {
	const raw = String(err?.message ?? '');

	// Billing, auth and configuration: nothing the seller can do, and none of
	// their business. Same wording for all three so the reply leaks nothing.
	if (/credit balance|billing|quota/i.test(raw)) {
		return 'Card identification is temporarily unavailable. Please fill in the details manually.';
	}
	if (/API error 40[13]|authentication|invalid x-api-key|permission/i.test(raw)) {
		return 'Card identification is temporarily unavailable. Please fill in the details manually.';
	}
	if (/API error 429|rate limit/i.test(raw)) {
		return 'Too many scans at once. Wait a moment and try again.';
	}
	if (/abort|timeout|timed out/i.test(raw)) {
		return 'That scan took too long. Try again with a single, clearer photo of the front.';
	}
	if (/API error 5\d\d|overloaded/i.test(raw)) {
		return 'The identification service is busy. Try again in a moment.';
	}
	return 'Could not read that card. Try a clearer, well-lit photo of the front.';
}

/** Tells the model how to read multiple images: first = front, rest = back/extra. */
export function buildPromptText(imageCount) {
	return imageCount > 1
		? `Analyze this trading card and extract all visible information as JSON. ${imageCount} images are provided: the first is the card front; the remaining images are the back and/or additional angles — use them to read set codes, collector numbers and copyright text.`
		: 'Analyze this trading card and extract all visible information as JSON.';
}

export async function requestOcr({ apiKey, model, system, promptText, imageBlocks, timeoutMs, onUsage }) {
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
			thinking: thinkingFor(model),
			output_config: { effort: 'low' },
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
	// Billed whether or not the reply is usable, so report it first.
	if (data.usage) await onUsage?.({ model, usage: data.usage });
	if (data.stop_reason === 'refusal') {
		throw new Error(`Anthropic API declined the request (${data.stop_details?.category || 'unknown'})`);
	}
	return textFromContent(data.content);
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
/**
 * `onUsage({ model, usage, escalation })` is called after each billed call
 * (src/utils/aiUsage.js records it).
 */
export async function runCardOcr({ apiKey, imageBlocks, log = () => {}, onUsage }) {
	const ocrArgs = {
		apiKey,
		system: CardOCRPrompt,
		promptText: buildPromptText(imageBlocks.length),
		imageBlocks,
	};

	let content = await requestOcr({
		...ocrArgs, model: OCR_MODEL_FAST, timeoutMs: OCR_TIMEOUT_FAST,
		onUsage: (u) => onUsage?.({ ...u, escalation: false }),
	});

	// Quality-gated escalation: only pay for the stronger model when the fast
	// one left out something the rest of the pipeline depends on.
	const reason = escalationReason(parseOcrJson(content));
	if (!reason) return { content, escalated: false, reason: null };

	log(`Escalating to ${OCR_MODEL_STRONG}: ${reason}`);
	try {
		const stronger = await requestOcr({
			...ocrArgs, model: OCR_MODEL_STRONG, timeoutMs: OCR_TIMEOUT_STRONG,
			onUsage: (u) => onUsage?.({ ...u, escalation: true }),
		});
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
