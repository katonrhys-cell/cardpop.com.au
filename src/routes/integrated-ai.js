import { Router } from 'express';
import { ContentBlockType, stream, uploadImagesToSupabase } from '../api/integrated-ai.js';
import { SystemPrompt } from '../constants/prompts.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';

const router = Router();

router.use(supabaseAuth);

// Reject unauthenticated callers BEFORE the multipart upload middleware runs.
// supabaseAuth is optional (it never 401s — it only populates req.userId), and
// uploadFiles uses in-memory storage, so without this guard an anonymous caller
// could make the server buffer up to ~50 MB of image data only to be rejected
// afterwards. Gating here means their body is never read.
const requireUserId = (req, res, next) =>
	req.userId ? next() : res.status(401).json({ error: 'Authentication required' });

router.post('/stream', requireUserId, integratedAiRateLimit, uploadFiles({
	allowedMimeTypes: [
		'image/jpeg',
		'image/png',
		'image/webp',
	],
	fieldName: 'images',
}), async (req, res) => {
	if (!req.userId) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	const { message } = req.body;

	if (!message) {
		return res.status(400).json({ error: 'message is required' });
	}

	let parsedMessage;
	try {
		parsedMessage = JSON.parse(message);
	} catch {
		return res.status(400).json({ error: 'message must be a valid JSON array' });
	}
	if (!Array.isArray(parsedMessage)) {
		return res.status(400).json({ error: 'message must be a valid JSON array' });
	}

	if (req.files?.length > 0) {
		const imageUrls = await uploadImagesToSupabase({ images: req.files });
		imageUrls.forEach((url) => {
			parsedMessage.push({ type: ContentBlockType.Image, image: url });
		});
	}

	const sseStream = await stream({
		userId: req.userId,
		systemPrompt: SystemPrompt,
		userMessage: parsedMessage,
	});

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');

	// Default pipe semantics (end: true): the stream ends itself after the
	// [COMPLETED] event, and that must end the HTTP response too — piping with
	// { end: false } left every response open until the client aborted or the
	// function timed out.
	sseStream.pipe(res);

	res.on('close', () => sseStream.destroy());
});

export default router;
