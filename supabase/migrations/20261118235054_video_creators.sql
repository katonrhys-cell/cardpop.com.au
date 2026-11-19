-- Saved video creators: the YouTubers / influencers credited under event
-- videos, kept once and reused.
--
-- Until now a video's creator credit lived only inside that one video's JSON
-- (events.event_videos[].creator / event_organisers.videos[].creator), so
-- crediting the same person on another event meant typing their name, picture
-- and handles again, and nothing tied their videos together.
--
-- `video_creators` is the saved list. A video's credit keeps its snapshot
-- (name, picture, socials — every reader already renders it) and gains the
-- saved creator's `id` + `slug`, which is what links the video to the public
-- page /creators/<slug> listing every event video by that creator.
--
--   * Anyone may read the list (it is what the public page shows).
--   * Only admins write it, from the browser, under RLS.
--   * Editing a saved creator rewrites the snapshot in every video that
--     credits them; deleting one keeps the credits but unlinks them.
--
-- See docs/video-creators.md. Test: tests/db/run-video-creators-migration.sh.

create table if not exists public.video_creators (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  avatar_url  text check (avatar_url is null or avatar_url ~* '^https?://[^[:space:]"''<>]+$'),
  instagram   text check (instagram is null or instagram ~ '^https://www\.instagram\.com/'),
  youtube     text check (youtube is null or youtube ~ '^https://www\.youtube\.com/'),
  tiktok      text check (tiktok is null or tiktok ~ '^https://www\.tiktok\.com/'),
  facebook    text check (facebook is null or facebook ~ '^https://www\.facebook\.com/'),
  x           text check (x is null or x ~ '^https://x\.com/'),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists video_creators_slug_key on public.video_creators (slug);

comment on table public.video_creators is
  'Saved video creators credited under event videos (utils/videoCreators.js). A video''s creator JSON carries this row''s id + slug; /creators/<slug> lists their videos.';

-- The slug is the page URL and the id is what videos reference: neither moves.
create or replace function public.video_creators_before_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.slug := old.slug;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_video_creators_before_write on public.video_creators;
create trigger trg_video_creators_before_write
  before insert or update on public.video_creators
  for each row execute function public.video_creators_before_write();

-- One video list with a creator's snapshot replaced (p_snapshot given) or the
-- credit unlinked (p_snapshot null: the credit stays, its id + slug go).
create or replace function public.video_list_with_creator(p_videos jsonb, p_creator_id text, p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(
    case
      when v -> 'creator' ->> 'id' = p_creator_id then
        v || jsonb_build_object('creator',
          case when p_snapshot is null then (v -> 'creator') - 'id' - 'slug' else p_snapshot end)
      else v
    end
    order by ord), '[]'::jsonb)
  from jsonb_array_elements(p_videos) with ordinality as t(v, ord);
$$;

-- Keep every credit of a saved creator in step with the saved row. Fail-safe:
-- a problem here must never stop the creator being saved or deleted.
create or replace function public.sync_video_creator_credits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := old.id::text;
  v_probe jsonb := jsonb_build_array(jsonb_build_object('creator', jsonb_build_object('id', old.id::text)));
  v_snapshot jsonb := null;
begin
  if tg_op = 'UPDATE' then
    if (new.name, new.avatar_url, new.instagram, new.youtube, new.tiktok, new.facebook, new.x)
       is not distinct from
       (old.name, old.avatar_url, old.instagram, old.youtube, old.tiktok, old.facebook, old.x) then
      return null;
    end if;
    v_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'id', new.id, 'slug', new.slug, 'name', new.name,
      'avatar_url', nullif(new.avatar_url, ''),
      'instagram', nullif(new.instagram, ''), 'youtube', nullif(new.youtube, ''),
      'tiktok', nullif(new.tiktok, ''), 'facebook', nullif(new.facebook, ''), 'x', nullif(new.x, '')));
  end if;

  begin
    update public.events e
       set event_videos = public.video_list_with_creator(e.event_videos, v_id, v_snapshot)
     where e.event_videos @> v_probe;
    update public.event_organisers o
       set videos = public.video_list_with_creator(o.videos, v_id, v_snapshot)
     where o.videos @> v_probe;
  exception when others then
    raise warning 'sync_video_creator_credits(%): %', v_id, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.sync_video_creator_credits() from public, anon, authenticated;

drop trigger if exists trg_video_creators_sync_credits on public.video_creators;
create trigger trg_video_creators_sync_credits
  after update or delete on public.video_creators
  for each row execute function public.sync_video_creator_credits();

-- "Which videos credit this creator" is a containment test on the video JSON.
create index if not exists events_event_videos_gin
  on public.events using gin (event_videos jsonb_path_ops);

alter table public.video_creators enable row level security;

revoke all on public.video_creators from anon, authenticated;
grant select on public.video_creators to anon, authenticated;
grant insert, update, delete on public.video_creators to authenticated;

drop policy if exists video_creators_public_read on public.video_creators;
create policy video_creators_public_read on public.video_creators
  for select to anon, authenticated using (true);

drop policy if exists video_creators_admin_insert on public.video_creators;
create policy video_creators_admin_insert on public.video_creators
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

drop policy if exists video_creators_admin_update on public.video_creators;
create policy video_creators_admin_update on public.video_creators
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

drop policy if exists video_creators_admin_delete on public.video_creators;
create policy video_creators_admin_delete on public.video_creators
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
