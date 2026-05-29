import app from './app.js';
import logger from './utils/logger.js';

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
	logger.info('Interrupted');
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM signal received');
	await new Promise(resolve => setTimeout(resolve, 3000));
	logger.info('Exiting');
	process.exit();
});

// Security middleware - order matters
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

// CORS configuration - restrictive by default
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
	origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
	credentials: corsOrigin !== '*',
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
	exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
	maxAge: 86400,
}));

// Request logging
app.use(morgan('combined'));

// Global rate limiting - apply early in middleware chain
app.use(globalRateLimit);

// Body parsing with comprehensive error handling
logger.debug(`[MAIN] Configuring body parser with limit: ${BodyLimit} bytes`);
app.use(express.json({
	limit: BodyLimit,
}));
app.use(express.urlencoded({ 
	extended: true,
	limit: BodyLimit,
}));

// Add custom error handler for JSON parsing errors
app.use((err, req, res, next) => {
	if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
		logger.error('[MAIN] JSON parsing error:', err.message);
		logger.error('[MAIN] Raw request body:', req.body);
		logger.error('[MAIN] Request headers:', req.headers);
		return res.status(400).json({ error: 'Invalid JSON in request body' });
	}
	next();
});

// CSRF protection
app.use(csrfMiddleware);

// Session timeout
app.use(sessionTimeoutMiddleware);

// Routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/hcgi/api', routes());

// Security.txt endpoint
app.get('/.well-known/security.txt', (req, res) => {
	res.type('text/plain').send(`Contact: security@example.com
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Preferred-Languages: en
Canonical: https://example.com/.well-known/security.txt
`);
});

// Error handling middleware
app.use(errorMiddleware);

// 404 handler
app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3001;

if (port !== 3001 && port !== '3001') {
	logger.warn(`⚠️  PORT is set to ${port}, but should be 3001 for production compatibility`);
}

app.listen(port, () => {
	logger.info(`🚀 API Server running on http://localhost:${port}`);
});

export default app;
