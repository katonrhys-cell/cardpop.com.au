# Social login (OAuth)

CardPop lets people sign in / sign up with **Google**, **GitHub** and
**Facebook** in addition to email + password. This doc explains how the flow
works in the code and — the part that needs manual work — how to switch a
provider on. It walks through **Facebook** end to end; Google and GitHub follow
the identical Supabase pattern with a different developer console.

## How it works in the app (already built)

There is no code to write to add a provider button — it's all wired already:

- **`components/OAuthButtons.jsx`** renders one button per entry in its
  `OAUTH_PROVIDERS` list (Google, GitHub, Facebook). A click calls
  `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`, which
  redirects the browser to the provider.
- The provider sends the user back to Supabase's callback
  (`https://vrfsaazuqjxotnieqlkd.supabase.co/auth/v1/callback`), which creates
  the Supabase session and redirects to `redirectTo` — `/account` for both the
  login and signup pages (`pages/LoginPage.jsx`, `pages/SignupPage.jsx`).
- `lib/supabaseClient.js` has `detectSessionInUrl: true`, so on return the
  session is picked up automatically and `contexts/AuthContext.jsx`'s
  `onAuthStateChange` loads the profile. No `/auth/callback` route is needed.

**A button only works once its provider is enabled in Supabase.** Clicking a
button for a provider that isn't configured just shows an error toast. So the
Facebook button already ships — the remaining work below is all in the Meta and
Supabase dashboards.

## What happens to a profile on first sign-in

When Supabase creates the `auth.users` row, a database trigger
(`on_auth_user_created` → `public.handle_new_user()`) inserts the matching
`public.profiles` row. `profiles.username` is `NOT NULL` **and** `UNIQUE`, and
the function derives a username from the OAuth data:

1. an explicit `username` (only email/password signups send one), else
2. the part of the email before `@`, else
3. the alphanumeric of the person's name, else
4. the literal `user`

…then appends `-1`, `-2`, … if that name is already taken.

The multi-step fallback matters **specifically for Facebook**: Facebook can
complete login *without an email address* (the user declines the email
permission, or the account only has a phone number). The earlier version of the
trigger derived the username from the email alone, so a Facebook user with no
email produced a `NULL` username and the **entire signup failed**. The hardened
trigger lives in
`supabase/migrations/20260712010000_harden_handle_new_user_oauth.sql` and always
produces a valid, unique username. It applies to production automatically when
that migration merges to `main` (via `.github/workflows/supabase-migrations.yml`).

---

## Enabling Facebook login — step by step

You need two dashboards: **Meta for Developers** (to create the Facebook app)
and **Supabase** (to store its credentials). Do them in this order.

### 1. Create a Facebook app

1. Go to <https://developers.facebook.com/> and log in with the Facebook
   account that manages the CardPop page. Accept the developer terms if prompted.
2. **My Apps → Create App**.
3. For "Use case", choose **Authenticate and request data from users with
   Facebook Login**, then **Next**.
4. App type: **Consumer** (a normal public website). Continue.
5. Name it (e.g. `CardPop`), set the contact email, **Create app**.

### 2. Add the Facebook Login product

1. In the app's left sidebar, find **Facebook Login → Settings** (add the
   product if it isn't there yet — **Add Product → Facebook Login → Set up**).
2. In **Valid OAuth Redirect URIs**, paste the Supabase callback URL exactly:

   ```
   https://vrfsaazuqjxotnieqlkd.supabase.co/auth/v1/callback
   ```

3. Leave **Client OAuth Login**, **Web OAuth Login** and **Enforce HTTPS**
   enabled (the defaults). **Save changes**.

### 3. Grab the App ID and App Secret

1. **App settings → Basic** (left sidebar).
2. Copy the **App ID**.
3. Next to **App Secret**, click **Show**, confirm your password, copy it.
   Treat the secret like a password — it goes only into Supabase, never into
   the repo or the browser.
4. While on this page, fill in the required fields so the app can go live:
   - **App Domains**: `cardpop.com.au`
   - **Privacy Policy URL**: `https://cardpop.com.au/privacy` (Facebook won't
     let you go Live without one)
   - **Site URL** (under Website, if shown): `https://cardpop.com.au`
   - Category: pick the closest (e.g. Shopping). **Save changes**.

### 4. Put the credentials into Supabase

1. Open the Supabase dashboard → project **vrfsaazuqjxotnieqlkd** →
   **Authentication → Providers → Facebook**.
   (Direct: <https://supabase.com/dashboard/project/vrfsaazuqjxotnieqlkd/auth/providers>)
2. Toggle **Enable Facebook** on.
3. Paste the **App ID** into **Facebook client ID** and the **App Secret** into
   **Facebook secret**.
4. Confirm the **Callback URL (for OAuth)** shown here matches the one you
   pasted into Facebook in step 2. **Save**.

### 5. Check the redirect allow-list

Supabase only redirects back to approved URLs after login.

1. **Authentication → URL Configuration**.
2. **Site URL**: `https://cardpop.com.au`.
3. Under **Redirect URLs**, make sure these are present (add any missing):
   - `https://cardpop.com.au/**`
   - `http://localhost:3000/**` (for local development)

   The `/**` wildcard covers `/account` and every other in-app return path the
   buttons use.

### 6. Take the Facebook app Live

While the app is in **Development** mode, only people with a role on the app
(admins/testers) can log in — everyone else gets "app not active".

1. Top of the Meta dashboard, flip the mode toggle from **Development** to
   **Live**. Provide the privacy policy URL if it asks.
2. `email` and `public_profile` (the only permissions this flow uses) are
   granted **without App Review**, so no review submission is needed just to let
   people log in.

### 7. Test it

1. On <https://cardpop.com.au/login> or `/signup`, click **Continue with
   Facebook**.
2. Approve the Facebook consent screen.
3. You should land back on `/account`, signed in, with a profile created.
4. Sanity-check the new row (safe read-only query):

   ```sql
   select id, username, display_name, created_at
   from public.profiles
   order by created_at desc
   limit 5;
   ```

   To specifically prove the no-email path is safe, test with a Facebook account
   that has no email (or decline the email permission on the consent screen) —
   the account should still be created with a `user`-style username, not error.

---

## Google / GitHub

Same Supabase steps (4–5), different console for steps 1–3:

- **Google**: Google Cloud Console → APIs & Services → Credentials → OAuth
  client ID (Web application). Authorised redirect URI is the same Supabase
  `/auth/v1/callback`. Paste client ID/secret into Supabase → Providers →
  Google.
- **GitHub**: GitHub → Settings → Developer settings → OAuth Apps → New OAuth
  App. "Authorization callback URL" is the same Supabase callback. Paste client
  ID/secret into Supabase → Providers → GitHub.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Button shows "Unsupported provider" or an error toast | Provider not enabled in Supabase (step 4). |
| "URL blocked: redirect URI is not whitelisted" (Facebook) | The Supabase callback URL isn't in Facebook's **Valid OAuth Redirect URIs** (step 2), or has a typo. |
| Lands on a Supabase error page after consent, not `/account` | `redirectTo` isn't in Supabase's **Redirect URLs** allow-list (step 5). |
| "App not active" / only you can log in | App still in **Development** mode — take it Live (step 6). |
| Login works but no profile / user stuck | Check the `handle_new_user` trigger is the hardened version (the migration above has merged). |
