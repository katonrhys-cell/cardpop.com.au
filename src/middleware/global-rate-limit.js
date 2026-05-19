import rateLimit from 'express-rate-limit';
import ipKeyGenerator from '../utils/ipKeyGenerator.js';
import logger from '../utils/logger.js';

export const globalRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 100,
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
});