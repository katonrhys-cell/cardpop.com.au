import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { TURNSTILE_SITE_KEY, TURNSTILE_ENABLED } from '@/lib/turnstile.js';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;

// Load the Turnstile API script exactly once, shared across all widgets.
function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing when Turnstile is disabled (no site key configured). The
 * token it produces must be passed to the matching Supabase Auth call
 * (signUp / signInWithPassword / resetPasswordForEmail / resend) via
 * `options.captchaToken` — Supabase verifies it server-side.
 *
 * Props:
 *   - onVerify(token): called with the token when the challenge is solved.
 *   - onExpire():      called when the token expires or errors (clear state).
 *   - theme:           'light' | 'dark' | 'auto' (defaults to the app theme).
 *   - className
 *
 * Ref exposes: reset() — clears the widget so a fresh token can be obtained
 * (Turnstile tokens are single-use, so reset after every auth attempt).
 */
const Turnstile = forwardRef(({ onVerify, onExpire, theme, className = '' }, ref) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null && window.turnstile?.reset) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_ENABLED) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        // Guard against double-render (React StrictMode / re-mounts).
        if (widgetIdRef.current !== null || containerRef.current.childElementCount > 0) return;

        const resolvedTheme =
          theme ||
          (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
            ? 'dark'
            : 'light');

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: resolvedTheme,
          callback: (token) => onVerifyRef.current?.(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onExpireRef.current?.(),
          'timeout-callback': () => onExpireRef.current?.(),
        });
      })
      .catch(() => {
        // Script failed to load — leave the container empty; forms that require
        // a token keep their submit button disabled.
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (_) { /* already gone */ }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_ENABLED) return null;

  return <div ref={containerRef} className={className} />;
});

Turnstile.displayName = 'Turnstile';

export default Turnstile;
