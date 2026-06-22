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

		const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: 'claude-haiku-4-5-20251001',
				max_tokens: 1024,
				system: CardOCRPrompt,
				messages: [{
					role: 'user',
					content: [
						{ type: 'text', text: promptText },
						...imageBlocks,
					],
				}],
			}),
			signal: AbortSignal.timeout(25_000),
		});

		if (!anthropicRes.ok) {
			const errBody = await anthropicRes.text().catch(() => '');
			throw new Error(`Anthropic API error ${anthropicRes.status}: ${errBody}`);
		}

		const anthropicData = await anthropicRes.json();
		const content = anthropicData.content?.[0]?.text ?? '';

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
