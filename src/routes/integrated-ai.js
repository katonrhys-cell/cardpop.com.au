import { Router } from 'express';
import { ContentBlockType, stream, uploadImagesToSupabase } from '../api/integrated-ai.js';
import { SystemPrompt } from '../constants/prompts.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';

const router = Router();

// Client-supplied image blocks in the chat message are forwarded to the
// downstream AI service, which fetches them — so an attacker could point one at
// an internal address (e.g. http://169.254.169.254/…) to make that service
// perform an SSRF on their behalf. Only allow image URLs that live on our own
// storage / image CDN over https; anything else is dropped before forwarding.
// The server's own uploads (uploadImagesToSupabase) already use these hosts.
const ALLOWED_IMAGE_HOSTS = new Set([
	'vrfsaazuqjxotnieqlkd.supabase.co',
	'img.cardpop.com.au',
]);
function isAllowedImageUrl(value) {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
	} catch {
		return false;
	}
}

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

	// Drop any client-supplied image blocks that don't point at our own storage,
	// so the downstream AI service can't be made to fetch an attacker URL (SSRF).
	parsedMessage = parsedMessage.filter(
		(block) => block?.type !== ContentBlockType.Image || isAllowedImageUrl(block?.image),
	);

	if (req.files?.length > 0) {
		const imageUrls = await uploadImagesToSupabase({ images: req.files });
		imageUrls.forEach((url) => {
			parsedMessage.push({ type: ContentBlockType.Image, image: url });
		});
	}

	let sseStream;
	try {
		sseStream = await stream({
			userId: req.userId,
			systemPrompt: SystemPrompt,
			userMessage: parsedMessage,
		});
	} catch (err) {
		// The proxy isn't configured on this deployment: say so (503) instead of
		// letting the generic 500 handler hide the cause.
		if (err?.status === 503) {
			return res.status(503).json({ error: err.message });
		}
		throw err;
	}

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
