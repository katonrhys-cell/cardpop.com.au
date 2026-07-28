-- Whatnot Shows: fix the profiles embed, and give admins moderation controls.
--
-- Background
-- ----------
-- public.whatnot_shows was hand-created in the dashboard before this repo was
-- the source of truth, so it has never had a `create table` migration. The
-- statements below are all idempotent and are no-ops against production where
-- the object already exists; the `create table if not exists` is included so a
-- fresh database ends up with the same shape as production.
--
-- 1. FK repoint (the "Couldn't load shows" bug)
--    pages/community/WhatnotShowsPage.jsx loads shows with a PostgREST embed:
--      .select('*, profiles:user_id(...)')
--    That only resolves if whatnot_shows.user_id has a foreign key onto
--    public.profiles. In production it points at auth.users instead:
--      whatnot_shows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
--    so PostgREST returns PGRST200 ("could not find a relationship") and the
--    page renders its "Couldn't load shows" error state for every visitor.
--    Re-pointing at public.profiles is safe: profiles.id is itself a FK onto
--    auth.users.id, so a profiles row already exists for every stored user_id
--    and no orphan can block the new constraint. Same fix, same reasoning as
--    20260721211051_repoint_user_verifications_fks_to_profiles.sql.
--
-- 2. Admin moderation columns
--    Shows stay self-serve — a member's listing goes live the moment they save
--    it, no approval queue. `admin_hidden` is the admin override that pulls a
--    listing from the public directory, kept separate from the member-owned
--    `is_active` flag so an admin takedown can't be undone by the member
--    toggling their own listing back on.

-- 0. Make sure RLS is on ------------------------------------------------------
-- The table itself is declared in 20260708035638_cleet_whatnot_link_and_shows.sql,
-- the first migration that touches it.
alter table public.whatnot_shows enable row level security;

-- 1. Re-point user_id at public.profiles -------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.whatnot_shows'::regclass
      and conname  = 'whatnot_shows_user_id_fkey'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.whatnot_shows drop constraint whatnot_shows_user_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whatnot_shows'::regclass
      and conname  = 'whatnot_shows_user_id_fkey'
  ) then
    alter table public.whatnot_shows
      add constraint whatnot_shows_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- 2. Admin moderation columns -------------------------------------------------
alter table public.whatnot_shows
  add column if not exists admin_hidden boolean not null default false,
  add column if not exists is_featured  boolean not null default false,
  add column if not exists admin_note   text;

comment on column public.whatnot_shows.admin_hidden is
  'Admin takedown. Hides the show from the public directory regardless of the owner''s is_active flag.';
comment on column public.whatnot_shows.is_featured is
  'Admin pin. Featured shows sort to the top of the public Whatnot directory.';
comment on column public.whatnot_shows.admin_note is
  'Internal moderation note. Never rendered to members.';

-- 3. Indexes ------------------------------------------------------------------
create index if not exists whatnot_shows_user_id_idx   on public.whatnot_shows (user_id);
create index if not exists whatnot_shows_directory_idx on public.whatnot_shows (show_date)
  where is_active and not admin_hidden;

-- 4. RLS ----------------------------------------------------------------------
-- Public directory: live shows only. Owners always see their own rows (so a
-- hidden listing still shows up under My Shows), and admins see everything.
drop policy if exists "whatnot_shows_select_access" on public.whatnot_shows;
create policy "whatnot_shows_select_access" on public.whatnot_shows
  as permissive for select to public
  using (
    (is_active = true and admin_hidden = false)
    or (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

-- Owners keep full control of their own listings; admins can act on any row.
-- Each policy drops both the old dashboard-era name and the new one, so the
-- migration stays re-runnable (a second pass has already renamed them).
drop policy if exists "Users can insert their own shows" on public.whatnot_shows;
drop policy if exists "whatnot_shows_insert_access" on public.whatnot_shows;
create policy "whatnot_shows_insert_access" on public.whatnot_shows
  as permissive for insert to public
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own shows" on public.whatnot_shows;
drop policy if exists "whatnot_shows_update_access" on public.whatnot_shows;
create policy "whatnot_shows_update_access" on public.whatnot_shows
  as permissive for update to public
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

drop policy if exists "Users can delete their own shows" on public.whatnot_shows;
drop policy if exists "whatnot_shows_delete_access" on public.whatnot_shows;
create policy "whatnot_shows_delete_access" on public.whatnot_shows
  as permissive for delete to public
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

-- 5. Protect the moderation columns from their owner --------------------------
-- RLS can't express "you may update this row but not these three columns": for
-- UPDATE, an omitted WITH CHECK falls back to the USING expression, which the
-- owner satisfies whatever values they write. So a member could otherwise clear
-- their own admin_hidden takedown or self-promote to is_featured. A BEFORE
-- UPDATE trigger restores the stored values unless the caller is an admin.
-- auth.uid() is null for the service-role/backend client, which is trusted and
-- passes through unchanged.
create or replace function public.guard_whatnot_show_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A member can't publish straight into a moderated state.
    new.admin_hidden := false;
    new.is_featured  := false;
    new.admin_note   := null;
  else
    new.admin_hidden := old.admin_hidden;
    new.is_featured  := old.is_featured;
    new.admin_note   := old.admin_note;
  end if;
  return new;
end $$;

drop trigger if exists whatnot_shows_guard_moderation on public.whatnot_shows;
create trigger whatnot_shows_guard_moderation
  before insert or update on public.whatnot_shows
  for each row execute function public.guard_whatnot_show_moderation();
