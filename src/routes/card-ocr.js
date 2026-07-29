import process from 'node:process';
import { Router } from 'express';
import { CardOCRPrompt } from '../constants/prompts.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(supabaseAuth);

const requireAuth = (req, res, next) => {
	if (!req.userId) {
		return res.status(401).json({ error: 'Authentication required' });
	}
	next();
};

function sseWrite(res, type, content) {
	res.write(`data: ${JSON.stringify({ type, data: { content } })}\n\n`);
}

// Cheap model handles most scans; escalate to the stronger model only when the
// cheap one is unsure — keeps cost low while lifting accuracy on hard cards.
const OCR_MODEL_FAST = 'claude-haiku-4-5-20251001';
const OCR_MODEL_STRONG = 'claude-sonnet-4-6';

// Per-call timeouts are tightened so a fast call + an escalation still fit
// inside the 30s serverless function budget (see vercel.json maxDuration).
const OCR_TIMEOUT_FAST = 12_000;
const OCR_TIMEOUT_STRONG = 15_000;

async function requestOcr({ apiKey, model, system, promptText, imageBlocks, timeoutMs }) {
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
			// which now costs a wasted escalation before failing.
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

/** Pulls the JSON object out of a model reply. Returns null when unreadable. */
function parseOcrJson(content) {
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
function escalationReason(data) {
	if (!data) return 'unparseable';
	if (!data.name) return 'no-name';

	// collectionType chooses the CardSight segment. Without it the identify
	// call falls back to a ten-segment fan-out that ranks guesses from every
	// sport against each other — the single worst input we can hand it.
	if (!data.collectionType) return 'no-category';

	if (String(data.confidence ?? '').toLowerCase() === 'low') return 'low-confidence';

	// The prompt tells the model to shortlist sets rather than guess one with
	// false confidence, so a non-empty shortlist is it saying "I'm not sure".
	if (Array.isArray(data.candidateSets) && data.candidateSets.length > 0) return 'uncertain-set';

	// Neither of the two fields the catalogue lookup can corroborate against.
	if (!data.cardNumber && !data.cardSetName) return 'no-identity';

	return null;
}

router.post('/scan', integratedAiRateLimit, requireAuth, uploadFiles({
	allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	fieldName: 'images',
}), async (req, res) => {
	if (!req.files?.length) {
		return res.status(400).json({ error: 'An image is required for card scanning' });
	}

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		logger.error('[CARD_OCR] ANTHROPIC_API_KEY is not set');
		return res.status(503).json({ error: 'Card scanning service is not configured.' });
	}

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');

	try {
		const imageBlocks = req.files.map(file => ({
			type: 'image',
			source: {
				type: 'base64',
				media_type: file.mimetype,
				data: file.buffer.toString('base64'),
			},
		}));

		// Tell the model how to read multiple images: first = front, rest = back/extra.
		const promptText = req.files.length > 1
			? `Analyze this trading card and extract all visible information as JSON. ${req.files.length} images are provided: the first is the card front; the remaining images are the back and/or additional angles — use them to read set codes, collector numbers and copyright text.`
			: 'Analyze this trading card and extract all visible information as JSON.';

		const ocrArgs = { apiKey, system: CardOCRPrompt, promptText, imageBlocks };

		let content = await requestOcr({ ...ocrArgs, model: OCR_MODEL_FAST, timeoutMs: OCR_TIMEOUT_FAST });

		// Quality-gated escalation: only pay for the stronger model when the fast
		// one left out something the rest of the pipeline depends on.
		const reason = escalationReason(parseOcrJson(content));
		if (reason) {
			logger.info(`[CARD_OCR] Escalating to ${OCR_MODEL_STRONG}: ${reason}`);
			try {
				const stronger = await requestOcr({ ...ocrArgs, model: OCR_MODEL_STRONG, timeoutMs: OCR_TIMEOUT_STRONG });
				// Only take the escalation when it actually read a card — a flaky or
				// truncated second call must not replace a usable first one.
				if (parseOcrJson(stronger)?.name) content = stronger;
				else logger.warn('[CARD_OCR] Escalation returned no usable read — keeping fast result');
			} catch (err) {
				// Keep the fast result rather than failing the whole scan.
				logger.warn(`[CARD_OCR] Escalation failed, using fast result: ${err.message}`);
			}
		}

		sseWrite(res, 'content', content);
		sseWrite(res, 'completed', '[COMPLETED]');
		res.end();
	} catch (err) {
		logger.error(`[CARD_OCR] scan failed: ${err.message}`);
		sseWrite(res, 'error', err.message);
		res.end();
	}
});

export default router;
