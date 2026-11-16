-- Card shop ownership.
--
-- CardPop builds each shop's page in the directory (/card-shops/<city>/<slug>);
-- the shop's real owner can then apply to take it over — the same path an event
-- organiser takes for their organiser page (20261110224209). A signed-in member
-- with a confirmed email asks to be the owner of a listed shop, an admin
-- confirms them (Admin → Store Directory), and approval makes the member the
-- OWNER of that `local_game_stores` row, who may then edit the page's public
-- details: address, phone, links, description, opening hours, what it stocks,
-- logo, photos and videos.
--
-- What an owner can NOT do, enforced here and not in the UI:
--   * change the shop's name, slug, city or state (the slug and city are the
--     public URL), its status, its owner, or the submitter columns;
--   * insert or delete a shop;
--   * create or decide a request — those writes go through the Express route
--     (service role), so store_owner_requests has no browser write policy.
-- One member may own several shops (a chain); a shop has one owner.
--
-- docs/store-pages.md

-- ── 1. The shop: owner ──────────────────────────────────────────────────────
alter table public.local_game_stores
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists local_game_stores_owner_idx
  on public.local_game_stores (owner_id) where owner_id is not null;

comment on column public.local_game_stores.owner_id is
  'The member an admin approved to manage this shop page (store_owner_requests). Never writable by the owner — see guard trigger.';

-- Public: a page shows "Is this your shop?" only while it has no owner.
grant select (owner_id) on public.local_game_stores to anon, authenticated;

-- One UPDATE policy: admins, or the shop's owner.
drop policy if exists "Admins can update stores" on public.local_game_stores;
drop policy if exists "local_game_stores_update_access" on public.local_game_stores;
create policy "local_game_stores_update_access"
  on public.local_game_stores for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    owner_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- ...but an owner only changes the page's public details. The service role
-- (auth.uid() is null) and admins pass untouched.
create or replace function public.local_game_stores_owner_guard()
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
  new.name            := old.name;
  new.slug            := old.slug;
  new.city            := old.city;
  new.state           := old.state;
  new.status          := old.status;
  new.owner_id        := old.owner_id;
  new.submitter_email := old.submitter_email;
  new.submitted_by    := old.submitted_by;
  new.created_at      := old.created_at;
  return new;
end;
$function$;

drop trigger if exists trg_local_game_stores_owner_guard on public.local_game_stores;
create trigger trg_local_game_stores_owner_guard
  before update on public.local_game_stores
  for each row execute function public.local_game_stores_owner_guard();

-- ── 2. The requests ─────────────────────────────────────────────────────────
create table if not exists public.store_owner_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  store_id        uuid not null references public.local_game_stores(id) on delete cascade,
  -- Their role at the shop and a link that helps an admin check it is them.
  role_title      text check (role_title is null or char_length(role_title) <= 80),
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

-- One open request per person per shop; a rejected one can be re-submitted.
create unique index if not exists store_owner_requests_one_pending
  on public.store_owner_requests (user_id, store_id) where status = 'pending';
create index if not exists store_owner_requests_status_idx
  on public.store_owner_requests (status, created_at desc);
create index if not exists store_owner_requests_store_idx
  on public.store_owner_requests (store_id);
create index if not exists store_owner_requests_reviewed_by_idx
  on public.store_owner_requests (reviewed_by);

comment on table public.store_owner_requests is
  'Member requests to own a card shop page, confirmed by an admin. Written only by the Express API (service role) — src/routes/store-owner-requests.js.';

alter table public.store_owner_requests enable row level security;

-- A member reads their own requests; admins read through the admin API, which
-- also joins the applicant's contact details. No browser write policies.
drop policy if exists "Members read their store owner requests" on public.store_owner_requests;
create policy "Members read their store owner requests"
  on public.store_owner_requests for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.store_owner_requests from anon;
revoke insert, update, delete on public.store_owner_requests from authenticated;
grant select on public.store_owner_requests to authenticated;

-- ── 3. Uploads: an owner adds photos to their own shop's folder ─────────────
-- The `media` bucket is otherwise admin-only (media_admin_all). An owner may
-- add objects under stores/<their shop's slug>/ — insert only; replacing or
-- deleting stays with admins (paths are immutable, see docs/image-cdn.md).
drop policy if exists "store_owner_media_insert" on storage.objects;
create policy "store_owner_media_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(objects.name))[1] = 'stores'
    and exists (
      select 1 from public.local_game_stores s
      -- objects.name, qualified: a bare `name` here would be the shop's name.
      where s.slug = (storage.foldername(objects.name))[2]
        and s.owner_id = (select auth.uid())
    )
  );

-- ── 4. Notification types ───────────────────────────────────────────────────
-- Used at runtime only (after this commits).
alter type public.notification_type add value if not exists 'store_owner_request';
alter type public.notification_type add value if not exists 'store_owner_approved';
alter type public.notification_type add value if not exists 'store_owner_rejected';
