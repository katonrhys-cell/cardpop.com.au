// Cloudflare Turnstile site key, injected at build time by Vite. Turnstile is
// wired into Supabase Auth's native CAPTCHA protection, so the matching SECRET
// key lives in the Supabase dashboard (Authentication → Attack Protection),
// NOT in this app's environment.
//
// IMPORTANT: enable both sides together. If CAPTCHA is turned on in Supabase
// but this site key is missing from the build, every auth call is rejected.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
export const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY);
