-- One Piece Card Game — Flame Flame Fruit Coliseum MELBOURNE [Oceania],
-- Sun 24 January 2027, Marvel Stadium Function Venues Docklands (Victory
-- Room), run by TAK Games.
--
-- The event is already live (approved). The nightly scanner found it on
-- 8 Nov 2026 and an admin reviewed it on 10 Nov 2026. This migration fills in
-- the full listing from the organiser's Humanitix page as at 10 Nov 2026:
--   - the description becomes sections the event page can render: format,
--     check-in times, the Finals weekend schedule (Fri 22 – Sun 24 Jan),
--     venue rules, prioritised ticketing for Oceania residents, the refund
--     policy, health advice and the organiser's bio
--   - the short description is corrected. The Coliseum is a separate Swiss
--     event that runs alongside the Finals top cut, not the top cut itself
--   - TAK Games' website, Facebook and X go in the organiser links (the
--     website is also the organiser `url` in the Event JSON-LD). The
--     Humanitix page stays as `source_url`, so the weekly event watch still
--     queues any date, venue or price change for an admin
--   - tags and SEO description/keywords
--   - one pinned Information Board post: the player checklist
--
-- These are left as they are: cover image, YouTube video, $65 entry fee,
-- ticket link, times, venue, status and featuring.
--
-- Idempotent: the update targets the event by id *and* slug, so it does
-- nothing if the event was deleted or re-slugged. The board post is skipped
-- when a post with the same title is already on the board.

update public.events
set
  short_description = 'TAK Games'' One Piece Card Game Flame Flame Fruit Coliseum: a capped, constructed Swiss event (best-of-1 rounds) on Finals Sunday, 24 January 2027, at Marvel Stadium Function Venues, Docklands. Register early.',
  description = E'TAK Games presents the One Piece Card Game Flame Flame Fruit Coliseum, part of the One Piece Card Game Championship Events in the Oceania region. It runs on Sunday 24 January 2027, 9:00am–5:00pm AEDT, in the Victory Room at Marvel Stadium Function Venues, Docklands, on the final day of the Melbourne Finals weekend.\n\nThis event is capped. Please register early to confirm your spot.\n\nFORMAT\n- Constructed, Swiss tournament\n- Each round is a best-of-1 match: 30 minutes of round time + 5 minutes of extra time\n- Players must submit their deck list electronically in TCG+\n\nON THE DAY\n- Wristband distribution begins at 8:00am Sunday\n- Attendees can enter the venue from 8:45am\n\nFINALS WEEKEND SCHEDULE\nFriday 22 January\n- One Piece Treasure Cup\n- One Piece Auto Matching Battles\n\nSaturday 23 January\n- One Piece Finals: Qualifying Rounds\n- One Piece Auto Matching Battles\n\nSunday 24 January\n- One Piece Finals: Top Cut\n- One Piece Flame Flame Fruit Coliseum (this event)\n- One Piece Auto Matching Battles\n\nVENUE RULES\nFor the safety of attendees, the following rules are in place:\n1. Entry to the tournament area is only available to players with a valid ticket / badge.\n2. Buying and selling in the tournament venue is strictly prohibited.\n3. Backpacks, suitcases and other large bags are not permitted in the tournament venue. A small bag, roughly A4 in size, is the maximum allowed, enough to carry a deck, playmat and other required tournament materials.\n\nPRIORITISED TICKETING ACCESS\nWhile all are welcome, Bandai planned these events with the capacity of the Oceania player base in mind. Tickets can be bought on launch by residents and citizens of the Oceania region. Tickets bought by non-residents will be refunded and those players placed on a waiting list. Non-residents on the waiting list can buy tickets one week before the event date if seats are available.\n\nREFUND POLICY\nRefunds are available up to 24 hours before the event starts. A 30% administration fee applies to change-of-mind refund requests, including any applicable ticketing fees.\n\nHEALTH & SAFETY\nEvents are subject to cancellation or changes due to COVID-19 considerations. Following the advice of the Victorian Department of Health, attendees who feel unwell or have COVID symptoms are asked to stay home and not attend.\n\nVENUE\nMarvel Stadium Function Venues Docklands, Victory Room, 740 Bourke St, Docklands VIC 3008. Southern Cross Station is a short walk away.\n\nABOUT TAK GAMES\nFounded in 2014, TAK Games are Oceania''s premier tournament play organisers. TAK Games focus on providing meaningful and exciting tournament experiences for all players, whatever their level of experience.\n\nTickets are sold through Humanitix, which gives 100% of the profits from booking fees to charity.',
  website_url = 'https://www.tak-games.com.au/',
  facebook_url = 'https://www.facebook.com/TAKGames.au',
  x_url = 'https://x.com/TAKGames_au',
  tags = array[
    'One Piece','One Piece Card Game','Bandai','TAK Games','Tournament','Championship',
    'Oceania','Flame Flame Fruit Coliseum','Constructed','Swiss','Regionals',
    'Melbourne','Docklands','Marvel Stadium','VIC'
  ]::text[],
  seo_description = 'One Piece Card Game Flame Flame Fruit Coliseum, Sun 24 Jan 2027 at Marvel Stadium, Docklands. Constructed Swiss, best-of-1 rounds. Capped entry, register early.',
  seo_keywords = array[
    'Flame Flame Fruit Coliseum',
    'Flame Flame Fruit Coliseum Melbourne',
    'One Piece Card Game Melbourne',
    'One Piece tournament Melbourne',
    'One Piece Card Game Championship Oceania',
    'One Piece Championship Finals Oceania 2027',
    'One Piece Treasure Cup Melbourne',
    'One Piece regionals Australia',
    'One Piece TCG 2027',
    'TAK Games events',
    'Marvel Stadium card game event',
    'Docklands card tournament',
    'Melbourne card tournament January 2027',
    'trading card events VIC'
  ]
