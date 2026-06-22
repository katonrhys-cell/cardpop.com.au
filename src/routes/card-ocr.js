import process from 'node:process';
import { Router } from 'express';
import { CardOCRPrompt } from '../constants/prompts.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/pocketbase-auth.js';
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
			max_tokens: 1024,
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

// Decides whether the fast model's result warrants a second pass with the
// stronger model: unreadable JSON, no card name, or self-reported low confidence.
function shouldEscalate(content) {
	try {
		const match = content.match(/\{[\s\S]*\}/);
		if (!match) return true;
		const data = JSON.parse(match[0]);
		if (!data.name) return true;
		return String(data.confidence ?? '').toLowerCase() === 'low';
	} catch {
		return true;
	}
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

		// Confidence-gated escalation: only pay for the stronger model when the
		// fast model couldn't confidently identify the card.
		if (shouldEscalate(content)) {
			logger.info('[CARD_OCR] Low-confidence fast result — escalating to stronger model');
			try {
				const stronger = await requestOcr({ ...ocrArgs, model: OCR_MODEL_STRONG, timeoutMs: OCR_TIMEOUT_STRONG });
				if (stronger) content = stronger;
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
