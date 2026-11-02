-- Hustlemania 2027 presented by [CARDCORE] — Sat 23 – Sun 24 January 2027,
-- Melbourne Convention and Exhibition Centre (Bays 1–3), South Wharf VIC.
--
-- Cardcore's biggest show yet: a two-day collectables expo mixing TCG and
-- sports cards with sneakers, watches, streetwear, memorabilia, art, tattoos,
-- show cars, food and live entertainment. Seeded approved + featured so it
-- is live on /events, the home page, the sitemap and the prerendered copy
-- straight away, with every detail the public page can render filled in:
--
--   • dates, venue, entry times (VIP 9am / general 10:30am)
--   • first-release ticket tiers from the Oztix listing (prices include
--     booking fees): Weekend $25, Day $15, VIP Weekend $50, Kids 12 & under
--     free; second (29 Nov 2026) and final (29 Dec 2026) releases in the body
--   • organiser profile links, logo and cover image (public/images/events/)
--   • SEO title / description / keywords for the event rich result
--   • two pinned Information Board posts — one for traders & vendors, one
--     for visitors (getting there, tickets, kids) — authored by the
--     longest-standing admin, since board posts need an author profile.
--
-- Everything is taken from the organiser's Oztix listing and Instagram
-- (@officiallycardcore) as at 2 Nov 2026; the vendor application form is
-- the Google Form from Cardcore's Instagram link-in-bio (stored without the
-- account-specific `/u/1/` segment and the utm tags, so it opens for any
-- visitor). One field is deliberately left for an admin to paste in from
-- Admin → Events because the exact URL was not available at seed time:
-- `ticket_url` (the Oztix event link — "Get Tickets" falls back to the
-- website until then).
--
-- Idempotent: the event insert is skipped when the slug exists, and each
-- board post is skipped when a post with the same title is already on that
-- event's board.

insert into public.events (
  event_type, status, is_featured, is_free, registration_required,
  title, slug, short_description, description,
  image_url, organizer_logo_url,
  venue_name, address, suburb, state, postcode,
  start_date, end_date, start_time,
  entry_fee_aud, ticket_prices,
  website_url, instagram_url, facebook_url, vendor_application_url,
  organizer_name,
  age_restrictions, accessibility_info,
  featured_card_games, tags,
  seo_title, seo_description, seo_keywords
)
select
  'card_show'::event_type,
  'approved'::event_status,
  true,
  false,
  true,
  'Hustlemania 2027 presented by Cardcore',
  'hustlemania-2027-01-23',
  'Cardcore''s two-day collectables expo at MCEC: trading cards, sneakers, watches, streetwear, memorabilia, art, tattoos, show cars, food and live entertainment. Tickets from $15, kids 12 and under free.',
  E'Hustlemania — Where Passions Collide. Two days. One roof. Multiple hustles.\n\n[CARDCORE] takes over Bays 1–3 of the Melbourne Convention and Exhibition Centre on Saturday 23 and Sunday 24 January 2027 for its biggest event yet: a collectables expo that puts trading cards alongside sneakers, watches, streetwear, memorabilia, art, tattoos, show cars, food and live entertainment. Walk one aisle for cards and collectables, the next for watches and streetwear, then meet the builders behind the show cars.\n\nFor card collectors this is the Cardcore crowd — the team behind Cardcore Vol. 5, the Night Market at Queen Victoria Market and the Seaworks Sleepover — on a convention-centre floor, so expect the biggest line-up of TCG and sports card traders Cardcore has put under one roof: Pokémon, One Piece and the other big TCGs, sports cards, graded slabs, sealed product and singles to buy, sell and trade.\n\nENTRY TIMES\n- VIP: early entry from 9:00am both days, with a priority lane and a show bag\n- General admission: from 10:30am both days\n\nTICKETS (via Oztix — prices include booking fees)\nFirst release, on sale now:\n- Weekend Pass: $25 (both days)\n- Saturday Day Pass: $15\n- Sunday Day Pass: $15\n- VIP Weekend Pass: $50 (early entry 9am both days + priority lane + show bag)\n- Kids 12 and under: FREE (must be accompanied by a ticket-holding adult)\n\nSecond release from 6:00pm Sunday 29 November 2026: Weekend $35, Day Pass $20, VIP Weekend $60.\nFinal release from 6:00pm Tuesday 29 December 2026: Weekend $45, Day Pass $25, VIP Weekend $70.\nFirst-release passes are limited, so the earlier you buy, the less you pay.\n\nTRADERS & VENDORS\nHustlemania is built for traders: TCG and sports card dealers, sneaker and streetwear resellers, watch dealers, memorabilia, art and collectables sellers. Vendor applications are open now through Cardcore''s online form — use the "Apply for a trader table" button on this page — and Cardcore shows sell their tables well ahead of the date, so get in early. See the Information Board below for what to have ready before you apply. CardPop members selling at the show can RSVP here as a vendor so collectors know who to look for.\n\nGETTING THERE\nMCEC is at 1 Convention Centre Place, South Wharf, on the Yarra. Trams 12, 96 and 109 stop at Casino/MCEC on Clarendon Street, and Southern Cross Station is about a 10-minute walk. Paid car parks sit under the South Wharf precinct (check mcec.com.au for the current rates and entrances) — on a show weekend public transport is the easier option.\n\nAll ages, family friendly. Kids 12 and under are free with a ticket-holding adult.',
  '/images/events/hustlemania-2027-01-23.jpg',
  'https://cardpop.com.au/images/events/cardcore-logo.jpg',
  'Melbourne Convention and Exhibition Centre (MCEC) — Bays 1–3',
  '1 Convention Centre Place',
  'South Wharf',
  'VIC',
  '3006',
  '2027-01-23'::date,
  '2027-01-24'::date,
  '10:30'::time,
  15,
  '[{"type": "child", "price_aud": 0}, {"type": "vip", "price_aud": 50}]'::jsonb,
  'https://www.cardcore.club',
  'https://www.instagram.com/officiallycardcore/',
  'https://www.facebook.com/p/Cardcore-61577108853691/',
  'https://docs.google.com/forms/d/e/1FAIpQLScZML_0yIj2ndEGRFO-7UTnUNqrmNFZ9BBSRssEaNvW2Z05tg/viewform',
  'Cardcore',
  'All ages. Kids 12 and under are free but must be accompanied by a ticket-holding adult.',
  'MCEC is a step-free venue with lifts, accessible toilets and accessible parking; see mcec.com.au/visit for the current accessibility guide and entrances.',
  array['Pokémon','One Piece']::text[],
  array[
    'Card Show','Trading Cards','TCG','Pokemon','One Piece','Sports Cards','Collectables',
    'Sneakers','Streetwear','Watches','Memorabilia','Show Cars','Live Entertainment',
    'Cardcore','Hustlemania','Melbourne','South Wharf','MCEC','Family Friendly','Expo'
  ]::text[],
  'Hustlemania 2027 | Cardcore Card & Collectables Expo, MCEC',
  'Hustlemania by Cardcore, 23–24 Jan 2027, MCEC South Wharf. Trading cards, sneakers, watches, streetwear, memorabilia & live entertainment. From $15, kids free.',
  array[
    'Hustlemania',
    'Hustlemania 2027',
    'Hustlemania Melbourne',
    'Cardcore',
    'Cardcore Hustlemania',
    'Cardcore event 2027',
    'card show Melbourne 2027',
    'trading card expo Melbourne',
    'TCG event Melbourne January 2027',
    'Pokemon card show Melbourne',
    'sports card show Melbourne',
    'collectables expo MCEC',
    'sneaker expo Melbourne 2027',
    'streetwear expo Melbourne',
    'Melbourne Convention and Exhibition Centre events January 2027',
    'things to do Melbourne January 2027'
  ]
