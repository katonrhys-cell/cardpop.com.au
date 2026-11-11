-- Seed "VAULT – Collector Show #2" (Sun 14 Mar 2027, The Timber Yard, Port Melbourne VIC).
-- Details are from the organiser's announcement. The copy has been rewritten for
-- CardPop rather than pasted.
--
-- The row is approved so it goes live on the /events calendar as soon as the
-- migration applies, the same way VAULT #1
-- (20261003050327_seed_vault_melbourne_card_show.sql) was added.
-- Tickets are sold on Megatix. The link is stored without its utm tracking
-- parameter, and it is also source_url, so the weekly event re-scan fills any
-- blank fields and queues changes (e.g. the GA price rising to $25) for an admin
-- to review.
-- Prices come from the Megatix page as of 2026-11-11. Early Bird GA ($15) and
-- Early Bird VIP ($30) have sold out. First Release GA is $20 (entry_fee_aud,
-- from 10am, rising to $25 once that allocation sells out). First Release VIP
-- is $35 (from 9am, with a showbag and meet & greet). The sold-out tiers are
-- left out of ticket_prices.
-- Idempotent: the event insert is skipped if the slug already exists, and the
-- watch insert is skipped if the event already has one.

insert into public.events (
  event_type, status,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time,
  is_free, registration_required, entry_fee_aud, ticket_prices,
  ticket_url, source_url, instagram_url,
  organizer_name, age_restrictions,
  featured_card_games, tags,
  seo_title, seo_description, seo_keywords
)
select
  'card_show'::event_type, 'approved'::event_status,
  'VAULT – Collectible & Card Show #2',
  'vault-collector-show-2-port-melbourne-2027-03-14',
  'VAULT returns for round two at The Timber Yard, Port Melbourne. More than 70 vendors of Pokémon, sports cards, One Piece, slabs and collectibles, and a giveaway worth over $5,000. Tickets from $20, kids under 10 free.',
  E'VAULT, Melbourne''s collector show, is back for its second edition. Show #2 moves to The Timber Yard, a large warehouse venue on Plummer Street in Port Melbourne, on Sunday 14 March 2027.\n\n'
  || E'More than 70 vendors will be selling under one roof. You''ll find Pokémon, sports cards, One Piece and other TCGs, graded slabs, raw singles and sealed product, along with toys, figures, apparel and one-off collectibles.\n\n'
  || E'The show suits most kinds of collector. You can chase a grail card, fill gaps in a set, trade or sell from your own collection, or open packs on the floor. It''s also a chance to find new vendors and meet other collectors.\n\n'
  || E'Times\n'
  || E'- VIP early entry: from 9:00am\n'
  || E'- General trading: 10:00am to 6:00pm\n\n'
  || E'Tickets\n'
  || E'Tickets are sold through Megatix. Both Early Bird releases have sold out.\n'
  || E'- First Release General Admission, $20: all-day entry from 10:00am. This is a limited allocation, and the price goes up to $25 once it''s gone.\n'
  || E'- First Release VIP Admission, $35: in the door at 9:00am, an hour before general admission, for first pick of the vendor tables. Also includes a VIP showbag and an exclusive meet and greet.\n'
  || E'Every ticket, GA or VIP, includes an entry into the on-site VAULT giveaway.\n\n'
  || E'Who can come\n'
  || E'VAULT is a family-friendly show, and children under 10 get in free. Food and drinks are sold at the venue.\n\n'
  || E'The VAULT Giveaway: over $5,000 in prizes\n'
  || E'Every ticket gives you a shot at the vault. On the day, enter the last four digits of your order number into the VAULT on site. If the door opens, you take home everything inside. Prizes include sealed Pokémon product, PSA-graded slabs, Pop figures and other collectibles.\n\n'
  || E'Getting there\n'
  || E'The Timber Yard is at 351 Plummer St, Port Melbourne VIC 3207, a short trip from the CBD in Melbourne''s inner south-west.',
  'The Timber Yard', '351 Plummer St', 'Port Melbourne', 'VIC', '3207',
  '2027-03-14'::date, '10:00'::time, '18:00'::time,
  false, false, 20, '[{"type":"vip","price_aud":35}]'::jsonb,
  'https://megatix.com.au/events/vault-collectible-and-card-show-2',
  'https://megatix.com.au/events/vault-collectible-and-card-show-2',
  'https://www.instagram.com/vaultthegreatchase/',
  'VAULT Collectibles', 'All ages, family-friendly. Children under 10 enter free.',
  array['Pokémon','One Piece']::text[],
  array['Card Show','Sports Cards','Pokemon','One Piece','TCG','Slabs','Sealed','Collectibles','Toys & Figures','Giveaway','Melbourne','Port Melbourne','Victoria','Family Friendly']::text[],
  'VAULT Collectible & Card Show #2 | Port Melbourne, 14 March 2027',
  'VAULT Collector Show #2 at The Timber Yard, Port Melbourne, on Sun 14 Mar 2027, 10am–6pm (VIP 9am). 70+ vendors, Pokémon, sports cards and a $5,000+ giveaway. Tickets from $20.',
  array[
    'VAULT collector show',
    'VAULT card show Melbourne',
    'trading card show Melbourne',
    'card show Port Melbourne',
    'The Timber Yard Port Melbourne',
    'Pokemon card show Melbourne',
    'sports card show Melbourne',
    'One Piece TCG Melbourne',
    'collectibles show Victoria',
    'trading card events March 2027'
  ]::text[]
where not exists (
  select 1 from public.events where slug = 'vault-collector-show-2-port-melbourne-2027-03-14'
);

-- Register the Megatix page with the weekly source watcher. next_scan_at defaults
-- to now(), so the next daily run scans the page. That fills in blank fields such
-- as the ticket price and holds anything that differs for an admin to approve.
-- It never overwrites a field that already has a value.
insert into public.event_source_watches (event_id, url)
select e.id, 'https://megatix.com.au/events/vault-collectible-and-card-show-2'
from public.events e
where e.slug = 'vault-collector-show-2-port-melbourne-2027-03-14'
on conflict (event_id) do nothing;

-- Same organiser: give VAULT #1 the Instagram link too, without overwriting a
-- link an admin has already set.
update public.events
set instagram_url = 'https://www.instagram.com/vaultthegreatchase/', updated_at = now()
where slug = 'the-vault-melbourne-card-collectible-show-2026-10-04'
  and instagram_url is null;
