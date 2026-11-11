-- Event organiser access requests.
--
-- A member says they run events (at sign-up, or later from Account → My Events)
-- and asks to manage an organiser page. Nothing is granted until an admin
-- confirms them (Admin → Organiser Requests). Approval makes the member the
-- OWNER of an `event_organisers` row — a new one, or an existing directory
-- entry they are claiming — and the owner may then edit that page's public
-- profile: logo, description and links.
--
-- Ownership is a column on the page, not a flag on the profile, so the
-- profiles self-update policy needn't change and one account can own the page
-- it was approved for and nothing else.
--
-- What an owner can NOT do, enforced here and not in the UI:
--   * change the organiser's name or slug (events match the page by name, and
--     slugs are the public URL), the owner, or created_at;
--   * insert or delete an organiser page;
--   * create, approve or edit a request — those writes go through the Express
--     routes (service role), so there is no browser INSERT/UPDATE policy.
-- Admins keep full control through the existing "Admins manage event
-- organisers" policy.
--
-- docs/event-organiser-access.md

-- ── 1. The organiser page: owner + public profile ───────────────────────────
alter table public.event_organisers
  add column if not exists owner_id      uuid references auth.users(id) on delete set null,
  add column if not exists description   text check (description is null or char_length(description) <= 2000),
  add column if not exists website_url   text check (website_url   is null or website_url   ~* '^https?://[^[:space:]]+$'),
  add column if not exists instagram_url text check (instagram_url is null or instagram_url ~* '^https?://[^[:space:]]+$'),
  add column if not exists facebook_url  text check (facebook_url  is null or facebook_url  ~* '^https?://[^[:space:]]+$'),
  add column if not exists youtube_url   text check (youtube_url   is null or youtube_url   ~* '^https?://[^[:space:]]+$');

-- A person owns at most one organiser page; a page has one owner.
create unique index if not exists event_organisers_owner_key
  on public.event_organisers (owner_id) where owner_id is not null;

comment on column public.event_organisers.owner_id is
  'The member an admin approved to manage this page (organiser_requests). Never writable by the owner — see guard trigger.';

-- Owner may update their own page...
drop policy if exists "Owners edit their organiser page" on public.event_organisers;
create policy "Owners edit their organiser page"
  on public.event_organisers for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ...but only the public-profile columns. The service role (auth.uid() is
-- null) and admins pass untouched.
create or replace function public.event_organisers_owner_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;                       -- service role / migrations
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.is_admin = true) then
    return new;
  end if;

  -- Everyone else is an owner editing their page (RLS has already checked).
  new.name       := old.name;
  new.slug       := old.slug;
  new.owner_id   := old.owner_id;
  new.created_at := old.created_at;
  return new;
end;
$function$;

drop trigger if exists trg_event_organisers_owner_guard on public.event_organisers;
create trigger trg_event_organisers_owner_guard
  before update on public.event_organisers
  for each row execute function public.event_organisers_owner_guard();

-- ── 2. The requests ─────────────────────────────────────────────────────────
create table if not exists public.organiser_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- What they call themselves, and optionally the directory entry they say is theirs.
  organiser_name  text not null check (char_length(btrim(organiser_name)) between 1 and 120),
  organiser_id    uuid references public.event_organisers(id) on delete set null,
  website_url     text check (website_url is null or website_url ~* '^https?://[^[:space:]]+$'),
  message         text check (message is null or char_length(message) <= 1000),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Shown to the applicant on a rejection.
  decision_note   text check (decision_note is null or char_length(decision_note) <= 1000),
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One open request per person at a time; a rejected one can be re-submitted.
create unique index if not exists organiser_requests_one_pending
  on public.organiser_requests (user_id) where status = 'pending';
create index if not exists organiser_requests_status_idx
  on public.organiser_requests (status, created_at desc);
create index if not exists organiser_requests_user_idx
  on public.organiser_requests (user_id);
create index if not exists organiser_requests_organiser_idx
  on public.organiser_requests (organiser_id);
create index if not exists organiser_requests_reviewed_by_idx
  on public.organiser_requests (reviewed_by);

comment on table public.organiser_requests is
  'Member requests to manage an event organiser page, confirmed by an admin. Written only by the Express API (service role) — src/routes/organiser-requests.js.';

alter table public.organiser_requests enable row level security;

-- A member reads their own requests (drives the card in Account → My Events).
-- Admins read through the admin API, which also joins the applicant's contact
-- details; there are no browser write policies on purpose.
drop policy if exists "Members read their organiser requests" on public.organiser_requests;
create policy "Members read their organiser requests"
  on public.organiser_requests for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.organiser_requests from anon;
revoke insert, update, delete on public.organiser_requests from authenticated;
grant select on public.organiser_requests to authenticated;

-- ── 3. Notification types ───────────────────────────────────────────────────
-- Used at runtime only (after this commits).
alter type public.notification_type add value if not exists 'organiser_request';
alter type public.notification_type add value if not exists 'organiser_approved';
alter type public.notification_type add value if not exists 'organiser_rejected';
