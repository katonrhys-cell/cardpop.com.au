import process from 'node:process';
import { Router } from 'express';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import { toImageBlocks } from '../utils/cardOcr.js';
import { compressImageBuffer } from '../utils/compressImageBuffer.js';
import { runGradeEstimate, describeGradeFailure } from '../utils/gradeEstimator.js';
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

// The photos are sent to the model inline (base64) and never stored: a grade
// estimate is a one-off read, not a listing.
async function toCompressedImageBlocks(files) {
	const compressed = await Promise.all(files.map(async (file) => {
		const { buffer, contentType } = await compressImageBuffer(file.buffer, file.mimetype);
		return { buffer, mimetype: contentType };
	}));
	return toImageBlocks(compressed);
}

router.post('/estimate', integratedAiRateLimit, requireAuth, uploadFiles({
	allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	fieldName: 'images',
	maxCount: 2,
}), async (req, res) => {
	if (!req.files?.length) {
		return res.status(400).json({ error: 'At least one card image is required' });
	}

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		logger.error('[GRADE_ESTIMATOR] ANTHROPIC_API_KEY is not set');
		return res.status(503).json({ error: 'The grade estimator is not configured.' });
	}

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');

	try {
		const imageBlocks = await toCompressedImageBlocks(req.files);
		const { content } = await runGradeEstimate({ apiKey, imageBlocks });

		sseWrite(res, 'content', content);
		sseWrite(res, 'completed', '[COMPLETED]');
		res.end();
	} catch (err) {
		// Full detail to the logs, a safe summary to the browser — the
		// provider's message can carry our account and billing state.
		logger.error(`[GRADE_ESTIMATOR] estimate failed: ${err.message}`);
		sseWrite(res, 'error', describeGradeFailure(err));
		res.end();
	}
});

export default router;
