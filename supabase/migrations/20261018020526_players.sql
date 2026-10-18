-- Player pages: one public page per athlete (/players/<slug>) carrying a short
-- profile, every live listing of their cards and the price-tracker cards that
-- belong to them.
--
--   * `players` is the catalogue. Admins maintain it at Admin → Players; the
--     20 rows seeded below are the starting list and are inserted
--     `on conflict (slug) do nothing`, so an admin's later edits survive a
--     re-run of this file.
--   * `vault_items.player_id` is set by the Player picker in the card form. A
--     card tagged with a player shows on that player's page once it is listed
--     (visibility is still the card's own RLS — `publicly_listed`).
--   * `tracked_cards.player_id` ties the daily price snapshots to a player so
--     the page can chart their key cards. Backfilled here by name.
--
-- See docs/players.md.

-- ── 1. players ───────────────────────────────────────────────────────────────

create table if not exists public.players (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  -- The sport as the marketplace names it: one of the SPORTS_COLLECTIONS in
  -- data/collections.js ('NBA', 'NFL', 'MLB', 'AFL', 'NRL', 'Soccer',
  -- 'Formula 1', 'Golf', 'NHL', …). Free text so a new sport needs no
  -- migration, but it should match a collection so the page can link to it.
  sport            text not null,
  team             text,
  position         text,
  nationality      text,
  born_year        integer check (born_year is null or born_year between 1850 and 2100),
  -- '2003–present', '1984–2003', …
  career_span      text,
  -- One sentence for cards, search results and the <meta description>.
  headline         text,
  -- A few short paragraphs separated by blank lines (plain text, no HTML).
  bio              text,
  -- Why collectors chase them, what to look for, grading notes.
  collecting_notes text,
  -- [{ "name": "1986-87 Fleer #57", "note": "The rookie card." }, …]
  key_cards        jsonb not null default '[]'::jsonb,
  -- Other names people type: nicknames, diacritic-free spellings.
  aliases          text[] not null default '{}',
  image_url        text,
  -- Lower sorts first on the index page and in the picker.
  sort_order       integer not null default 100,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint players_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint players_key_cards_is_array check (jsonb_typeof(key_cards) = 'array')
);

create index if not exists players_published_sort_idx
  on public.players (sort_order, name) where is_published;
create index if not exists players_sport_idx
  on public.players (sport) where is_published;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_players_set_updated_at on public.players;
create trigger trg_players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

alter table public.players enable row level security;

-- Anyone can read a published player; admins see drafts too.
drop policy if exists players_public_select on public.players;
create policy players_public_select on public.players
  for select to public
  using (
    is_published
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists players_admin_insert on public.players;
create policy players_admin_insert on public.players
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists players_admin_update on public.players;
create policy players_admin_update on public.players
  for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists players_admin_delete on public.players;
create policy players_admin_delete on public.players
  for delete to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

grant select on public.players to anon, authenticated;
grant insert, update, delete on public.players to authenticated;

-- ── 2. The links from cards to players ───────────────────────────────────────

alter table public.vault_items
  add column if not exists player_id uuid references public.players(id) on delete set null;

-- The player page lists a player's cards through listings → vault_items, so
-- the lookup is "vault_items where player_id = ?" — small, partial.
create index if not exists vault_items_player_id_idx
  on public.vault_items (player_id) where player_id is not null;

alter table public.tracked_cards
  add column if not exists player_id uuid references public.players(id) on delete set null;

create index if not exists tracked_cards_player_id_idx
  on public.tracked_cards (player_id) where player_id is not null;

-- ── 3. Seed: the twenty most collected athletes ──────────────────────────────
-- Bios are plain text; paragraphs are separated by a blank line. Figures are
-- career facts (titles, awards), never prices — prices come from the tracker.

insert into public.players
  (slug, name, sport, team, position, nationality, born_year, career_span, headline, bio, collecting_notes, key_cards, aliases, sort_order)
values
(
  'michael-jordan', 'Michael Jordan', 'NBA', 'Chicago Bulls', 'Shooting guard', 'United States', 1963, '1984–2003',
  'Six-time NBA champion and the player the modern card hobby is built around.',
  E'Michael Jordan won six NBA championships with the Chicago Bulls across two three-peats (1991–93 and 1996–98), was named Finals MVP in all six, and collected five regular-season MVP awards and ten scoring titles. He retired for good in 2003 after two seasons with the Washington Wizards.\n\nHis arrival in 1984 coincided with the boom years of basketball cards, and his cards have anchored the hobby ever since. Every modern sports-card price index leans on Jordan.',
  E'The 1986-87 Fleer #57 is the recognised rookie card and the single most traded vintage basketball card. Centering is the usual grading problem on Fleer, so a well-centred copy carries a premium at every grade. The 1984-85 and 1985-86 Star Company cards pre-date Fleer but were not pack-issued, so most of the hobby treats them as XRCs rather than true rookies.\n\nCounterfeits of the Fleer rookie are common. Buy graded from a recognised company or from a seller who will stand behind the card.',
  '[{"name":"1986-87 Fleer #57","note":"The rookie card. The hobby''s benchmark vintage basketball card."},{"name":"1986-87 Fleer Sticker #8","note":"The rookie-year sticker, a far cheaper way into 1986 Fleer."},{"name":"1997-98 Metal Universe Precious Metal Gems","note":"The modern-era grail: a tiny print run and a mirror finish that scratches easily."}]'::jsonb,
  '{"MJ","Air Jordan","Jordan"}', 1
),
(
  'lebron-james', 'LeBron James', 'NBA', 'Los Angeles Lakers', 'Forward', 'United States', 1984, '2003–present',
  'Four-time champion, four-time MVP and the NBA''s all-time leading scorer.',
  E'LeBron James went straight from high school in Akron, Ohio to the first pick of the 2003 draft. He has won four championships with three franchises (Miami 2012 and 2013, Cleveland 2016, the Lakers 2020), four MVP awards and four Finals MVPs, and in February 2023 passed Kareem Abdul-Jabbar as the league''s all-time leading scorer.\n\nMore than two decades after his debut he is still an All-Star, which is why his rookie cards have held their place at the top of the modern market for so long.',
  E'The 2003-04 rookie class is the most collected of the modern era and LeBron''s cards lead it. Topps Chrome #111 is the mainstream chase, the base Topps #221 the affordable one, and the Upper Deck Exquisite Rookie Patch Autograph (numbered to 99) is the card the whole premium-rookie market is modelled on.\n\nRefractors and low-numbered parallels of the 2003-04 Chrome card carry large premiums, so check the serial number and the finish before paying parallel money.',
  '[{"name":"2003-04 Topps Chrome #111","note":"The flagship rookie. Refractor and Gold Refractor parallels are the chase."},{"name":"2003-04 Topps #221","note":"The most affordable licensed rookie card."},{"name":"2003-04 Upper Deck Exquisite Collection Rookie Patch Autograph #78","note":"Numbered to 99; the modern hobby''s most famous card."}]'::jsonb,
  '{"King James","LBJ","Bron"}', 2
),
(
  'kobe-bryant', 'Kobe Bryant', 'NBA', 'Los Angeles Lakers', 'Shooting guard', 'United States', 1978, '1996–2016',
  'Five-time champion who spent all twenty seasons with the Lakers.',
  E'Kobe Bryant was drafted out of high school in 1996 and traded to the Lakers on draft night, where he stayed for twenty seasons. He won five championships (2000–02 and 2009–10), the 2008 MVP award, two Finals MVPs and two scoring titles, and scored 81 points in a single game in 2006. Both of his jersey numbers, 8 and 24, are retired by the Lakers.\n\nHis death in January 2020 brought a wave of new collectors to his cards, and demand has stayed high since.',
  E'Kobe has a crowded rookie year: 1996-97 Topps Chrome #138 is the headline card, the base Topps #138 the entry point, and Flair Showcase, Finest and Skybox E-X2000 Credentials are the premium alternatives. Chrome Refractors from 1996-97 are scarce and command a large multiple of the base Chrome.\n\nSurface condition matters on Chrome of this era, which scratches easily. Lakers team-colour parallels and autographs from his later Panini years are a popular, cheaper way to collect him.',
  '[{"name":"1996-97 Topps Chrome #138","note":"The rookie card most collectors want; the Refractor is the chase."},{"name":"1996-97 Topps #138","note":"The flagship base rookie."},{"name":"1996-97 Flair Showcase Row 2 #31","note":"A premium rookie with a short print run by 1990s standards."}]'::jsonb,
  '{"Black Mamba","Kobe","Mamba"}', 3
),
(
  'stephen-curry', 'Stephen Curry', 'NBA', 'Golden State Warriors', 'Point guard', 'United States', 1988, '2009–present',
  'Four-time champion and the greatest shooter in the history of the game.',
  E'Stephen Curry was the seventh pick of the 2009 draft and has spent his whole career with Golden State, winning four championships (2015, 2017, 2018, 2022), back-to-back MVP awards in 2015 and 2016 (the second unanimous) and the 2022 Finals MVP. He holds the NBA record for career three-pointers and changed how the game is played.',
  E'His rookie year is 2009-10. Topps Chrome #101 is the key card and one of the last Topps basketball rookies before the licence moved to Panini; the base Topps #321 is the affordable version, and the National Treasures Rookie Patch Autograph is the premium card. Chrome Refractors and Gold Refractors (numbered to 50) carry the biggest premiums.',
  '[{"name":"2009-10 Topps Chrome #101","note":"The flagship rookie; Refractors are the chase."},{"name":"2009-10 Topps #321","note":"The base rookie card."},{"name":"2009-10 Playoff National Treasures Rookie Patch Autograph #206","note":"Numbered to 99."}]'::jsonb,
  '{"Steph","Steph Curry","Chef Curry"}', 4
),
(
  'victor-wembanyama', 'Victor Wembanyama', 'NBA', 'San Antonio Spurs', 'Centre', 'France', 2004, '2023–present',
  'The most anticipated prospect since LeBron and the 2024 Rookie of the Year.',
  E'Victor Wembanyama arrived from France as the first pick of the 2023 draft, standing around 2.24 m with guard skills and the reach to block almost anything. He was the unanimous 2024 Rookie of the Year and finished second in Defensive Player of the Year voting in his first season.\n\nHis cards were the most sought-after of any rookie class in years, and his sophomore-season products carried the same demand.',
  E'The 2023-24 Panini Prizm base rookie #136 is the volume card everyone chases, with the Silver Prizm the standard premium parallel and the coloured, numbered Prizms above that. Prizm Draft Picks (released first) and Donruss Rated Rookie are the cheaper rookie-year alternatives, and the National Treasures Rookie Patch Autograph is the top card.\n\nBecause demand is so high, fakes of the Prizm rookie and Silver exist. Buy graded or from a trusted seller, and compare the refractive pattern with a known copy.',
  '[{"name":"2023-24 Panini Prizm #136","note":"The flagship rookie. Silver and coloured Prizms are the chase."},{"name":"2023-24 Panini Donruss Rated Rookie #250","note":"An affordable licensed rookie."},{"name":"2023-24 Panini National Treasures Rookie Patch Autograph","note":"Numbered to 99; the premium rookie."}]'::jsonb,
  '{"Wemby","Wembanyama"}', 5
),
(
  'luka-doncic', 'Luka Dončić', 'NBA', 'Los Angeles Lakers', 'Guard', 'Slovenia', 1999, '2018–present',
  'EuroLeague MVP at 19, NBA Rookie of the Year, and the centre of the 2025 trade that stunned the league.',
  E'Luka Dončić was already a EuroLeague champion and MVP with Real Madrid when he was taken third in the 2018 draft and sent to Dallas on draft night. He was the 2019 Rookie of the Year, led the Mavericks to the 2024 NBA Finals and won the 2024 scoring title. In February 2025 he was traded to the Los Angeles Lakers in one of the most surprising deals in NBA history.',
  E'His 2018-19 rookie year is the modern market''s second pillar after the 2003-04 class. Panini Prizm #280 is the headline card, the Silver Prizm the standard premium, and the National Treasures Rookie Patch Autograph (to 99) the top card. Donruss Rated Rookie and Prizm Draft Picks are the cheaper routes in.\n\nSpelling matters when searching: many listings drop the diacritic and write Doncic.',
  '[{"name":"2018-19 Panini Prizm #280","note":"The flagship rookie; Silver Prizm is the chase."},{"name":"2018-19 Panini Donruss Rated Rookie #177","note":"The affordable rookie."},{"name":"2018-19 Panini National Treasures Rookie Patch Autograph #127","note":"Numbered to 99."}]'::jsonb,
  '{"Luka Doncic","Luka","Doncic"}', 6
),
(
  'josh-giddey', 'Josh Giddey', 'NBA', 'Chicago Bulls', 'Guard', 'Australia', 2002, '2021–present',
  'Melbourne-raised playmaker and the most collected Australian in the NBA.',
  E'Josh Giddey came through the Adelaide 36ers in the NBL''s Next Stars program and was the sixth pick of the 2021 draft by Oklahoma City, where he became the youngest player in NBA history to record a triple-double. He was traded to the Chicago Bulls in 2024 and is a regular for the Australian Boomers.\n\nFor Australian collectors he is the local entry point to the modern NBA market: his rookie cards trade actively here and his Boomers connection keeps demand steady between seasons.',
  E'The 2021-22 Panini Prizm rookie is the card to own, with the Silver Prizm the usual premium parallel. Donruss Rated Rookie, Hoops and Prizm Draft Picks are the affordable rookies; Select and National Treasures carry the premium autographs and patches. Australian-themed inserts and his NBL Next Stars cards are a niche but popular local chase.',
  '[{"name":"2021-22 Panini Prizm Rookie","note":"The flagship rookie; Silver Prizm is the chase."},{"name":"2021-22 Panini Donruss Rated Rookie","note":"The affordable rookie."},{"name":"2021-22 Panini National Treasures Rookie Patch Autograph","note":"The premium rookie."}]'::jsonb,
  '{"Giddey"}', 7
),
(
  'patrick-mahomes', 'Patrick Mahomes', 'NFL', 'Kansas City Chiefs', 'Quarterback', 'United States', 1995, '2017–present',
  'Three-time Super Bowl champion and the face of the modern NFL.',
  E'Patrick Mahomes was the tenth pick of the 2017 draft and sat for a season behind Alex Smith before becoming the Kansas City starter in 2018, when he threw 50 touchdowns and won MVP. He has since won three Super Bowls (LIV, LVII and LVIII), three Super Bowl MVPs and a second regular-season MVP in 2022.',
  E'His 2017 rookie cards are the modern football market''s benchmark. Panini Prizm #269 is the mainstream chase and Silver Prizm the standard premium; the Contenders Rookie Ticket autograph and the National Treasures Rookie Patch Autograph are the premium cards. Donruss Rated Rookie #327 and Prizm Draft Picks are the affordable ways in.',
  '[{"name":"2017 Panini Prizm #269","note":"The flagship rookie; Silver and coloured Prizms are the chase."},{"name":"2017 Panini Donruss Rated Rookie #327","note":"The affordable rookie."},{"name":"2017 Panini Contenders Rookie Ticket Autograph #303","note":"The classic on-card rookie autograph."}]'::jsonb,
  '{"Mahomes"}', 8
),
(
  'tom-brady', 'Tom Brady', 'NFL', 'New England Patriots / Tampa Bay Buccaneers', 'Quarterback', 'United States', 1977, '2000–2022',
  'Seven Super Bowl rings, more than any franchise, from the 199th pick of the 2000 draft.',
  E'Tom Brady was the 199th pick of the 2000 draft and became the most decorated player in NFL history: six Super Bowls with New England and a seventh with Tampa Bay in his first season there, five Super Bowl MVPs and three regular-season MVPs. He retired in early 2023 after 23 seasons and holds the career records for passing yards and touchdowns.',
  E'Brady has the most valuable rookie cards in football. The 2000 Playoff Contenders Championship Ticket autograph (numbered to 100) is the grail; the standard Contenders Rookie Ticket autograph #144 is the headline card; and 2000 Bowman Chrome #236, SP Authentic #118 (numbered to 1,250) and Upper Deck Pros & Prospects are the premium non-auto rookies. Base 2000 Bowman and Topps rookies are affordable.\n\nBecause he was a late pick, his 2000 cards were printed in small numbers compared with the quarterbacks drafted above him.',
  '[{"name":"2000 Playoff Contenders Rookie Ticket Autograph #144","note":"The headline rookie autograph; the Championship Ticket parallel (/100) is the grail."},{"name":"2000 Bowman Chrome #236","note":"The key non-autographed rookie."},{"name":"2000 SP Authentic #118","note":"Numbered to 1,250."}]'::jsonb,
  '{"TB12","Brady"}', 9
),
(
  'shohei-ohtani', 'Shohei Ohtani', 'MLB', 'Los Angeles Dodgers', 'Designated hitter / Pitcher', 'Japan', 1994, '2018–present',
  'The two-way superstar: three MVPs, a 50-homer 50-steal season and a World Series ring.',
  E'Shohei Ohtani joined the Los Angeles Angels from Japan''s Hokkaido Nippon-Ham Fighters in 2018 and was Rookie of the Year as a hitter and a pitcher at once. He won MVP awards in 2021, 2023 and 2024, signed with the Dodgers for 2024, became the first player with 50 home runs and 50 stolen bases in a season, and won the 2024 World Series.',
  E'His 2018 rookie cards lead the baseball market. Topps Chrome #150 and Topps Update #US1 are the key flagship rookies, Bowman Chrome has his first Bowman cards, and the Topps Chrome and Bowman Chrome autographs are the premium chase. His Japanese BBM cards from the Fighters years are a growing niche. Chrome refractors and numbered parallels carry large premiums.',
  '[{"name":"2018 Topps Chrome #150","note":"The flagship rookie; refractors are the chase."},{"name":"2018 Topps Update #US1","note":"The affordable flagship rookie."},{"name":"2018 Bowman Chrome Rookie Autograph","note":"The premium rookie autograph."}]'::jsonb,
  '{"Ohtani","Shotime"}', 10
),
(
  'mickey-mantle', 'Mickey Mantle', 'MLB', 'New York Yankees', 'Centre fielder', 'United States', 1931, '1951–1968',
  'The Yankees legend whose 1952 Topps card is the most valuable sports card ever sold.',
  E'Mickey Mantle played eighteen seasons for the New York Yankees, winning seven World Series, three MVP awards and the 1956 Triple Crown. He was a switch-hitter with enormous power and the most famous player of baseball''s 1950s golden age.\n\nHis cards define vintage collecting: a 1952 Topps Mantle sold for US$12.6 million in 2022, a record for any sports card.',
  E'The 1952 Topps #311 is the hobby''s most famous card but not his first; the 1951 Bowman #253 is the true rookie. Every Topps and Bowman Mantle from the 1950s is collected, and condition drives value far more than for modern cards, so a graded example from PSA or SGC is the norm. Reprints and counterfeits of the 1952 Topps are widespread; treat any raw copy with caution.',
  '[{"name":"1952 Topps #311","note":"The most valuable sports card ever sold."},{"name":"1951 Bowman #253","note":"The true rookie card."},{"name":"1953 Topps #82","note":"A painted portrait and a vintage favourite."}]'::jsonb,
  '{"Mantle","The Mick"}', 11
),
(
  'lionel-messi', 'Lionel Messi', 'Soccer', 'Inter Miami', 'Forward', 'Argentina', 1987, '2004–present',
  'Eight Ballon d''Or awards and the 2022 World Cup: the most collected footballer in the world.',
  E'Lionel Messi came through Barcelona''s academy and spent 17 seasons with the first team, winning ten La Liga titles and four Champions Leagues before moving to Paris Saint-Germain in 2021 and Inter Miami in 2023. He has won a record eight Ballon d''Or awards, captained Argentina to the 2021 and 2024 Copa América titles and the 2022 World Cup, and holds the record for most goals for a single club.',
  E'Messi''s rookie-year cards are from 2004-05: the Panini Sports Mega Cracks #71 is the recognised rookie, and his Panini stickers from the same season are collected alongside it. Modern Topps Chrome UEFA Champions League cards, Topps Merlin and Panini Prizm World Cup cards are the volume market, with the 2022 World Cup products in particular demand after Argentina''s win.\n\nFootball cards lean heavily on stickers and European issues, so check whether a listing is a card or a sticker before comparing prices.',
  '[{"name":"2004-05 Panini Sports Mega Cracks #71","note":"The recognised rookie card."},{"name":"2004-05 Panini Barcelona sticker","note":"The rookie-year sticker."},{"name":"2022 Panini Prizm World Cup #9","note":"The World Cup-winning season''s most traded card."}]'::jsonb,
  '{"Messi","Leo Messi","La Pulga"}', 12
),
(
  'cristiano-ronaldo', 'Cristiano Ronaldo', 'Soccer', 'Al Nassr', 'Forward', 'Portugal', 1985, '2002–present',
  'Five Ballon d''Or awards, five Champions Leagues and international football''s record goalscorer.',
  E'Cristiano Ronaldo made his name at Sporting Lisbon and Manchester United before nine seasons at Real Madrid, where he won four Champions League titles, then Juventus, a return to United and Al Nassr in Saudi Arabia from 2023. He has won five Ballon d''Or awards and Euro 2016 with Portugal, and holds the record for international goals.',
  E'His first cards are from the 2002-03 season with Sporting: the Panini Sports Megacracks card and his Portuguese Panini stickers are the rookie issues, with the 2003-04 Manchester United cards (Upper Deck, Panini) the first with a global club. Modern Topps Chrome Champions League and Panini Prizm cards are the volume market. Early Portuguese issues are scarce and often graded.',
  '[{"name":"2002-03 Panini Sports Megacracks #137","note":"The rookie card, from his Sporting Lisbon season."},{"name":"2003-04 Upper Deck Manchester United","note":"His first season at a global club."},{"name":"2018-19 Topps Chrome UEFA Champions League","note":"Modern volume market; refractors are the chase."}]'::jsonb,
  '{"CR7","Ronaldo"}', 13
),
(
  'connor-bedard', 'Connor Bedard', 'NHL', 'Chicago Blackhawks', 'Centre', 'Canada', 2005, '2023–present',
  'The generational talent who went first overall in 2023 and won the Calder Trophy as Rookie of the Year.',
  E'Connor Bedard was granted exceptional status to play in the WHL at 15, was the first pick of the 2023 NHL draft by the Chicago Blackhawks and won the 2024 Calder Trophy as Rookie of the Year despite missing six weeks with a broken jaw. He is the most anticipated hockey prospect since Connor McDavid.',
  E'Hockey''s rookie market centres on Upper Deck. The 2023-24 Upper Deck Young Guns #451 is the flagship rookie, Upper Deck Series 1 and 2 carry the other base rookies, and The Cup Rookie Patch Autograph is the premium card. Canvas and Exclusives parallels of the Young Guns carry the usual premiums.',
  '[{"name":"2023-24 Upper Deck Young Guns #451","note":"The flagship rookie."},{"name":"2023-24 Upper Deck The Cup Rookie Patch Autograph","note":"The premium rookie, numbered to 99."},{"name":"2023-24 Upper Deck SP Authentic Future Watch Autograph","note":"A popular mid-range rookie autograph."}]'::jsonb,
  '{"Bedard"}', 14
),
(
  'max-verstappen', 'Max Verstappen', 'Formula 1', 'Red Bull Racing', 'Driver', 'Netherlands', 1997, '2015–present',
  'Four consecutive Formula 1 world championships from 2021 to 2024.',
  E'Max Verstappen made his Formula 1 debut at 17 with Toro Rosso in 2015, won on his first start for Red Bull in 2016 and has driven for the team ever since. He won four consecutive world championships from 2021 to 2024, including a record-breaking 2023 season with 19 wins from 22 races.',
  E'Topps has held the Formula 1 licence since 2020, so his rookie-year cards are the 2020 Topps Chrome Formula 1 set (the first licensed Topps F1 release) and 2020 Topps Dynasty. Chrome refractors and numbered parallels are the chase; Topps Dynasty and Topps Chrome Sapphire are the premium products. Earlier Toro Rosso-era cards exist only in unlicensed or regional sets.',
  '[{"name":"2020 Topps Chrome Formula 1 Max Verstappen","note":"The first licensed Topps F1 card; refractors are the chase."},{"name":"2020 Topps Dynasty Formula 1 Autograph Patch","note":"The premium rookie-year card."},{"name":"2021 Topps Chrome Formula 1 Sapphire","note":"The championship season in the premium Sapphire finish."}]'::jsonb,
  '{"Verstappen","Super Max"}', 15
),
(
  'tiger-woods', 'Tiger Woods', 'Golf', 'PGA Tour', 'Golfer', 'United States', 1975, '1996–present',
  'Fifteen majors, 82 PGA Tour wins and the card that started golf collecting.',
  E'Tiger Woods turned professional in 1996 and won the 1997 Masters by twelve strokes at 21. He has won fifteen majors, tied the record of 82 PGA Tour victories and held the world number one ranking for a record 683 weeks, completing the ''Tiger Slam'' of all four majors in a row across 2000 and 2001.',
  E'Golf cards barely existed before Tiger. His 2001 Upper Deck #1 is the recognised rookie card and the single most collected golf card; the 2001 SP Authentic #45 rookie is the premium version and its autographed parallel is the grail. Later Upper Deck and SP autographs, and the 2001 Upper Deck Tiger''s Tales insert set, are popular and affordable.',
  '[{"name":"2001 Upper Deck #1","note":"The rookie card."},{"name":"2001 SP Authentic #45","note":"The premium rookie; the autograph parallel is the grail."},{"name":"2001 Upper Deck Tiger''s Tales","note":"A 30-card insert set tracing his career to that point."}]'::jsonb,
  '{"Tiger"}', 16
),
(
  'nick-daicos', 'Nick Daicos', 'AFL', 'Collingwood', 'Midfielder', 'Australia', 2003, '2022–present',
  'Collingwood premiership midfielder and the most collected player in modern AFL cards.',
  E'Nick Daicos joined Collingwood as a father-son selection in the 2021 draft, won the 2022 Rising Star award and was a key part of the Magpies'' 2023 premiership. He has been All-Australian and a top-three Brownlow Medal finisher, and is the most in-demand name in Australian rules football cards.',
  E'AFL cards are made by Select, so his 2022 Select Footy Stars rookie cards are the ones to own: the base rookie, the Rookie Signature and the numbered parallels. Select''s Supremacy and Legacy releases carry the premium autographs and patches. Collingwood''s large supporter base keeps demand for his cards high, and low-numbered parallels sell fast.',
  '[{"name":"2022 Select Footy Stars Rookie","note":"The base rookie card."},{"name":"2022 Select Footy Stars Rookie Signature","note":"The signed rookie card."},{"name":"2023 Select Supremacy Premiership Patch","note":"The premiership-season premium card."}]'::jsonb,
  '{"Daicos"}', 17
),
(
  'dustin-martin', 'Dustin Martin', 'AFL', 'Richmond', 'Midfielder / Forward', 'Australia', 1991, '2010–2024',
  'Three premierships, three Norm Smith Medals and a Brownlow: Richmond''s modern great.',
  E'Dustin Martin played his whole career at Richmond from 2010 to 2024. He won the 2017 Brownlow Medal and three premierships (2017, 2019, 2020), and is the only player to win three Norm Smith Medals as best on ground in a Grand Final. He retired midway through the 2024 season.',
  E'His 2010 Select Champions rookie is the key card, and his premiership-year Select cards (2017, 2019, 2020) with signatures or patches are the premium chase. Richmond''s big supporter base makes him one of the few retired AFL players whose cards trade actively.',
  '[{"name":"2010 Select Champions Rookie","note":"The rookie card."},{"name":"2017 Select Certified Signature","note":"The Brownlow and premiership season."},{"name":"2020 Select Supremacy Premiership Patch","note":"The third premiership."}]'::jsonb,
  '{"Dusty"}', 18
),
(
  'nathan-cleary', 'Nathan Cleary', 'NRL', 'Penrith Panthers', 'Halfback', 'Australia', 1997, '2016–present',
  'Halfback of Penrith''s four straight premierships and the NRL''s most collected player.',
  E'Nathan Cleary debuted for Penrith in 2016 and steered the Panthers to four consecutive premierships from 2021 to 2024, winning two Clive Churchill Medals as the Grand Final''s best player. He is a regular for New South Wales and Australia and the game''s premier halfback.',
  E'NRL cards are made by TLA (Traders), so his 2016 Traders rookie cards are the ones to own, with the Rookie Signature the premium version. Premiership-year Traders and Elite products carry his autographs and patches. NRL cards are a smaller market than AFL, so low-numbered Cleary parallels are genuinely scarce.',
  '[{"name":"2016 ESP Traders Rookie","note":"The rookie card."},{"name":"2016 ESP Traders Rookie Signature","note":"The signed rookie."},{"name":"2021 TLA Traders Premiership Signature","note":"The first premiership season."}]'::jsonb,
  '{"Cleary"}', 19
),
(
  'reece-walsh', 'Reece Walsh', 'NRL', 'Brisbane Broncos', 'Fullback', 'Australia', 2002, '2021–present',
  'Brisbane''s electric fullback and the NRL''s biggest modern card market.',
  E'Reece Walsh debuted for the New Zealand Warriors in 2021 at 18, returned to the Brisbane Broncos in 2023 and was a Dally M Fullback of the Year and a Queensland State of Origin regular in the same season. His speed and highlight plays made him the most popular young player in the game.',
  E'His 2021 TLA Traders rookie cards (as a Warrior) are the ones collectors chase, with the Rookie Signature the premium version. His Broncos-era Traders and Elite cards, and his Queensland Origin cards, trade actively. Low-numbered parallels of the rookie are scarce.',
  '[{"name":"2021 TLA Traders Rookie","note":"The rookie card, in Warriors colours."},{"name":"2021 TLA Traders Rookie Signature","note":"The signed rookie."},{"name":"2023 TLA Traders Elite Signature","note":"The breakout Broncos season."}]'::jsonb,
  '{"Walsh"}', 20
)
on conflict (slug) do nothing;

-- ── 4. Backfill tracked_cards.player_id by name ──────────────────────────────
-- Match a tracker card to a player when the card's name starts with the
-- player's name (the tracker names its sports cards "<Player> <Set> Rookie").

update public.tracked_cards tc
set player_id = p.id
from public.players p
where tc.player_id is null
  and tc.category in ('basketball', 'afl', 'nrl')
  and lower(tc.name) like lower(p.name) || ' %';

-- Diacritic-free tracker names (e.g. "Luka Doncic") against the accented row.
update public.tracked_cards tc
set player_id = p.id
from public.players p
where tc.player_id is null
  and tc.category in ('basketball', 'afl', 'nrl')
  and exists (
    select 1 from unnest(p.aliases) a where lower(tc.name) like lower(a) || ' %'
  );
