-- Organiser pages: TikTok, X and Linktree links.
--
-- event_organisers already carries website / Instagram / Facebook / YouTube
-- (20261110224209_event_organiser_requests.sql). The owner edits these from
-- "Edit page" on /events/organisers/<slug>; the owner guard trigger only pins
-- name / slug / owner / created_at, so no policy or grant change is needed.

alter table public.event_organisers
  add column if not exists tiktok_url   text check (tiktok_url   is null or tiktok_url   ~* '^https?://[^[:space:]]+$'),
  add column if not exists x_url        text check (x_url        is null or x_url        ~* '^https?://[^[:space:]]+$'),
  add column if not exists linktree_url text check (linktree_url is null or linktree_url ~* '^https?://[^[:space:]]+$');

comment on column public.event_organisers.tiktok_url is
  'Organiser TikTok profile (http(s) only), shown as an icon button on the organiser page and in its Organization sameAs.';
comment on column public.event_organisers.x_url is
  'Organiser X (Twitter) profile (http(s) only), shown as an icon button on the organiser page and in its Organization sameAs.';
comment on column public.event_organisers.linktree_url is
  'Organiser Linktree (or similar link-in-bio page), http(s) only, shown as an icon button on the organiser page and in its Organization sameAs.';
