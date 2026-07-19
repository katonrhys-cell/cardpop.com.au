# Database region migration runbook

**Goal:** move the Supabase project from its current region (`ap-northeast-1`, Tokyo) to `ap-southeast-2` (Sydney) to cut ~100 ms of latency for the Australian audience.

> **Read this first.** A Supabase project's region **cannot be changed in place** — there is no setting for it. "Changing region" means **standing up a brand-new project in Sydney and migrating everything into it**, then repointing the app. It involves **downtime**, a **new project URL + keys**, and ~10 code/config repoint points. For ~100 ms this is only worth doing deliberately (e.g. as part of a bigger AU push), not casually. If you only care about smoothing the occasional restart blip, the retry wrapper in `lib/supabaseClient.js` plus a Supabase maintenance window get you most of the resilience for none of the risk.

The current project ref is `odoglvswwymyjuwlonkf`. Throughout, `<NEW_REF>` is the new Sydney project's ref.

---

## 0. Preconditions

- [ ] A fresh, verified full backup exists (`docs/backup-and-restore.md`) **including** `verification-docs` this once (`INCLUDE_SENSITIVE=1`), stored encrypted.
- [ ] A low-traffic maintenance window is chosen and announced (expect 30–60 min of read-only/degraded service).
- [ ] You have the `SUPABASE_SERVICE_ROLE_KEY`, DB password, and admin access to Vercel, Cloudflare, and the Google/GitHub/Facebook developer consoles.

## 1. Create the new project

1. Supabase Dashboard → New project → **Region: Southeast Asia (Sydney) `ap-southeast-2`**. Match the Postgres major version (17) and pick a compute tier ≥ the current one.
2. Record the new **project URL** (`https://<NEW_REF>.supabase.co`), **anon key**, **service-role key**, and **DB password**.

## 2. Migrate the schema

The repo migrations are the source of truth, so build the schema from them rather than replaying a dump:

```bash
supabase link --project-ref <NEW_REF>
supabase db push            # applies everything in supabase/migrations/
```

If the live schema has drifted from the repo, reconcile the repo first — do **not** hand-edit the new project.

## 3. Migrate the data

```bash
# roles first (grants/ownership), then data
psql "postgresql://postgres:<NEW_DB_PASSWORD>@db.<NEW_REF>.supabase.co:5432/postgres" -f roles.sql
psql "postgresql://postgres:<NEW_DB_PASSWORD>@db.<NEW_REF>.supabase.co:5432/postgres" -f data.sql
```

### Auth users

`auth.users` is not in the public-schema data. Dump and load the auth schema explicitly from the source project:

```bash
supabase db dump --schema auth -f auth.sql       # against the OLD project
psql "postgresql://postgres:<NEW_DB_PASSWORD>@db.<NEW_REF>.supabase.co:5432/postgres" -f auth.sql
```

Verify row counts match (`select count(*) from auth.users;`) on both projects before cutover.

## 4. Migrate storage

Download from old, re-upload to new. Reuse the backup helper for the download, then upload with a mirror of it (or `rclone`/`supabase storage cp` if you prefer):

```bash
# download from OLD (already done in your backup)
SUPABASE_URL=https://odoglvswwymyjuwlonkf.supabase.co SUPABASE_SERVICE_ROLE_KEY=<old-service-key> \
  node scripts/backup-storage.mjs --out ./migrate/storage --include-sensitive

# create the buckets on NEW (same names, same public/private flags) then upload each object
# to <NEW_REF> with cacheControl '31536000' (see scripts/backfill-image-cache-headers.mjs for the upload pattern)
```

Buckets to recreate: `ai-images`, `avatars`, `categories`, `events`, `media`, `vault-images` (public), `verification-docs` (private).

## 5. Repoint the application — code

The old ref is **hardcoded** in several files. Search-and-replace `odoglvswwymyjuwlonkf` → `<NEW_REF>` and the old anon key → the new one. Files that reference it today:

