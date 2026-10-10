// Stub external service credentials so routes can be imported without live connections.
// These values are intentionally fake — no real services are contacted during tests.
process.env.STRIPE_SECRET_KEY = 'sk_test_vitest_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_vitest_dummy';
process.env.EBAY_APP_ID = 'vitest_dummy';
process.env.EBAY_CLIENT_SECRET = 'vitest_dummy';
process.env.CORS_ORIGIN = '*';
process.env.SUPABASE_URL = 'https://vitest-dummy.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdGVzdC1kdW1teSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.vitest_dummy_signature';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdGVzdC1kdW1teSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.vitest_dummy_signature';
process.env.ENCRYPTION_KEY = 'vitest_dummy_encryption_key_32ch';
process.env.PSA_API_TOKEN = 'vitest_dummy_psa_token';
// Payment return URLs are pinned to the app's own origins (src/utils/returnUrl.js);
// the route tests use https://example.com, so allow it here.
process.env.CHECKOUT_RETURN_ORIGINS = 'https://example.com';
// Per-instance caches (token verdicts, admin flag, MFA factors, platform
// settings — src/utils/ttlCache.js users) are OFF in tests so every stubbed
// Supabase call is observed exactly as before. The cache tests set these
// themselves.
process.env.AUTH_TOKEN_CACHE_TTL_MS = '0';
process.env.AUTH_TOKEN_NEGATIVE_TTL_MS = '0';
process.env.ADMIN_FLAG_CACHE_TTL_MS = '0';
process.env.MFA_FACTORS_CACHE_TTL_MS = '0';
process.env.PLATFORM_SETTINGS_TTL_MS = '0';
