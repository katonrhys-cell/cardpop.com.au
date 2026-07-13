import rateLimit from 'express-rate-limit';
import ipKeyGenerator from '../utils/ipKeyGenerator.js';
import logger from '../utils/logger.js';

// AI endpoint limiter: 10 requests/min. Keyed on the authenticated user id when
// available, falling back to the derived client IP for anonymous callers. Every
// router that mounts this (integrated-ai, card-ocr, card-description,
// grade-estimator) applies `supabaseAuth` at the router level
// BEFORE this limiter runs, so req.userId is populated for signed-in users.
// Keying on user id (not raw IP) stops one budget being shared across every user
// behind a shared NAT, and stops a signed-in user getting a fresh budget simply
// by changing networks — important because each call is an expensive LLM request.
export const integratedAiRateLimit = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many AI requests, please try again later' },
	keyGenerator: (req) => req.userId || req.user?.id || ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn(`[RATE_LIMIT] AI request limit exceeded for ${req.userId ? `user: ${req.userId}` : `IP: ${ipKeyGenerator(req)}`}`);
		res.status(429).json({
			error: 'Too many AI requests, please try again later',
			retryAfter: req.rateLimit?.resetTime,
		});
	},
});
