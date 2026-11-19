-- Checks for 20261118235054_video_creators.sql (run by run-video-creators-migration.sh).
\set admin '11111111-1111-1111-1111-111111111111'
\set member '22222222-2222-2222-2222-222222222222'
insert into public.profiles (id, is_admin) values (:'admin', true), (:'member', false);

create or replace function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', label; end if;
  raise notice 'ok — %', label;
end $$;

-- A member can't save a creator; an admin can.
set role authenticated;
select set_config('request.jwt.claim.sub', :'member', false);
do $$ begin
  insert into public.video_creators (slug, name) values ('nope', 'Nope');
  raise exception 'FAILED: a member inserted a creator';
exception when insufficient_privilege then raise notice 'ok — a member cannot insert';
end $$;

select set_config('request.jwt.claim.sub', :'admin', false);
insert into public.video_creators (id, slug, name, instagram)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'simplesimon', 'SimpleSimon', 'https://www.instagram.com/simplesimonyoutube');
reset role;

-- Two events credit the saved creator, one credits someone unsaved.
insert into public.events (id, title, event_videos) values
  ('e1111111-1111-1111-1111-111111111111', 'Geelong', '[{"title":"A","url":"https://www.youtube.com/watch?v=aaaaaaaaaaa","creator":{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","slug":"simplesimon","name":"SimpleSimon"}},{"title":"B","url":"https://www.youtube.com/watch?v=bbbbbbbbbbb","creator":{"name":"Someone Else"}}]'),
  ('e2222222-2222-2222-2222-222222222222', 'Ballarat', '[{"title":"C","url":"https://www.youtube.com/watch?v=ccccccccccc","creator":{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","slug":"simplesimon","name":"SimpleSimon"}}]'),
  ('e3333333-3333-3333-3333-333333333333', 'Untouched', '[{"title":"D","url":"https://www.youtube.com/watch?v=ddddddddddd"}]');
insert into public.event_organisers (id, name, videos) values
  ('0a111111-1111-1111-1111-111111111111', 'Org', '[{"title":"E","url":"https://www.youtube.com/watch?v=eeeeeeeeeee","creator":{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","slug":"simplesimon","name":"SimpleSimon"}}]');

-- Anyone can read the list.
set role anon;
select pg_temp.expect((select count(*) = 1 from public.video_creators), 'anon reads the saved creators');
do $$ begin
  update public.video_creators set name = 'Hacked';
  raise exception 'FAILED: anon updated a creator';
exception when insufficient_privilege then raise notice 'ok — anon cannot update';
end $$;
reset role;

-- A member's update matches no row.
set role authenticated;
select set_config('request.jwt.claim.sub', :'member', false);
update public.video_creators set name = 'Hacked';
reset role;
select pg_temp.expect((select name = 'SimpleSimon' from public.video_creators), 'a member cannot update');

-- An admin's edit reaches every credit; the slug and id don't move.
set role authenticated;
select set_config('request.jwt.claim.sub', :'admin', false);
update public.video_creators
   set name = 'Simple Simon', slug = 'changed', youtube = 'https://www.youtube.com/@TheSimpleverse'
 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
reset role;
select pg_temp.expect((select slug = 'simplesimon' from public.video_creators), 'the slug is pinned');
select pg_temp.expect((select event_videos -> 0 -> 'creator' = '{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","slug":"simplesimon","name":"Simple Simon","instagram":"https://www.instagram.com/simplesimonyoutube","youtube":"https://www.youtube.com/@TheSimpleverse"}'::jsonb
  from public.events where title = 'Geelong'), 'the first event''s credit is rewritten');
select pg_temp.expect((select event_videos -> 1 -> 'creator' = '{"name":"Someone Else"}'::jsonb and event_videos -> 1 ->> 'title' = 'B'
  from public.events where title = 'Geelong'), 'another creator''s credit and the video order are untouched');
select pg_temp.expect((select event_videos -> 0 -> 'creator' ->> 'name' = 'Simple Simon' from public.events where title = 'Ballarat'), 'the second event''s credit is rewritten');
select pg_temp.expect((select videos -> 0 -> 'creator' ->> 'name' = 'Simple Simon' from public.event_organisers), 'the organiser page''s credit is rewritten');
select pg_temp.expect((select event_videos = '[{"title":"D","url":"https://www.youtube.com/watch?v=ddddddddddd"}]'::jsonb from public.events where title = 'Untouched'), 'an event without the creator is untouched');

-- A bad link is refused.
do $$ begin
  update public.video_creators set instagram = 'https://evil.example/x';
  raise exception 'FAILED: an off-platform link was stored';
exception when check_violation then raise notice 'ok — an off-platform link is refused';
end $$;

-- Deleting keeps the credit but unlinks it.
delete from public.video_creators where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select pg_temp.expect((select event_videos -> 0 -> 'creator' = '{"name":"Simple Simon","instagram":"https://www.instagram.com/simplesimonyoutube","youtube":"https://www.youtube.com/@TheSimpleverse"}'::jsonb
  from public.events where title = 'Geelong'), 'deleting a creator unlinks the credit and keeps it');
select pg_temp.expect((select not (videos -> 0 -> 'creator' ? 'id') from public.event_organisers), 'the organiser credit is unlinked too');
