import rateLimit from 'express-rate-limit';
import ipKeyGenerator from '../utils/ipKeyGenerator.js';
import logger from '../utils/logger.js';

export const globalRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 50,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later' },
	keyGenerator: (req) => ipKeyGenerator(req),
	handler: (req, res) => {
		const clientIp = ipKeyGenerator(req);
		logger.warn(`[RATE_LIMIT] Global rate limit exceeded for IP: ${clientIp}`);
		res.status(429).json({
			error: 'Too many requests, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
	// Skip rate limiting for certain safe endpoints (e.g., health checks).
	// This middleware runs before the api router is mounted at '/', '/hcgi/api'
	// and '/api' (see app.js), so req.path here is the full incoming path —
	// '/api/health' or '/hcgi/api/health' in production, never the bare
	// '/health' the router itself sees. Matching only the exact string left
	// this skip permanently dead in production, letting a health-check poller
	// count toward (and potentially trip) the 50-req/5-min global cap.
	skip: (req) => req.path.endsWith('/health'),
});