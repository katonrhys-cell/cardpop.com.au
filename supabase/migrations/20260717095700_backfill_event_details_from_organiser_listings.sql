-- Backfill missing event details (addresses, times, fees, links) flagged by
-- Google Search Console's Events rich-result report. Every value below was
-- verified against the organiser's own site, the venue operator, or the
-- event's ticketing listing on 17 Jul 2026 — sources noted per event.
-- Unverifiable fields (e.g. Supanova/CardCon Melbourne prices not yet
-- published) are deliberately left untouched.
--
-- Plain slug-keyed UPDATEs: idempotent, and a no-op for any event that has
-- since been deleted or renamed.

-- Newy Card Show — newycardshow.com.au + TryBooking 1581803
update public.events set
  address = '100 Darling Street'
where slug = 'newy-card-show-2026-09-27';

-- Oz Comic-Con Sydney — ozcomiccon.com/sydney ("Doors Open 9am - 5PM Saturday & Sunday");
-- Sydney Showground street address per venue listings
update public.events set
  address = '1 Showground Road',
  start_time = '09:00',
  end_time = '17:00'
where slug = 'oz-comic-con-sydney-2026-09-12';

-- Oz Comic-Con Brisbane — ozcomiccon.com/brisbane ("Doors open 9:30am - 4:30pm");
-- BCEC street address per venue listings
update public.events set
  address = 'Cnr Merivale Street & Glenelg Street',
  start_time = '09:30',
  end_time = '16:30'
where slug = 'oz-comic-con-brisbane-2026-09-19';

-- Oz Comic-Con Canberra — EPIC address per exhibitionparkincanberra.com/contact;
-- $40 early-bird single-day GA per ozcomiccon.com/canberra-ticket-details
-- (standard/door price not yet published, so entry_fee_aud stays unset)
update public.events set
  address = 'Corner Flemington Road & Northbourne Avenue',
  presale_fee_aud = 40.00
where slug = 'oz-comic-con-canberra-2026-08-15';

-- Supanova Brisbane — BCEC street address per venue listings (2026 ticket
-- prices not yet on sale, so no fee recorded)
update public.events set
  address = 'Cnr Merivale Street & Glenelg Street'
where slug = 'supanova-brisbane-2026-11-06';

-- The Hobby Hangout XL Brisbane — thehobbyhangout.com.au (Exhibition Building,
-- Brisbane Showgrounds, 10am–5pm); showgrounds address 600 Gregory Terrace
update public.events set
  venue_name = 'Exhibition Building, Brisbane Showgrounds',
  address = '600 Gregory Terrace',
  suburb = 'Bowen Hills',
  postcode = '4006',
  start_time = '10:00',
  end_time = '17:00'
where slug = 'hobby-hangout-xl-brisbane-2026';

-- The Hobby Hangout XL Melbourne 2027 — organiser event-info/FAQ pages
-- (GA doors 10:30am, runs to 5pm)
update public.events set
  start_time = '10:30',
  end_time = '17:00'
where slug = 'hobby-hangout-xl-melbourne-2027';

-- CardCon MEGA — Humanitix listing runs Sat 29 Aug 9:00am through Sun 30 Aug
-- 4:00pm and sells Saturday-only / Sunday-only / weekend passes: it is a
-- two-day event, so end_date moves to the 30th
update public.events set
  end_date = '2026-08-30',
  start_time = '09:00',
  end_time = '16:00',
  website_url = 'https://cardcon.com.au'
where slug = 'cardcon-mega-sydney-olympic-park-2026';

