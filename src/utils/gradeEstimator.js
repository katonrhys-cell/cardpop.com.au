/**
 * The grade-estimate pass: one Claude vision call that scores centering,
 * corners, edges and surface from the seller's photos and maps the condition
 * onto each grading company's scale.
 *
 * Talks to the Anthropic API directly, like the OCR pass in cardOcr.js. The
 * route used to go through the Hostinger-era "integrated AI" proxy
 * (INTEGRATED_AI_API_URL), which has no value in this deployment — so every
 * estimate was sent to an `undefined` host and surfaced as a bare 500.
 */

import { GradeEstimatorPrompt } from '../constants/prompts.js';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';

// Grading needs to see corner whitening and surface scratches, so this is the
// stronger model rather than the cheap one the OCR pass starts with.
export const GRADE_MODEL = 'claude-sonnet-4-6';

/** Pulls the JSON object out of a model reply. Returns null when unreadable. */
export function parseGradeJson(content) {
	try {
		const match = String(content ?? '').match(/\{[\s\S]*\}/);
		return match ? JSON.parse(match[0]) : null;
	} catch {
		return null;
	}
}

/** Tells the model which photo is which. */
export function buildGradePromptText(imageCount) {
	return imageCount > 1
		? 'Analyse this trading card and estimate its grade for every grading company in the schema. Two images are provided: the first is the card front, the second is the card back. Return only JSON.'
		: 'Analyse this trading card and estimate its grade for every grading company in the schema. Only the card front is provided — note in imageQualityNote that the back could not be assessed. Return only JSON.';
}

/**
 * Turns a provider failure into something safe to show a member.
 *
 * The raw message must never reach the browser: Anthropic's replies carry our
 * account state (credit balance, key problems, rate-limit details). The full
 * error still goes to the logs, where an operator needs it.
 *
 * @param {Error} err
 * @returns {string}
 */
export function describeGradeFailure(err) {
	const raw = String(err?.message ?? '');

	if (/credit balance|billing|quota/i.test(raw)) {
		return 'The grade estimator is temporarily unavailable. Please try again later.';
	}
	if (/API error 40[13]|authentication|invalid x-api-key|permission/i.test(raw)) {
		return 'The grade estimator is temporarily unavailable. Please try again later.';
	}
	if (/API error 429|rate limit/i.test(raw)) {
		return 'Too many estimates at once. Wait a moment and try again.';
	}
	if (/abort|timeout|timed out/i.test(raw)) {
		return 'That estimate took too long. Try again with smaller, clearer photos.';
	}
	if (/API error 5\d\d|overloaded/i.test(raw)) {
		return 'The grade estimator is busy. Try again in a moment.';
	}
	return 'Could not assess that card. Try clearer, well-lit photos of the front and back.';
}

/**
 * One call to the model; returns the raw reply text.
 *
 * @param {object} args
 * @param {string} args.apiKey
 * @param {Array<{type: string, source: object}>} args.imageBlocks - Anthropic image blocks (front first)
 * @returns {Promise<string>}
 */
export async function requestGradeEstimate({ apiKey, imageBlocks }) {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model: GRADE_MODEL,
			// Six grader blocks with notes plus four assessments: a truncated
			// reply reads as unparseable JSON, so leave headroom.
			max_tokens: 3000,
			system: GradeEstimatorPrompt,
			messages: [{
				role: 'user',
				content: [
					{ type: 'text', text: buildGradePromptText(imageBlocks.length) },
					...imageBlocks,
				],
			}],
		}),
		signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.anthropicGrade),
	});

	if (!res.ok) {
		const errBody = await res.text().catch(() => '');
		throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
	}

	const data = await res.json();
	return data.content?.[0]?.text ?? '';
}

/**
 * Runs the estimate and checks the reply carries the grades the page renders.
 *
 * @param {object} args
 * @param {string} args.apiKey
 * @param {Array<{type: string, source: object}>} args.imageBlocks
 * @returns {Promise<{ content: string, data: object }>}
 */
export async function runGradeEstimate({ apiKey, imageBlocks }) {
	const content = await requestGradeEstimate({ apiKey, imageBlocks });
	const data = parseGradeJson(content);
	if (!data?.grades || typeof data.grades !== 'object') {
		throw new Error('Grade estimate reply carried no grades object');
	}
	return { content, data };
}
