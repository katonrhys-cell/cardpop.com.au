-- Mirror profiles.is_admin into auth.users app_metadata so the backend's JWT
-- claim check (app_metadata.is_admin) authorizes admins on the fast path. The
-- application already falls back to a profiles.is_admin lookup (isAdminUser in
-- src/middleware/auth.js), so this keeps the JWT claim in sync and lets a user's
-- refreshed token carry admin status without a per-request DB lookup.
--
-- The trigger fires whenever profiles.is_admin is inserted/updated, so the
-- existing "Make Admin" flow (which only writes profiles.is_admin) keeps the
-- JWT claim in sync automatically — no application code change required.
--
-- Note: app_metadata is baked into a user's JWT at sign-in, so an already
-- logged-in user picks up the change on their next token refresh / re-login;
-- until then the isAdminUser profiles fallback covers them.

create or replace function public.sync_admin_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('is_admin', coalesce(new.is_admin, false))
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_admin_app_metadata on public.profiles;
create trigger trg_sync_admin_app_metadata
  after insert or update of is_admin on public.profiles
  for each row
  execute function public.sync_admin_app_metadata();

-- One-time backfill: align existing users' app_metadata with their profile flag.
update auth.users u
   set raw_app_meta_data =
         coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('is_admin', coalesce(p.is_admin, false))
  from public.profiles p
 where p.id = u.id
   and coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false)
       is distinct from coalesce(p.is_admin, false);

-- Rollback (manual):
--   drop trigger if exists trg_sync_admin_app_metadata on public.profiles;
--   drop function if exists public.sync_admin_app_metadata();
