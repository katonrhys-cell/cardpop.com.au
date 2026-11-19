-- Behavioural checks for 20261119092859_event_review_deals_done.sql.
\set ON_ERROR_STOP on
begin;

insert into public.events (id, title) values
  ('00000000-0000-0000-0000-0000000000e1', 'Show A'),
  ('00000000-0000-0000-0000-0000000000e2', 'Show B'),
  ('00000000-0000-0000-0000-0000000000e3', 'Show C');
insert into public.blog_articles (id, title, is_published) values
  ('00000000-0000-0000-0000-0000000000a1', 'A', true),
  ('00000000-0000-0000-0000-0000000000a2', 'B', true),
  ('00000000-0000-0000-0000-0000000000a3', 'C draft', false),
  ('00000000-0000-0000-0000-0000000000a4', 'A again', true);
insert into public.event_reviews (article_id, event_id, deals_done) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 12),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e2', null),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000e3', 50),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000e1', 3);

-- Published only, one per event (two reviews of Show A count once), deals summed.
set local role anon;
do $$
declare r record;
begin
  select * into r from public.public_event_review_stats();
  if r.events_attended <> 2 then raise exception 'events_attended: expected 2, got %', r.events_attended; end if;
  if r.deals_done <> 15 then raise exception 'deals_done: expected 15, got %', r.deals_done; end if;
end $$;
reset role;

-- Negative counts are refused.
do $$
begin
  begin
    update public.event_reviews set deals_done = -1 where article_id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'negative deals_done was accepted';
  exception when check_violation then null;
  end;
end $$;

-- An empty site reports zeros, not nulls.
delete from public.event_reviews;
do $$
declare r record;
begin
  select * into r from public.public_event_review_stats();
  if r.events_attended <> 0 or r.deals_done <> 0 then raise exception 'empty: expected 0/0, got %/%', r.events_attended, r.deals_done; end if;
end $$;

rollback;
\echo 'event review deals done: ok'
