// Public reCAPTCHA site key, injected at build time by Vite. Used only by the
// newsletter form (auth flows use Cloudflare Turnstile via Supabase instead).
// When the key is absent the reCAPTCHA layer is disabled: the widget renders
// nothing and the form works without it.
export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
export const RECAPTCHA_ENABLED = Boolean(RECAPTCHA_SITE_KEY);
