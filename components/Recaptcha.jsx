import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { RECAPTCHA_SITE_KEY, RECAPTCHA_ENABLED } from '@/lib/recaptcha.js';

const SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit';

let scriptPromise = null;

// Load the reCAPTCHA API script exactly once, shared across all widgets.
function loadRecaptchaScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.grecaptcha?.render) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Google reCAPTCHA v2 ("I'm not a robot") checkbox widget.
 *
 * Renders nothing when reCAPTCHA is disabled (no site key configured).
 *
 * Props:
 *   - onVerify(token): called with the response token when the user solves it.
 *   - onExpire():      called when the token expires or errors (clear your state).
 *   - theme:           'light' | 'dark' (defaults to the current app theme).
 *   - className
 *
 * Ref exposes: reset() — clears the widget so the user can solve it again.
 */
const Recaptcha = forwardRef(({ onVerify, onExpire, theme, className = '' }, ref) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  // Keep the latest callbacks without re-running the render effect.
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    },
  }), []);

  useEffect(() => {
    if (!RECAPTCHA_ENABLED) return;
    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled) return;
        window.grecaptcha.ready(() => {
          if (cancelled || !containerRef.current) return;
          // Guard against double-render (React StrictMode / re-mounts).
          if (widgetIdRef.current !== null || containerRef.current.childElementCount > 0) return;

          const resolvedTheme =
            theme ||
            (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
              ? 'dark'
              : 'light');

          widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            theme: resolvedTheme,
            callback: (token) => onVerifyRef.current?.(token),
            'expired-callback': () => onExpireRef.current?.(),
            'error-callback': () => onExpireRef.current?.(),
          });
        });
      })
      .catch(() => {
        // Script failed to load — leave the container empty; forms that require
        // a token will keep the submit button disabled.
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!RECAPTCHA_ENABLED) return null;

  return <div ref={containerRef} className={className} />;
});

Recaptcha.displayName = 'Recaptcha';

export default Recaptcha;
