import { Router } from 'express';
import { ContentBlockType, streamOneShot, uploadImagesToPocketBase } from '../api/integrated-ai.js';
import { CardOCRPrompt } from '../constants/prompts.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

router.post('/scan', integratedAiRateLimit, uploadFiles({
	allowedMimeTypes: [
		'image/jpeg',
		'image/png',
		'image/webp',
	],
	fieldName: 'images',
}), async (req, res) => {
	if (!req.files?.length) {
		throw new Error('An image is required for card scanning');
	}

	const imageUrls = await uploadImagesToPocketBase({ images: req.files });

	const userMessage = [
		{ type: ContentBlockType.Text, text: 'Analyze this trading card and extract all visible information as JSON.' },
		...imageUrls.map(url => ({ type: ContentBlockType.Image, image: url })),
	];

	const sseStream = await streamOneShot({
		systemPrompt: CardOCRPrompt,
		userMessage,
	});

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');

	sseStream.pipe(res, { end: false });

	res.on('close', () => sseStream.destroy());
});

export default router;
