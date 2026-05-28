// Stub external service credentials so routes can be imported without live connections.
// These values are intentionally fake — no real services are contacted during tests.
process.env.STRIPE_SECRET_KEY = 'sk_test_vitest_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_vitest_dummy';
process.env.POCKETBASE_URL = 'http://localhost:8090';
process.env.EBAY_APP_ID = 'vitest_dummy';
process.env.EBAY_CLIENT_SECRET = 'vitest_dummy';
process.env.CORS_ORIGIN = '*';
