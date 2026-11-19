-- Behavioural checks for 20261116110000_organiser_tiktok_x_linktree_links.sql
-- and 20261116120000_organiser_messages.sql.
-- Raises (and so fails the script) on the first violated expectation.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- page owner
  ('00000000-0000-0000-0000-0000000000b2');  -- sender
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', false),
  ('00000000-0000-0000-0000-0000000000b2', false);

insert into public.event_organisers (name, owner_id)
  values ('Oz Comic-Con', '00000000-0000-0000-0000-0000000000a1');

create or replace function pg_temp.fail(msg text) returns void language plpgsql as
$$ begin raise exception 'TEST FAILED: %', msg; end $$;

-- Runs a statement that must be refused.
create or replace function pg_temp.must_fail(sql text, what text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  perform pg_temp.fail(what);
end $$;

-- ── Social links: http(s) only, and the owner may set them ──────────────────
select pg_temp.must_fail(
  $q$update public.event_organisers set tiktok_url = 'javascript:alert(1)'$q$,
  'tiktok_url accepted a non-http link');
select pg_temp.must_fail(
  $q$update public.event_organisers set linktree_url = 'linktr.ee/show'$q$,
  'linktree_url accepted a link with no scheme');

select pg_temp.must_fail(
  $q$update public.event_organisers set contact_url = 'mailto:show@example.com'$q$,
  'contact_url accepted a non-http link');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
update public.event_organisers set contact_url = 'https://example.com/contact';
update public.event_organisers
   set tiktok_url = 'https://tiktok.com/@show', x_url = 'https://x.com/show', linktree_url = 'https://linktr.ee/show';
reset role;
do $$ declare r record; begin
  select * into r from public.event_organisers where name = 'Oz Comic-Con';
  if r.tiktok_url is distinct from 'https://tiktok.com/@show'
     or r.x_url is distinct from 'https://x.com/show'
     or r.linktree_url is distinct from 'https://linktr.ee/show'
     or r.contact_url is distinct from 'https://example.com/contact' then
    perform pg_temp.fail('owner could not save the TikTok / X / Linktree links');
  end if;
end $$;

-- ── Messages: the service role writes them ──────────────────────────────────
insert into public.organiser_messages
  (organiser_id, sender_id, sender_name, sender_email, topic, body, status, recipient_id, scan_verdict)
select id, '00000000-0000-0000-0000-0000000000b2', 'Maya', 'maya@example.com', 'feedback',
       'Great show, but the queue was long.', 'delivered', owner_id, 'clean'
  from public.event_organisers where name = 'Oz Comic-Con';

select pg_temp.must_fail($q$
  insert into public.organiser_messages (organiser_id, sender_name, sender_email, topic, body, status, scan_verdict)
  select id, 'Maya', 'maya@example.com', 'feedback', 'A perfectly long enough body.', 'sent', 'clean' from public.event_organisers
$q$, 'an unknown status was accepted');
select pg_temp.must_fail($q$
  insert into public.organiser_messages (organiser_id, sender_name, sender_email, topic, body, status, scan_verdict)
  select id, 'Maya', 'maya@example.com', 'rant', 'A perfectly long enough body.', 'held', 'flagged' from public.event_organisers
$q$, 'an unknown topic was accepted');
select pg_temp.must_fail($q$
  insert into public.organiser_messages (organiser_id, sender_name, sender_email, topic, body, status, scan_verdict)
  select id, 'Maya', 'maya@example.com', 'feedback', 'short', 'held', 'flagged' from public.event_organisers
$q$, 'a too-short body was accepted');
select pg_temp.must_fail($q$
  insert into public.organiser_messages (organiser_id, sender_name, sender_email, topic, body, status, scan_verdict)
  select id, 'Maya', 'maya@example.com', 'feedback', 'A perfectly long enough body.', 'delivered', 'maybe' from public.event_organisers
$q$, 'an unknown scan verdict was accepted');

-- ── Nobody reaches the table from the browser: not the sender, not the owner ─
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.must_fail('select count(*) from public.organiser_messages', 'the page owner read the table directly');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select pg_temp.must_fail('select count(*) from public.organiser_messages', 'the sender read the table directly');
select pg_temp.must_fail($q$
  insert into public.organiser_messages (organiser_id, sender_id, sender_name, sender_email, topic, body, status, scan_verdict)
  select id, '00000000-0000-0000-0000-0000000000b2', 'Maya', 'maya@example.com', 'feedback',
         'Straight past the screen.', 'delivered', 'clean' from public.event_organisers
$q$, 'a member inserted a message directly, past the screen');
select pg_temp.must_fail(
  $q$update public.organiser_messages set status = 'delivered'$q$,
  'a member updated a message directly');
reset role;

set role anon;
select pg_temp.must_fail('select count(*) from public.organiser_messages', 'an anonymous visitor read the table');
reset role;

-- ── The bell types exist ────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'notification_type' and e.enumlabel = 'organiser_message') then
    perform pg_temp.fail('notification type organiser_message is missing');
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'notification_type' and e.enumlabel = 'organiser_message_review') then
    perform pg_temp.fail('notification type organiser_message_review is missing');
  end if;
end $$;

-- ── Removing an organiser page removes its messages ─────────────────────────
delete from public.event_organisers where name = 'Oz Comic-Con';
do $$ begin
  if exists (select 1 from public.organiser_messages) then
    perform pg_temp.fail('messages outlived their organiser page');
  end if;
end $$;

\echo organiser messages: all checks passed