- [ ] `lib/supabaseClient.js` — frontend client URL + anon-key fallback
- [ ] `api/prerender.js` — SSR/OG client URL + anon key
- [ ] `api/sitemap.js`
- [ ] `src/utils/supabaseClient.js` — backend client fallback
- [ ] `src/routes/integrated-ai.js`
- [ ] `components/Header.jsx`
- [ ] `public/sw.js` — service-worker storage-URL cache matcher
- [ ] `cloudflare/image-proxy-worker.js` — `ORIGIN` constant (redeploy the worker after)
- [ ] `supabase/config.toml` — `project_id`
- [ ] `vercel.json`
- [ ] tests: `tests/frontend/imageUrl.test.js`, `tests/backend/imageProxyWorker.test.js`, `tests/backend/integrated-ai.test.js`

> Confirm the list is current before you start: `grep -rn odoglvswwymyjuwlonkf --include='*.js' --include='*.jsx' --include='*.toml' --include='*.json' . | grep -v node_modules`

## 6. Repoint the application — config & third parties

- [ ] **Vercel env vars** (Settings → Environment Variables): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` → new values. If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set as build-time vars, update them too (otherwise the hardcoded fallbacks from step 5 apply).
- [ ] **CI secret** `SUPABASE_DB_PASSWORD` (and re-link `SUPABASE_ACCESS_TOKEN` scope if the token is project-scoped) so `.github/workflows/supabase-migrations.yml` targets the new project.
- [ ] **OAuth redirect URLs** — the callback is `https://<NEW_REF>.supabase.co/auth/v1/callback`. Update the authorized redirect URIs in the **Google**, **GitHub**, and **Facebook** app consoles, and re-enter each provider's client id/secret in the new project's Auth settings (`docs/oauth-login.md`).
- [ ] **Auth URL config** — set Site URL and additional redirect URLs (`https://cardpop.com.au/**`) on the new project.
- [ ] **Auth email** — reconfigure SMTP/Resend and the email templates on the new project (they don't migrate with the DB).
- [ ] **Image CDN** — after redeploying the Cloudflare worker with the new `ORIGIN`, confirm `img.cardpop.com.au` serves from `<NEW_REF>`. If R2 is used as the fast path, its objects are keyed by path and stay valid.
- [ ] **Stored image URLs** — `image_url` columns hold canonical `odoglvswwymyjuwlonkf.supabase.co` URLs. They still resolve via the CDN rewrite (same `/storage/v1/...` path), but any direct consumer breaks. Rewrite them to the new host once data is loaded:
  ```sql
  update <table> set image_url =
    replace(image_url, 'odoglvswwymyjuwlonkf.supabase.co', '<NEW_REF>.supabase.co')
  where image_url like '%odoglvswwymyjuwlonkf.supabase.co%';
  ```
  Apply per table that stores URLs (avatars, vault images, categories, events, blog, hero cards, shop products).
- [ ] Regenerate `SUPABASE_ACCESS_TOKEN`-dependent tooling / any local `supabase link`.

## 7. Verify (on a preview deploy, before cutover)

- [ ] Row counts and `auth.users` count match old ↔ new.
- [ ] Sign-in works for email + each OAuth provider.
- [ ] Images load (both CDN and direct), uploads write to the new buckets.
- [ ] A test order / checkout path succeeds (Stripe keys are unchanged, but the webhook writes to the new DB).
- [ ] `supabase db push` reports no pending migrations against the new project.
- [ ] `get_advisors` (security + performance) on the new project is clean.

## 8. Cutover

1. Put the site into maintenance (or accept brief read-only) and take a **final** delta backup of the old DB.
2. Load any rows written since step 3 (or re-run data load if the window was short and writes were paused).
3. Deploy the repointed code to production (merge to `main` → Vercel builds).
4. Smoke-test production against the checklist in step 7.
5. Keep the old project **paused, not deleted**, for at least a week as rollback.

## 9. Rollback

If a blocker appears post-cutover: revert the repoint commit (Vercel redeploys the old-ref build) and un-pause the old project. Because the old project was only paused, this is a minutes-not-hours recovery. Discard the new project once the new one is proven over several days.

---

### Cost/benefit reminder

This is a genuine production migration with downtime and ~20 discrete steps for ~100 ms of latency. Do it when you're consolidating on AU infrastructure anyway. If the trigger was the restart/503 blip, the retry wrapper (`lib/supabaseClient.js`) plus a Supabase maintenance window is the cheaper, safer answer.
