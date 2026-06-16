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
import { sessionTimeoutMiddleware } from './middleware/sessionTimeout.js';
import { secureHeadersMiddleware } from './middleware/secureHeaders.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';

Sentry.init({
	dsn: process.env.SENTRY_DSN || 'https://6477807dc7f2422d3cf0eacd260645b3@o4511534905884672.ingest.us.sentry.io/4511534929543168',
	tracesSampleRate: 0.2,
	environment: process.env.NODE_ENV || 'production',
});

const app = express();

app.set('trust proxy', true);

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
app.use(globalRateLimit);

logger.debug(`[MAIN] Configuring body parser with limit: ${BodyLimit} bytes`);
// Stripe webhooks need the raw body buffer for signature verification — skip JSON
// parsing for that path so express.raw() inside the route handler sees the buffer.
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

app.use(sessionTimeoutMiddleware);

// Mount at / for local dev, /hcgi/api for Hostinger, and /api for Vercel.
const apiRouter = routes();
app.use('/', apiRouter);
app.use('/hcgi/api', apiRouter);
app.use('/api', apiRouter);

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
