import process from 'node:process';
import { Router } from 'express';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import { runCardOcr, toImageBlocks } from '../utils/cardOcr.js';
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
		const { content } = await runCardOcr({
			apiKey,
			imageBlocks: toImageBlocks(req.files),
			log: msg => logger.info(`[CARD_OCR] ${msg}`),
		});

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
