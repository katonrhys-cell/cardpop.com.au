-- Fix schema drift: re-point user_verifications foreign keys at public.profiles.
--
-- The admin Verification Management dashboard
-- (pages/admin/AdminVerificationDashboard.jsx) loads submissions with a
-- PostgREST embed that names the constraint explicitly:
--   .select('*, profile:profiles!user_verifications_user_id_fkey(...)')
-- That hint means "embed public.profiles by following the constraint
-- user_verifications_user_id_fkey". It only resolves if that constraint
-- actually targets public.profiles.
--
-- The original migration (20260706140841_create_user_verifications.sql)
-- declared `user_id ... references public.profiles(id)`, but it used
-- `create table if not exists` and the table already existed in production
-- (hand-created via the dashboard before it was committed as a migration).
-- So the migration was a no-op there and the live FK was never corrected --
-- it still points at auth.users:
--   user_verifications_user_id_fkey  FOREIGN KEY (user_id) REFERENCES auth.users(id)
-- PostgREST therefore cannot embed profiles through that hint and returns a
-- PGRST200 "could not find a relationship" error, which the dashboard surfaces
-- as the toast "Failed to load verifications".
--
-- Re-point both FKs at public.profiles to match the repo's declared schema.
-- This is safe: profiles.id is itself a FK onto auth.users.id, so a profiles
-- row exists for every user_id / admin_id value already stored here -- no
-- orphan rows can block the new constraints. The constraint keeps its original
-- name so the frontend embed hint keeps working unchanged.

do $$
begin
  -- user_id -> profiles(id), ON DELETE CASCADE (matches original intent).
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_verifications'::regclass
      and conname = 'user_verifications_user_id_fkey'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.user_verifications
      drop constraint user_verifications_user_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_verifications'::regclass
      and conname = 'user_verifications_user_id_fkey'
  ) then
    alter table public.user_verifications
      add constraint user_verifications_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;

  -- admin_id -> profiles(id) (nullable; no cascade, matches original intent).
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_verifications'::regclass
      and conname = 'user_verifications_admin_id_fkey'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.user_verifications
      drop constraint user_verifications_admin_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_verifications'::regclass
      and conname = 'user_verifications_admin_id_fkey'
  ) then
    alter table public.user_verifications
      add constraint user_verifications_admin_id_fkey
      foreign key (admin_id) references public.profiles(id);
  end if;
end $$;
