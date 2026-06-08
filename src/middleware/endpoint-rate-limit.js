import rateLimit from 'express-rate-limit';
import ipKeyGenerator from '../utils/ipKeyGenerator.js';
import logger from '../utils/logger.js';

// Login endpoint rate limiter: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	message: { error: 'Too many login attempts, please try again later' },
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
	skip: (req, res) => {
		// Skip rate limiting for health checks
		return req.path === '/health';
	},
	handler: (req, res) => {
		const clientIp = ipKeyGenerator(req);
		logger.warn(`[RATE_LIMIT] Login rate limit exceeded for IP: ${clientIp}`);
		res.status(429).json({
			error: 'Too many login attempts, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Password reset endpoint rate limiter: 3 attempts per hour
const passwordResetLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 3,
	message: { error: 'Too many password reset requests, please try again later' },
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
	handler: (req, res) => {
		const clientIp = ipKeyGenerator(req);
		logger.warn(`[RATE_LIMIT] Password reset rate limit exceeded for IP: ${clientIp}`);
		res.status(429).json({
			error: 'Too many password reset requests, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// API endpoint rate limiter: 100 requests per minute per IP
const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 100,
	message: { error: 'Too many requests, please try again later' },
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
	handler: (req, res) => {
		const clientIp = ipKeyGenerator(req);
		logger.warn(`[RATE_LIMIT] API rate limit exceeded for IP: ${clientIp}`);
		res.status(429).json({
			error: 'Too many requests, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Stripe webhook rate limiter: 1000 requests per minute
const stripeLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 1000,
	message: { error: 'Too many requests' },
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
	skip: (req) => {
		// Only apply to webhook endpoint
		return !req.path.includes('/webhook');
	},
});

// MFA verify rate limiter: 5 attempts per 15 minutes per IP
// Prevents brute-forcing 8-digit OTP codes across any mfaId
const mfaLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
	handler: (req, res) => {
		const clientIp = ipKeyGenerator(req);
		logger.warn(`[RATE_LIMIT] MFA verify rate limit exceeded for IP: ${clientIp}`);
		res.status(429).json({
			error: 'Too many verification attempts, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

export { loginLimiter, passwordResetLimiter, apiLimiter, stripeLimiter, mfaLimiter };