where id = '0bad64c4-3a9a-4914-92b8-274cf055c940'
  and slug = 'one-piece-card-game-flame-flame-fruit-coliseum-melbourne-oceania-2027-01-24';

-- Information Board: a pinned player checklist. Board posts need an author
-- profile, so the longest-standing admin stands in. The post is skipped when
-- there is no admin (e.g. on a fresh local database).
with ev as (
  select id from public.events
  where id = '0bad64c4-3a9a-4914-92b8-274cf055c940'
    and slug = 'one-piece-card-game-flame-flame-fruit-coliseum-melbourne-oceania-2027-01-24'
), author as (
  select id from public.profiles where is_admin = true order by created_at asc limit 1
)
insert into public.event_board_posts (event_id, author_id, title, body, is_pinned)
select ev.id, author.id, p.title, p.body, true
from ev, author, (values
  (
    'Player checklist: wristbands, deck lists, bags and tickets',
    E'When: Sunday 24 January 2027. Wristband distribution starts at 8:00am and the venue opens at 8:45am. The event runs 9:00am–5:00pm AEDT.\n\nWhere: Marvel Stadium Function Venues Docklands, Victory Room, 740 Bourke St, Docklands VIC 3008. Southern Cross Station is a short walk away.\n\nBefore you arrive:\n- Submit your deck list electronically in TCG+. Paper lists aren''t used.\n- Bring a small bag only. Roughly A4 is the maximum; backpacks, suitcases and other large bags aren''t allowed in the tournament venue.\n- Have your ticket ready. Only players with a valid ticket / badge can enter the tournament area.\n\nFormat: constructed Swiss, best-of-1 rounds, 30 minutes per round + 5 minutes of extra time.\n\nNo trading or selling: buying and selling in the tournament venue is strictly prohibited, so keep trades for outside the venue.\n\nTickets: the event is capped. Oceania residents and citizens can buy on launch; non-resident purchases are refunded and those players waitlisted, with waitlist sales opening one week before the event if seats remain. Refunds are available up to 24 hours before the start, with a 30% administration fee (including ticketing fees) for change-of-mind requests.\n\nThe same weekend: the One Piece Treasure Cup runs on Friday 22 January, the Finals Qualifying Rounds on Saturday 23 January and the Finals Top Cut alongside this event on Sunday. Auto Matching Battles run all three days.\n\nFeeling unwell or have COVID symptoms? Please stay home. Events can change or be cancelled due to COVID-19 considerations, so check this board before you leave.'
  )
) as p(title, body)
where not exists (
  select 1 from public.event_board_posts b
  where b.event_id = ev.id and b.title = p.title
);
