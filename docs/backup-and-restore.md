# Manual backup & restore

CardPop's data lives in three places. Only two of them need backing up:

| Part | Lives in | Backup story |
|---|---|---|
| **Application code** | GitHub | Already backed up on every commit — nothing to do. |
| **Database** (~75 MB, 78 tables) | Supabase Postgres | **The irreplaceable part.** Captured by `supabase db dump`. |
| **Storage** (~98 MB, 7 buckets) | Supabase Storage | Card images, avatars, etc. Captured by `scripts/backup-storage.mjs`. |

Supabase's own automated backups (daily on the paid plans, plus PITR) still exist and are your first line of recovery. This manual backup is a belt-and-braces, off-Supabase copy you control — handy before risky changes and **required as step 1 of a region migration** (see `docs/database-region-migration.md`).

## What you get

`scripts/backup-supabase.sh` produces a single archive:

```
cardpop-backup-<UTC-timestamp>.tar.gz
├── roles.sql      # database roles (grants/ownership)
├── schema.sql     # tables, RLS policies, functions, triggers, enums …
├── data.sql       # every row
├── storage/       # every Storage object, by bucket/path
└── MANIFEST.txt   # what this archive is + when it was made
```

### Sensitive data — `verification-docs`

The `verification-docs` bucket holds **customer identity documents** (passport / licence scans). The backup **excludes it by default** so routine backups never drop PII into Google Drive or a laptop. Only include it with a deliberate, secured reason:

```bash
INCLUDE_SENSITIVE=1 ./scripts/backup-supabase.sh
```

If you do, **encrypt the archive** and keep it out of any shared or auto-syncing Drive folder.

## Prerequisites (one-time)

```bash
npm i -g supabase                 # or rely on the npx fallback in the script
supabase login
supabase link --project-ref odoglvswwymyjuwlonkf

export SUPABASE_URL=https://odoglvswwymyjuwlonkf.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Dashboard → Settings → API
```

`supabase db dump` will prompt for the database password (Dashboard → Settings → Database).

## Run it

```bash
./scripts/backup-supabase.sh
```

The DB is small, so this finishes in well under a minute and prints the archive path.

## Upload to Google Drive (the "manual" bit)

Drag `backups/cardpop-backup-<timestamp>.tar.gz` into the existing **"cardpop.com.au- site backup"** folder in Google Drive. That's it — the backup is now off-platform.

> `backups/` is git-ignored: dumps contain real data (and potentially PII) and must never be committed.

### Cadence

A monthly manual archive plus Supabase's automated daily backups is plenty for a project this size. Always take a fresh one immediately before a migration or a bulk data change.

## Restore

### Into a fresh/empty Supabase project

The repo migrations are the source of truth for schema, so the cleanest rebuild is schema-from-migrations + data-from-dump:

```bash
supabase link --project-ref <target-ref>
supabase db push                    # builds schema from supabase/migrations/
psql "<target-connection-string>" -f data.sql
```

If you'd rather restore the captured schema verbatim (e.g. the dump is newer than the repo), load the SQL files in order instead:

```bash
psql "<target-connection-string>" -f roles.sql
psql "<target-connection-string>" -f schema.sql
psql "<target-connection-string>" -f data.sql
```

Then re-upload storage (see the region-migration runbook for the loop) and reconfigure dashboard settings (Auth providers, secrets, redirect URLs) — those live outside the database and are **not** in this backup.

### Single table / partial recovery

`data.sql` is plain SQL `COPY`/`INSERT` statements — you can pull one table's block out and replay just that, or restore into a scratch database and `SELECT` what you need rather than clobbering production.

## What this does NOT cover

- Vercel environment variables and Supabase dashboard settings (secrets, SMTP, OAuth apps, redirect URLs, edge functions, cron). Recreate these from `CLAUDE.md` / `docs/`.
- Anything already in GitHub (all application code).
