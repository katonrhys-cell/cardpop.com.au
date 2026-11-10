import process from 'node:process';
import { Router } from 'express';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import { runCardOcr, toImageBlocks, describeOcrFailure } from '../utils/cardOcr.js';
import { recordAiUsage } from '../utils/aiUsage.js';
import { withAiConversation } from '../utils/aiTracing.js';
import { requireAiAllowance } from '../middleware/aiAllowance.js';
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

router.post('/scan', integratedAiRateLimit, requireAuth, requireAiAllowance('card_scan'), uploadFiles({
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
		// Sentry agent tracing: the scan is tagged with the member (id only).
		const { content } = await withAiConversation({ userId: req.userId }, () => runCardOcr({
			apiKey,
			imageBlocks: toImageBlocks(req.files),
			log: msg => logger.info(`[CARD_OCR] ${msg}`),
			onUsage: ({ model, usage, escalation }) => recordAiUsage({
				feature: escalation ? 'card_scan_escalation' : 'card_scan',
				model, usage, userId: req.userId,
			}),
		}));

		sseWrite(res, 'content', content);
		sseWrite(res, 'completed', '[COMPLETED]');
		res.end();
	} catch (err) {
		// Full detail to the logs, a safe summary to the browser — the provider's
		// message can carry our account and billing state.
		logger.error(`[CARD_OCR] scan failed: ${err.message}`);
		sseWrite(res, 'error', describeOcrFailure(err));
		res.end();
	}
});

export default router;
