import rateLimit from 'express-rate-limit';
import ipKeyGenerator from '../utils/ipKeyGenerator.js';
import logger from '../utils/logger.js';
import PgRateLimitStore from '../utils/pgRateLimitStore.js';

// These limiters guard low-volume, security-sensitive actions (MFA backup-code
// brute-force, email-triggering resends, HIBP proxy, login/password advisory)
// where the in-memory default's per-serverless-instance multiplication is a real
// weakness — back them with a shared Postgres store so the cap is global. The
// high-volume global/api limiters deliberately stay in-memory (Cloudflare is the
// authoritative volumetric layer). The store fails open, so a DB outage can
// never lock users out. See SECURITY_AUDIT_2026-07-21 → M4.

// Login endpoint rate limiter: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	store: new PgRateLimitStore('login'),
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
	store: new PgRateLimitStore('pwreset'),
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

// Stripe/PayPal webhook rate limiter: 1000 requests per minute. Only ever
// mounted directly at the exact webhook paths (see routes/index.js), so no
// skip condition is needed here — router.use(path, stripeLimiter) already
// scopes it. A `skip` keyed on req.path used to live here, but req.path is
// relative to the mount point (so it read '/' for a request to exactly
// '/stripe/webhook'), making the skip condition always true and this
// limiter permanently dead — webhook traffic silently fell through to the
// standard 100/min apiLimiter instead.
const stripeLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 1000,
	message: { error: 'Too many requests' },
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
});

// Backup code verify rate limiter: 5 attempts per 15 minutes per authenticated user.
// The route already requires authMiddleware so req.user is always populated here.
const backupCodeLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	store: new PgRateLimitStore('backupcode'),
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn(`[RATE_LIMIT] Backup code verify rate limit exceeded for user: ${req.user?.id}`);
		res.status(429).json({
			error: 'Too many backup code attempts, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Content-report submission limiter: 10 reports per hour per authenticated user.
// Reporting requires auth, so key by user id — this throttles mass/abusive
// reporting (a brigading vector) without blocking IPs shared by many users.
const reportLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 10,
	store: new PgRateLimitStore('report'),
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn(`[RATE_LIMIT] Report submission limit exceeded for user: ${req.user?.id}`);
		res.status(429).json({
			error: 'You have submitted too many reports recently. Please try again later.',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Verification-email resend limiter: 3 per 15 minutes, keyed by the TARGET
// email (normalised) so an attacker can't email-bomb one victim by rotating
// IPs, nor burn the project's email-sending quota. This endpoint is
// unauthenticated and triggers an outbound email, so it needs a tighter,
// email-scoped cap than the global IP limiter.
const resendVerificationLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 3,
	store: new PgRateLimitStore('resendverify'),
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) =>
		(typeof req.body?.email === 'string' && req.body.email.trim())
			? `resend:${req.body.email.trim().toLowerCase()}`
			: ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn('[RATE_LIMIT] Verification resend limit exceeded');
		res.status(429).json({
			error: 'Too many verification emails requested. Please wait a while before trying again.',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Welcome-offer issue limiter: 3 per 15 minutes keyed by the TARGET user id.
// The endpoint is unauthenticated (a fresh signup may not have a session yet
// when email confirmation is on) and triggers an outbound email, so it gets
// the same tight, target-scoped cap as verification resends. The email address
// is always taken from the auth record server-side, never from the request.
const welcomeOfferIssueLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 3,
	store: new PgRateLimitStore('welcomeoffer'),
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) =>
		(typeof req.body?.userId === 'string' && req.body.userId.trim())
			? `welcome:${req.body.userId.trim().toLowerCase()}`
			: ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn('[RATE_LIMIT] Welcome offer issue limit exceeded');
		res.status(429).json({
			error: 'Too many requests. Please wait a while before trying again.',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Pwned-password check limiter: 30 per 15 minutes per IP. The endpoint is a
// thin k-anonymity proxy to HaveIBeenPwned (one outbound request per call), hit
// on signup / password change, so cap it tightly enough that it can't be abused
// as a general-purpose HIBP proxy while leaving room for genuine retries.
const pwnedCheckLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 30,
	store: new PgRateLimitStore('pwned'),
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn(`[RATE_LIMIT] Pwned-password check limit exceeded for IP: ${ipKeyGenerator(req)}`);
		res.status(429).json({
			error: 'Too many password checks, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Email-existence check limiter: 20 per minute per IP. Powers the guest-checkout
// "you already have an account" nudge, which deliberately reveals account
// existence — cap it tightly enough to blunt scripted enumeration (Cloudflare +
// the global apiLimiter sit in front) while leaving ample room for a shopper
// correcting a typo. Keyed by IP; fails open like the others.
const emailCheckLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 20,
	store: new PgRateLimitStore('emailcheck'),
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn(`[RATE_LIMIT] Email-existence check limit exceeded for IP: ${ipKeyGenerator(req)}`);
		res.status(429).json({
			error: 'Too many requests, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

// Password-change limiter: 5 attempts per 15 minutes per authenticated user.
// /auth/password/change verifies the *current* password with a real GoTrue
// sign-in, so without a per-user cap a stolen session could guess the current
// password at the global limiter's rate — and every guess also spends the
// server's shared per-IP auth quota at Supabase.
const passwordChangeLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	store: new PgRateLimitStore('pwchange'),
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
	handler: (req, res) => {
		logger.warn(`[RATE_LIMIT] Password change limit exceeded for user: ${req.user?.id}`);
		res.status(429).json({
			error: 'Too many password change attempts, please try again later',
			retryAfter: req.rateLimit.resetTime,
		});
	},
});

export { loginLimiter, passwordResetLimiter, apiLimiter, stripeLimiter, backupCodeLimiter, reportLimiter, resendVerificationLimiter, welcomeOfferIssueLimiter, pwnedCheckLimiter, emailCheckLimiter, passwordChangeLimiter };