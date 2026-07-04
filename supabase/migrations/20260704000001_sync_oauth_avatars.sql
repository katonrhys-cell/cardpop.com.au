-- Copy OAuth (Google) profile photos into public.profiles.avatar_url.
--
-- Users who sign in with Google get their photo stored in
-- auth.users.raw_user_meta_data ('avatar_url' / 'picture'), but the profile
-- row created for them never received it, so community pages
-- (pages/community/ProfilesPage.jsx and friends) rendered the initial-letter
-- fallback for everyone. Manual uploads via pages/account/AccountProfile.jsx
-- write a full public URL to profiles.avatar_url and are unaffected.
--
-- Two parts, both idempotent:
--   1. A BEFORE INSERT trigger on public.profiles fills avatar_url from the
--      auth metadata when the incoming row has none (the auth.users row
--      always exists by the time the profile row is inserted).
--   2. A one-off backfill for existing profiles that have no photo.
--
-- Only http(s) values are copied so a non-URL metadata value can never end
-- up in an <img src>. Updates are deliberately not covered: a user removing
-- their photo in AccountProfile sets avatar_url to null and must not have
-- the OAuth photo silently restored.

create or replace function public.sync_oauth_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_url is null then
    select coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
      into new.avatar_url
      from auth.users u
     where u.id = new.id
       and coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') like 'http%';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_oauth_avatar() from public, anon, authenticated;

drop trigger if exists sync_oauth_avatar on public.profiles;
create trigger sync_oauth_avatar
  before insert on public.profiles
  for each row execute function public.sync_oauth_avatar();

update public.profiles p
   set avatar_url = meta.url
  from (
    select u.id,
           coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') as url
      from auth.users u
  ) meta
 where meta.id = p.id
   and p.avatar_url is null
   and meta.url like 'http%';
