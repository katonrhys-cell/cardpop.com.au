-- Behavioural checks for 20261110224209_event_organiser_requests.sql.
-- Raises (and so fails the script) on the first violated expectation.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- owner
  ('00000000-0000-0000-0000-0000000000b2'),  -- stranger
  ('00000000-0000-0000-0000-0000000000ad');  -- admin
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', false),
  ('00000000-0000-0000-0000-0000000000b2', false),
  ('00000000-0000-0000-0000-0000000000ad', true);

-- Service role (auth.uid() null) creates a page and links the owner.
insert into public.event_organisers (name, owner_id)
  values ('Oz Comic-Con', '00000000-0000-0000-0000-0000000000a1');
insert into public.event_organisers (name) values ('Unowned Show');

create or replace function pg_temp.fail(msg text) returns void language plpgsql as
$$ begin raise exception 'TEST FAILED: %', msg; end $$;

-- ── The owner edits the public profile, and only that ──────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

update public.event_organisers
   set description = 'Australia''s biggest', website_url = 'https://ozcomiccon.com',
       name = 'Hijacked', slug = 'hijacked', owner_id = '00000000-0000-0000-0000-0000000000b2'
 where name = 'Oz Comic-Con' or slug = 'oz-comic-con';

do $$ declare r record; begin
  select * into r from public.event_organisers where description is not null;
  if r.name <> 'Oz Comic-Con' then perform pg_temp.fail('owner changed the name'); end if;
  if r.slug = 'hijacked' then perform pg_temp.fail('owner changed the slug'); end if;
  if r.owner_id <> '00000000-0000-0000-0000-0000000000a1' then perform pg_temp.fail('owner reassigned the page'); end if;
  if r.website_url <> 'https://ozcomiccon.com' then perform pg_temp.fail('owner could not edit the website'); end if;
end $$;

-- ...but cannot touch a page they don't own (RLS hides it: 0 rows updated).
do $$ declare n int; begin
  update public.event_organisers set description = 'mine now' where name = 'Unowned Show';
  get diagnostics n = row_count;
  if n <> 0 then perform pg_temp.fail('owner edited a page they do not own'); end if;
end $$;

-- ...cannot create or delete pages.
do $$ begin
  begin
    insert into public.event_organisers (name, owner_id) values ('Sneaky', '00000000-0000-0000-0000-0000000000a1');
    perform pg_temp.fail('owner inserted an organiser page');
  exception when insufficient_privilege or others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
do $$ declare n int; begin
  delete from public.event_organisers where name = 'Oz Comic-Con';
  get diagnostics n = row_count;
  if n <> 0 then perform pg_temp.fail('owner deleted their page'); end if;
end $$;

-- ── A stranger can edit nothing ─────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
do $$ declare n int; begin
  update public.event_organisers set description = 'x';
  get diagnostics n = row_count;
  if n <> 0 then perform pg_temp.fail('a stranger edited an organiser page'); end if;
end $$;

-- ── An admin can change anything, including ownership ──────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
update public.event_organisers set owner_id = '00000000-0000-0000-0000-0000000000b2' where name = 'Unowned Show';
do $$ begin
  if not exists (select 1 from public.event_organisers where name = 'Unowned Show' and owner_id = '00000000-0000-0000-0000-0000000000b2') then
    perform pg_temp.fail('admin could not assign an owner');
  end if;
end $$;

-- One owner, one page: the same member can't own a second page.
do $$ begin
  begin
    update public.event_organisers set owner_id = '00000000-0000-0000-0000-0000000000a1' where name = 'Unowned Show';
    perform pg_temp.fail('a member owns two pages');
  exception when unique_violation then null; end;
end $$;

-- ── Requests: members read their own, write nothing ────────────────────────
reset role;
insert into public.organiser_requests (user_id, organiser_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Oz Comic-Con'),
  ('00000000-0000-0000-0000-0000000000b2', 'Other');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$ declare n int; begin
  select count(*) into n from public.organiser_requests;
  if n <> 1 then perform pg_temp.fail('a member sees ' || n || ' requests, expected only their own'); end if;
  begin
    insert into public.organiser_requests (user_id, organiser_name) values ('00000000-0000-0000-0000-0000000000a1', 'Again');
    perform pg_temp.fail('a member inserted a request from the browser');
  exception when insufficient_privilege then null; end;
  begin
    update public.organiser_requests set status = 'approved';
    perform pg_temp.fail('a member approved their own request');
  exception when insufficient_privilege then null; end;
end $$;

-- One open request per member (service role).
reset role;
do $$ begin
  begin
    insert into public.organiser_requests (user_id, organiser_name) values ('00000000-0000-0000-0000-0000000000a1', 'Dup');
    perform pg_temp.fail('two pending requests for one member');
  exception when unique_violation then null; end;
end $$;
-- ...but a decided one doesn't block a new request.
update public.organiser_requests set status = 'rejected' where user_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.organiser_requests (user_id, organiser_name) values ('00000000-0000-0000-0000-0000000000a1', 'Retry');

\echo 'event organiser requests migration: all checks passed'
