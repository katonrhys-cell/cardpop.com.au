import dotenv from 'dotenv';
dotenv.config();
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import { isCloudflareIp } from './utils/cloudflareIps.js';
import { secureHeadersMiddleware, noCacheHeaders } from './middleware/secureHeaders.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';

// Sentry captures every 5xx via setupExpressErrorHandler below. With the
// default request-data integration that included the JSON body and every
// header — so a throw inside /auth/password/change shipped the user's current
// AND new password, plus their bearer token, to a third party. Bodies, cookies
// and headers are now excluded outright and a final scrub strips anything
// secret-shaped that still reaches an event.
const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|otp|code|card|cvc|ssn|api[-_]?key/i;
export function scrubSentryEvent(event) {
	if (event?.request) {
		delete event.request.data;
		delete event.request.cookies;
		if (event.request.headers) {
			for (const k of Object.keys(event.request.headers)) {
				if (/^(authorization|cookie|x-csrf-token|x-api-key)$/i.test(k)) delete event.request.headers[k];
			}
		}
		if (typeof event.request.query_string === 'string' && /token|code|secret|key/i.test(event.request.query_string)) {
			event.request.query_string = '[Filtered]';
		}
	}
	const scrub = (obj, depth = 0) => {
		if (!obj || typeof obj !== 'object' || depth > 6) return;
		for (const k of Object.keys(obj)) {
			if (SENSITIVE_KEY.test(k)) obj[k] = '[Filtered]';
			else scrub(obj[k], depth + 1);
		}
	};
	scrub(event?.extra);
	scrub(event?.contexts);
	if (event?.user) event.user = event.user.id ? { id: event.user.id } : undefined;
	return event;
}

Sentry.init({
	dsn: process.env.SENTRY_DSN || 'https://6477807dc7f2422d3cf0eacd260645b3@o4511534905884672.ingest.us.sentry.io/4511534929543168',
	// Error capture only. Tracing was sampled at 20%, but ESM hoists imports,
	// so `express` was loaded before this init ran and Sentry's Express
	// auto-instrumentation never attached — the sampled traces carried no
	// route spans, while every request still paid the span bookkeeping and
	// the sampled ones an extra outbound envelope. Sampling at 0 keeps the
	// error path (5xx via setupExpressErrorHandler, captureMessage in the
	// reconciler and Connect service) and drops the rest. If tracing is ever
	// wanted, initialise Sentry through `node --import` so it precedes
	// express, and set SENTRY_TRACES_SAMPLE_RATE. The SDK import itself is
	// ~300 ms of the ~800 ms cold start and is not avoidable while Sentry is
	// in use — see docs/performance.md.
	tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0) || 0,
	environment: process.env.NODE_ENV || 'production',
	sendDefaultPii: false,
	integrations: [
		Sentry.requestDataIntegration({
			include: { cookies: false, data: false, headers: false, ip: false, query_string: true, url: true, user: false },
		}),
	],
	beforeSend: scrubSentryEvent,
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

// A single Helmet instance (secureHeadersMiddleware) sets the security headers,
// including the CSP. It is a strict superset of the previous second, inline
// helmet() block that used to sit here (same directives plus baseUri/formAction
// and a permissions policy), so that duplicate was removed — two stacked helmet
// instances just meant the last one silently won and the two could drift.
app.use(secureHeadersMiddleware);

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
// Apply the global IP rate limit to everything except the payment webhooks —
// a burst of retries from Stripe or PayPal (a handful of fixed egress IPs)
// must never be throttled, or the provider backs off and eventually disables
// the webhook. Both routes still carry their own high-capacity stripeLimiter.
// The Stripe skip matches the JSON-skip below.
app.use((req, res, next) => {
	if (req.path.endsWith('/stripe/webhook') || req.path.endsWith('/paypal/webhook')) return next();
	return globalRateLimit(req, res, next);
});

logger.debug(`[MAIN] Configuring body parser with limit: ${BodyLimit} bytes`);
// Stripe webhooks need the raw body buffer for signature verification — skip JSON
// parsing for that path so express.raw() inside the route handler sees the buffer.
// The /stripe/webhook route handler (in src/routes/stripe.js) validates the signature
// with stripe.webhooks.constructEvent() before processing the event.
// endsWith handles both /stripe/webhook (dev) and /hcgi/api/stripe/webhook (the
// frontend's proxied prefix, which Vercel rewrites to /api).
app.use((req, res, next) => {
	if (req.path.endsWith('/stripe/webhook')) return next();
	// The admin event-scraper accepts a large pasted page body. Parsing it here —
	// before the route's auth/admin check — would let an UNAUTHENTICATED caller
	// force a 20 MB allocation on every request. Skip JSON parsing for that
	// router; it parses the body with LargeBodyLimit only AFTER authenticating
	// and authorizing the caller (router-level gate in routes/event-scraper.js).
	if (req.path.includes('/event-scraper')) return next();
	express.json({ limit: BodyLimit })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: BodyLimit }));

app.use((err, req, res, next) => {
	if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
		return res.status(400).json({ error: 'Invalid JSON in request body' });
	}
	// Other body-parser errors (413 payload too large, aborted request, bad
	// charset…) must stay on the error path — calling next() without the error
	// resumed normal routing with req.body undefined, so handlers crashed with
	// a generic 500 instead of the real 4xx.
	if (err?.status >= 400 && err.status < 500) {
		return res.status(err.status).json({ error: err.type === 'entity.too.large' ? 'Request body too large' : 'Invalid request body' });
	}
	next(err);
});

// Mount at / for local dev, and both /hcgi/api (the frontend's proxied prefix,
// rewritten by Vercel) and /api for the Vercel serverless function.
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
