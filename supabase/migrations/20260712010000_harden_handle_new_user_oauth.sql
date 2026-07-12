-- Harden public.handle_new_user() so OAuth signups (Facebook in particular)
-- can never fail on the profiles.username NOT NULL + UNIQUE constraints.
--
-- Background: profiles.username is NOT NULL and UNIQUE (profiles_username_key).
-- The AFTER INSERT ON auth.users trigger on_auth_user_created runs
-- handle_new_user() to create the profile row. The previous definition was:
--
--   insert into public.profiles (id, username, display_name)
--   values (new.id,
--     coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
--     coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
--
-- Two ways that fails, both hit by social login:
--   1. NULL username. Email/password signups pass a 'username' in
--      raw_user_meta_data, and Google always returns an email, so the
--      split_part fallback works for them. Facebook, however, can complete
--      OAuth WITHOUT sharing an email (the user declines the email scope, or
--      the account has only a phone number). Then new.email is null,
--      split_part(null,'@',1) is null, username is null -> NOT NULL violation
--      -> the whole signup transaction aborts and no account is created.
--   2. Duplicate username. Two users whose derived name collides (e.g.
--      john@gmail.com and john@outlook.com both -> "john", or two people
--      named "Jane Smith") -> UNIQUE violation -> signup aborts.
--
-- This redefinition always derives a non-null base username and then
-- de-duplicates it with a numeric suffix, so a profile row is always created.
-- Behaviour for existing email/password signups is unchanged: an explicit
-- raw_user_meta_data.username is still honoured first, and display_name still
-- prefers full_name. Idempotent (create or replace); the trigger itself is
-- untouched.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  base_username text;
  candidate     text;
  suffix        int := 0;
begin
  -- A guaranteed non-null, non-empty base, in order of preference:
  --   explicit username -> email local part -> alphanumeric of full name -> 'user'
  base_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'full_name', '')), '[^a-z0-9]+', '', 'g'), ''),
    'user'
  );

  -- Resolve UNIQUE collisions by appending -1, -2, ... until a free name is found.
  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '-' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      candidate
    )
  );
  return new;
end;
$function$;
