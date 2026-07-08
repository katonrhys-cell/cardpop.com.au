-- CLEET Collectables Whatnot wiring + upcoming shows.
--
-- 1. Save CLEET's Whatnot channel link on their profile (social_links.whatnot).
-- 2. Point the Trade Night event's RSVP button at that same link.
-- 3. List CLEET's recurring "Wednesday Night Lights" ($1 Singles) shows on the
--    Whatnot Shows directory — Wednesdays 8/15/22/29 July 2026 at 7:00pm AEST.
--
-- All statements are idempotent (updates are no-ops if already set; the show
-- inserts skip any row that already exists for the same host/date/title).

-- 1. Whatnot link on CLEET's business profile ------------------------------------
update public.profiles
set social_links = coalesce(social_links, '{}'::jsonb)
                   || jsonb_build_object('whatnot', 'https://www.whatnot.com/s/X96oEqGC')
where id = 'b026a0fc-be2c-487e-bc51-72340c9bd67e';

-- 2. Trade Night RSVP button -> CLEET's Whatnot ----------------------------------
update public.events
set ticket_url = 'https://www.whatnot.com/s/X96oEqGC'
where slug = 'trade-night-at-cleet-collectables-2026-08-08';

-- 3. Upcoming "Wednesday Night Lights" shows -------------------------------------
insert into public.whatnot_shows
  (user_id, seller_name, show_title, description, show_date, whatnot_channel_url)
select
  v.user_id::uuid,
  v.seller_name,
  v.show_title,
  v.description,
  v.show_date::timestamptz,
  v.channel_url
from (values
  ('b026a0fc-be2c-487e-bc51-72340c9bd67e', 'CLEET Collectables', 'Wednesday Night Lights', '$1 Singles — autos, case hits, slabs & giveaways. Basketball cards.', '2026-07-08 19:00:00+10', 'https://www.whatnot.com/s/X96oEqGC'),
  ('b026a0fc-be2c-487e-bc51-72340c9bd67e', 'CLEET Collectables', 'Wednesday Night Lights', '$1 Singles — autos, case hits, slabs & giveaways. Basketball cards.', '2026-07-15 19:00:00+10', 'https://www.whatnot.com/s/X96oEqGC'),
  ('b026a0fc-be2c-487e-bc51-72340c9bd67e', 'CLEET Collectables', 'Wednesday Night Lights', '$1 Singles — autos, case hits, slabs & giveaways. Basketball cards.', '2026-07-22 19:00:00+10', 'https://www.whatnot.com/s/X96oEqGC'),
  ('b026a0fc-be2c-487e-bc51-72340c9bd67e', 'CLEET Collectables', 'Wednesday Night Lights', '$1 Singles — autos, case hits, slabs & giveaways. Basketball cards.', '2026-07-29 19:00:00+10', 'https://www.whatnot.com/s/X96oEqGC')
) as v(user_id, seller_name, show_title, description, show_date, channel_url)
where not exists (
  select 1 from public.whatnot_shows w
  where w.user_id = v.user_id::uuid
    and w.show_title = v.show_title
    and w.show_date = v.show_date::timestamptz
);
