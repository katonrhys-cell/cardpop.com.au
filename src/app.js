import dotenv from 'dotenv';
dotenv.config();
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import { isCloudflareIp } from './utils/cloudflareIps.js';
import { secureHeadersMiddleware, noCacheHeaders } from './middleware/secureHeaders.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';

Sentry.init({
	dsn: process.env.SENTRY_DSN || 'https://6477807dc7f2422d3cf0eacd260645b3@o4511534905884672.ingest.us.sentry.io/4511534929543168',
	tracesSampleRate: 0.2,
	environment: process.env.NODE_ENV || 'production',
});

const app = express();

// Trust proxy controls how req.ip is derived from X-Forwarded-For, which every
// IP-based control depends on (global rate limit, login lockout keyed on
// (email, ip), audit logs). Trusting the entire chain ('true') lets a client
// spoof X-Forwarded-For and bypass those controls, so trust is bounded:
//
//  - The first TRUST_PROXY_HOPS hops (default 1 — Vercel's front proxy, which
//    appends the true connecting peer to X-Forwarded-For) are always trusted.
//  - Beyond that, a hop is trusted only if it is a Cloudflare edge address.
//    Production traffic flows client → Cloudflare → Vercel, so the peer Vercel
//    records is a Cloudflare IP; trusting it lets Express walk one entry
//    further and resolve req.ip to the real visitor. A request that bypasses
//    Cloudflare (e.g. straight to the *.vercel.app host) gets no such trust:
//    any X-Forwarded-For it invents sits behind its own untrusted connecting
//    address, so req.ip is the attacker's real IP — spoofing stays impossible.
const trustProxyHops = (() => {
	const parsed = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
	return Number.isNaN(parsed) ? 1 : parsed;
})();
app.set('trust proxy', (addr, hop) => hop < trustProxyHops || isCloudflareIp(addr));

app.use(secureHeadersMiddleware);
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", 'data:', 'https:'],
			connectSrc: ["'self'"],
			fontSrc: ["'self'"],
			objectSrc: ["'none'"],
			mediaSrc: ["'self'"],
			frameSrc: ["'none'"],
		},
	},
	frameguard: { action: 'deny' },
	contentTypeOptions: true,
	xssFilter: true,
	hsts: {
		maxAge: 31536000,
		includeSubDomains: true,
		preload: true,
	},
	referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
	origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
	credentials: corsOrigin !== '*',
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
	exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
	maxAge: 86400,
}));

app.use(morgan('combined'));
// Apply the global IP rate limit to everything except the Stripe webhook —
// a burst of webhook retries from Stripe must never be throttled (the route
// still has its own high-capacity stripeLimiter). Matches the JSON-skip below.
app.use((req, res, next) => {
	if (req.path.endsWith('/stripe/webhook')) return next();
	return globalRateLimit(req, res, next);
});

logger.debug(`[MAIN] Configuring body parser with limit: ${BodyLimit} bytes`);
// Stripe webhooks need the raw body buffer for signature verification — skip JSON
// parsing for that path so express.raw() inside the route handler sees the buffer.
// The /stripe/webhook route handler (in src/routes/stripe.js) validates the signature
// with stripe.webhooks.constructEvent() before processing the event.
// endsWith handles both /stripe/webhook (dev) and /hcgi/api/stripe/webhook (Hostinger proxy).
app.use((req, res, next) => {
	if (req.path.endsWith('/stripe/webhook')) return next();
	express.json({ limit: BodyLimit })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: BodyLimit }));

app.use((err, req, res, next) => {
	if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
		return res.status(400).json({ error: 'Invalid JSON in request body' });
	}
	next();
});

// Mount at / for local dev, /hcgi/api for Hostinger, and /api for Vercel.
const apiRouter = routes();
app.use('/', noCacheHeaders, apiRouter);
app.use('/hcgi/api', noCacheHeaders, apiRouter);
app.use('/api', noCacheHeaders, apiRouter);

app.get('/.well-known/security.txt', (req, res) => {
	res.type('text/plain').send(`Contact: mailto:support@cardpop.com.au
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Preferred-Languages: en
Canonical: https://cardpop.com.au/.well-known/security.txt
`);
});

Sentry.setupExpressErrorHandler(app);
app.use(errorMiddleware);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

export default app;
