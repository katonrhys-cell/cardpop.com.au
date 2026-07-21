# Auth brute-force / credential-stuffing protection

**Audit ref:** `SECURITY_AUDIT_2026-07-21.md` → M2.

## The problem

Password sign-in happens **client-side**: `contexts/AuthContext.jsx` calls
`supabase.auth.signInWithPassword(...)` directly against Supabase Auth (GoTrue)
using the public anon key. The custom lockout table behind
`/auth/login/attempt` + `/record-failure` (`src/routes/auth/login.js`) is only
consulted by our own client *before* it calls Supabase.

An attacker doing credential stuffing simply calls GoTrue (or
`signInWithPassword`) directly and never touches our advisory endpoints, so the
counter is never incremented. **The custom lockout is therefore telemetry / UX,
not a security boundary.** The only controls that actually gate the credential
check are the ones enforced by Supabase itself.

## The fix — enable Supabase's native protections (configuration, not code)

The code is already wired for both; they just need to be switched on.

### 1. Cloudflare Turnstile CAPTCHA (already integrated)

The login, signup, password-reset and resend forms already render a Turnstile
widget (`components/Turnstile.jsx`, gated on `TURNSTILE_ENABLED`) and pass the
token to Supabase (`AuthContext` → `options: { captchaToken }`). To activate:

1. Create a Turnstile widget: **dash.cloudflare.com → Turnstile → Add site**
   (add `cardpop.com.au` + `localhost`). Copy the **site key** and **secret**.
2. Set the build-time env var in Vercel: `VITE_TURNSTILE_SITE_KEY=<site key>`
   (public, safe to expose). Redeploy so the widget renders.
3. In Supabase: **Authentication → Attack Protection → enable CAPTCHA →
   provider "Turnstile" → paste the secret → Save.**
4. **Enable both sides together.** Turning CAPTCHA on in Supabase while the site
   key is missing from the build rejects every auth request; shipping the site
   key while Supabase CAPTCHA is off means the token is collected but not
   enforced. (Also documented in `.env.example` under "Cloudflare Turnstile".)

Once enabled, every `signInWithPassword` must carry a valid, single-use
Turnstile token verified server-side by Supabase — a scripted credential-stuffer
can no longer replay the endpoint at scale.

### 2. Supabase Auth rate limiting

**Supabase dashboard → Authentication → Rate Limits.** Tighten the
"Sign in / Sign ups" and "Token refresh" limits to sane values for the expected
traffic. These are enforced by GoTrue on the actual credential-check path, so
they apply even to a client that skips our advisory endpoints.

### 3. Leaked-password protection (related, from the same audit — L1)

**Supabase dashboard → Authentication → Password security → enable "Check
against HaveIBeenPwned".** Blocks users from choosing known-breached passwords,
which is the other half of credential-stuffing resistance. Free to enable.

## What the code already does (defence-in-depth, not a boundary)

- The `/auth/login/*` advisory lockout still runs and now shares its counter
  across serverless instances (see M4 / `PgRateLimitStore`), so it's a
  consistent signal for our own UX ("account temporarily locked") and telemetry
  — just don't rely on it as the enforcement point.
- Turnstile + Supabase rate limits above are the real boundary.

## Verifying

After enabling, attempt >N rapid logins for one account from a script that calls
GoTrue directly (bypassing our frontend): Supabase should start returning
CAPTCHA-required / rate-limit errors. Before enabling, the same script runs
unthrottled — that difference is the fix.