-- TCXPO Oran Park, August & December — tcxpo.com.au ticket/event-info pages:
-- 9:30am–3pm, early-bird $25 (online only), general admission $15, kids free.
-- Organiser ticket page used rather than TryBooking (sibling listings exist
-- for the series' other dates)
update public.events set
  start_time = '09:30',
  end_time = '15:00',
  entry_fee_aud = 15.00,
  presale_fee_aud = 25.00,
  ticket_url = 'https://tcxpo.com.au/tcxpo-tickets/'
where slug in (
  'tcxpo-trading-card-expo-oran-park-august-2026',
  'tcxpo-trading-card-expo-oran-park-december-2026'
);

-- Brisbane Trading Card Show — visit.brisbane.qld.au / queensland.com listings
-- (Royal ICC, general entry 10am–4pm); organiser is Trading Card Show Australia
update public.events set
  venue_name = 'Royal International Convention Centre, Brisbane Showgrounds',
  start_time = '10:00',
  end_time = '16:00',
  organizer_name = 'Trading Card Show Australia',
  website_url = 'https://tradingcardshowaus.com.au',
  ticket_url = 'https://tradingcardshowaus.com.au/tickets',
  facebook_url = 'https://www.facebook.com/p/Trading-Card-Show-Australia-61566246814589/'
where slug = 'brisbane-trading-card-show-october-2026';

-- Collector's Paradise Oakleigh — Oakleigh Stadium street address per City of
-- Monash (monash.vic.gov.au)
update public.events set
  address = '2A Park Road'
where slug = 'collectors-paradise-oakleigh-2026-10-03';

-- SA Card Show — organiser ticket page
update public.events set
  ticket_url = 'https://sacardshow.com.au/buy-tickets'
where slug = 'sa-card-show-adelaide-october-2026';

-- Collector Con Newcastle — VisitNSW listing + TryBooking 1517586:
-- early-bird pre-entry $24, first GA session $14, kids 0-12 free
update public.events set
  entry_fee_aud = 14.00,
  presale_fee_aud = 24.00,
  ticket_url = 'https://www.trybooking.com/events/landing/1517586'
where slug = 'collector-con-newcastle-august-2026';

-- Collector Con Penrith — TryBooking 1517581 (Penrith GA price not published
-- in any indexed listing, so fee stays unset)
update public.events set
  ticket_url = 'https://www.trybooking.com/events/landing/1517581'
where slug = 'collector-con-penrith-july-2026';

-- CardVerse Adelaide — event listings: 11am–4pm, $10 entry, under 5 free;
-- organiser Instagram @cardverseadelaide
update public.events set
  start_time = '11:00',
  end_time = '16:00',
  entry_fee_aud = 10.00,
  instagram_url = 'https://www.instagram.com/cardverseadelaide/'
where slug = 'cardverse-adelaide-trading-card-show-august-2026';

-- Cardcore Vol. 5 — event listings: $20 at the door (card only), kids 12 and
-- under free; event page hosted by the venue
update public.events set
  entry_fee_aud = 20.00,
  website_url = 'https://www.welcometothornbury.com/welcome-to-cardcore'
where slug = 'cardcore-vol-5-2026-07-19';

-- Cardcore Sleepover — organiser Facebook: Saturday GA from 2pm (Sunday
-- community-day hours unannounced, so end_time stays unset); official site
-- is cardcore.club
update public.events set
  start_time = '14:00',
  website_url = 'https://www.cardcore.club'
where slug = 'cardcore-sleepover-2026-09-12';

-- Oz National Trading Card Show — Eventbrite-mirrored listing: entry from
-- 10am, general admission $15, under 12 free
update public.events set
  start_time = '10:00',
  entry_fee_aud = 15.00
where slug = 'oz-national-trading-card-show-melbourne-2026';

-- Melbourne Comic & Toy Fair — Eventbrite: at-door GA $12 (from noon),
-- online priority GA $10
update public.events set
  entry_fee_aud = 12.00,
  presale_fee_aud = 10.00
where slug = 'melbourne-comic-toy-fair-scoresby-july-2026';

-- Shire CollExpo — organiser Instagram (June-edition venue details were not
-- verifiable for the October date, so venue/times stay unset)
update public.events set
  instagram_url = 'https://www.instagram.com/shirecollexpo/'
where slug = 'shire-collexpo-2026-10-11';

-- Outwest Card Show — Facebook event page (no standalone organiser site found)
update public.events set
  facebook_url = 'https://www.facebook.com/events/dubbo-rsl-club/outwest-card-show/25144202608534681/'
where slug = 'outwest-card-show-dubbo-2026-10-03';

-- Trade Night at CLEET Collectables — official Whatnot shop profile
update public.events set
  website_url = 'https://www.whatnot.com/user/cleet_'
where slug = 'trade-night-at-cleet-collectables-2026-08-08';
