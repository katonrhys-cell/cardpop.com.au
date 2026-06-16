import { Router } from 'express';
import { ContentBlockType, streamOneShot, uploadImagesToSupabase } from '../api/integrated-ai.js';
import { GradeEstimatorPrompt } from '../constants/prompts.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(supabaseAuth);

const requireAuth = (req, res, next) => {
	if (!req.userId) {
		return res.status(401).json({ error: 'Authentication required' });
	}
	next();
};

router.post('/estimate', integratedAiRateLimit, requireAuth, uploadFiles({
	allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	fieldName: 'images',
	maxCount: 2,
}), async (req, res) => {
	if (!req.files?.length) {
		return res.status(400).json({ error: 'At least one card image is required' });
	}

	const imageUrls = await uploadImagesToSupabase({ images: req.files });

	const userMessage = [
		{
			type: ContentBlockType.Text,
			text: 'Analyse this trading card image and provide grade estimates for PSA, BGS, CGC, ACE, and SGC grading services. Return only JSON.',
		},
		...imageUrls.map(url => ({ type: ContentBlockType.Image, image: url })),
	];

	const sseStream = await streamOneShot({
		systemPrompt: GradeEstimatorPrompt,
		userMessage,
	});

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');

	sseStream.pipe(res);

	res.on('close', () => sseStream.destroy());
});

export default router;