where not exists (
  select 1 from public.events where slug = 'hustlemania-2027-01-23'
);

-- Information Board: pinned posts for traders and for visitors. Board posts
-- need an author profile; the longest-standing admin stands in (skipped
-- entirely when there is no admin, e.g. on a fresh local database).
with ev as (
  select id from public.events where slug = 'hustlemania-2027-01-23'
), author as (
  select id from public.profiles where is_admin = true order by created_at asc limit 1
)
insert into public.event_board_posts (event_id, author_id, title, body, is_pinned)
select ev.id, author.id, p.title, p.body, true
from ev, author, (values
  (
    'Traders & vendors: getting a table at Hustlemania',
    E'Hustlemania is a trader-first show: TCG and sports card dealers, sneaker and streetwear resellers, watch dealers, memorabilia, art and collectables sellers all trade on the same floor across Bays 1–3 of MCEC.\n\nHow to apply: Cardcore takes vendor applications through its online form — the "Apply for a trader table" button at the top of this page opens it (it''s the same form linked from @officiallycardcore''s Instagram bio). Cardcore shows sell their tables well ahead of the date (the Seaworks Sleepover ran 170+ tables), so get in early. Questions go to Cardcore on Instagram.\n\nHave ready before you apply:\n- Your business / trading name, ABN if you have one, and what you sell\n- Your Instagram or store link so they can see your stock\n- Whether you want Saturday, Sunday or the full weekend\n- Power, extra tables or display-case needs\n\nOn the day: VIP ticket holders enter from 9:00am both days and general admission from 10:30am, so plan your set-up for before 9am. MCEC loading access and bump-in times come from Cardcore with your table confirmation.\n\nSelling on CardPop? RSVP to this event as a vendor so collectors can see you''re attending, list the cards you''re bringing in your vault, and post your table number here once you have it.'
  ),
  (
    'Plan your visit: tickets, entry times and getting to MCEC',
    E'When: Saturday 23 and Sunday 24 January 2027. VIP early entry 9:00am, general admission from 10:30am, both days.\n\nWhere: Melbourne Convention and Exhibition Centre, Bays 1–3 — 1 Convention Centre Place, South Wharf VIC 3006.\n\nTickets are on Oztix and prices include booking fees. First release (on sale now): Weekend Pass $25, Saturday or Sunday Day Pass $15, VIP Weekend Pass $50 (early entry + priority lane + show bag). Second release from 6pm Sun 29 Nov 2026 (Weekend $35 / Day $20 / VIP $60) and final release from 6pm Tue 29 Dec 2026 (Weekend $45 / Day $25 / VIP $70). Kids 12 and under are free with a ticket-holding adult — add a Kids Pass at checkout.\n\nGetting there: trams 12, 96 and 109 stop at Casino/MCEC on Clarendon Street; Southern Cross Station is about a 10-minute walk along the river. Paid parking is available under the South Wharf precinct — check mcec.com.au for current rates and entrances. On a show weekend public transport is the easier option.\n\nBring: cash and card (most traders take both), a binder or top-loaders for trades, and your want list. Check this board before you leave — Cardcore and attending vendors post updates here.'
  )
) as p(title, body)
where not exists (
  select 1 from public.event_board_posts b
  where b.event_id = ev.id and b.title = p.title
);
