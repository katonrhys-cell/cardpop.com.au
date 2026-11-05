-- Expand the /prices tracker and repair the pages whose eBay search found
-- nothing. Companion to 20260703000003_seed_tracked_cards.sql.
--
-- Every search_query below was run against live eBay AU listings on
-- 2026-11-05 (the daily job adds eBay US on top) and returned at least six
-- listings of the right card. Card numbers were confirmed from several
-- listing titles agreeing; where they didn't, the number is NULL — better
-- absent than wrong on a public page. Blurbs are facts about the card, never
-- prices (prices come from the snapshots).
--
-- How the queries are written, and why: the job passes search_query to eBay as
-- `q` with no title filter, and eBay requires every word to match. Long
-- queries with rarity words ("Special Illustration Rare", "Alternate Art")
-- match item specifics rather than titles and let other printings of the same
-- Pokémon into the average, while `Pokemon <name> <number>` stays clean; a
-- leading `-word` excludes a known contaminant (`-102` keeps Base Set 4/102
-- out of the Base Set 2 4/130 search).
--
-- Idempotent: inserts skip existing slugs; updates are keyed on slug, so a
-- page keeps its URL and its price history.

-- ── 1. New cards ──────────────────────────────────────────────────────────────

insert into public.tracked_cards (slug, name, set_name, card_number, category, search_query, blurb) values

-- ── Pokémon: vintage & reprints ──────────────────────────────────────────────
('mewtwo-base-set', 'Mewtwo Holo', 'Base Set', '10/102', 'pokemon',
 'Pokemon Mewtwo Holo Base Set 10/102',
 'The Base Set holo of the original Legendary Pokémon. Alongside the three starters it is one of the most recognised holos of the 1999 set, and shadowless and 1st Edition copies carry a premium.'),
('dark-charizard-team-rocket', 'Dark Charizard Holo', 'Team Rocket', '4/82', 'pokemon',
 'Pokemon Dark Charizard Holo Team Rocket 4/82',
 'The holo Charizard of the 2000 Team Rocket set, which introduced the "Dark" Pokémon. It is the chase card of the set and a staple of vintage Charizard collections, with 1st Edition copies the most sought after.'),
('charizard-base-set-2', 'Charizard Holo', 'Base Set 2', '4/130', 'pokemon',
 'Pokemon Charizard 4/130 -102',
 'The Base Set 2 printing of the original Charizard holo — the same artwork as Base Set, renumbered 4/130 for the 2000 reprint set. It is a more affordable way into the classic Charizard than the 4/102 original.'),
('charizard-evolutions', 'Charizard Holo', 'XY Evolutions', '11/108', 'pokemon',
 'Pokemon Charizard Evolutions 11/108 -reverse -prerelease',
 'The XY Evolutions holo that brought the original Base Set Charizard artwork back in 2016. A popular modern take on the classic card; reverse-holo and prerelease versions are tracked out of this price.'),

-- ── Pokémon: Sword & Shield alternate arts ───────────────────────────────────
('espeon-vmax-alt-art-fusion-strike', 'Espeon VMAX (Alternate Art)', 'Fusion Strike', '270/264', 'pokemon',
 'Pokemon Espeon VMAX Alternate Art Fusion Strike 270/264',
 'One of the Fusion Strike alternate-art secret rares, and part of the Eeveelution alternate-art run collectors chase across the Sword & Shield era.'),
('mew-vmax-alt-art-fusion-strike', 'Mew VMAX (Alternate Art)', 'Fusion Strike', '269/264', 'pokemon',
 'Pokemon Mew VMAX 269/264',
 'Fusion Strike''s Mew VMAX alternate art, a headline pull from the set alongside Gengar VMAX. Some sellers list it as a full art or rainbow, so the price here is keyed on the 269/264 number.'),
('rayquaza-v-alt-art-evolving-skies', 'Rayquaza V (Alternate Art)', 'Evolving Skies', '194/203', 'pokemon',
 'Pokemon Rayquaza V Alternate Art Evolving Skies 194/203',
 'The Rayquaza V alternate art from Evolving Skies — a companion to the set''s Rayquaza VMAX and one of the most collected V alternate arts of the era.'),
('umbreon-v-alt-art-evolving-skies', 'Umbreon V (Alternate Art)', 'Evolving Skies', '189/203', 'pokemon',
 'Pokemon Umbreon V Alternate Art 189/203',
 'The Umbreon V alternate art from Evolving Skies, the smaller sibling of the "Moonbreon" VMAX and a key card for Umbreon collectors.'),
('dragonite-v-alt-art-evolving-skies', 'Dragonite V (Alternate Art)', 'Evolving Skies', '192/203', 'pokemon',
 'Pokemon Dragonite V Alternate Art Evolving Skies 192/203',
 'Evolving Skies'' Dragonite V alternate art, one of the set''s run of dragon-type alternate arts and a favourite with collectors of the set.'),
('tyranitar-v-alt-art-battle-styles', 'Tyranitar V (Alternate Art)', 'Battle Styles', '155/163', 'pokemon',
 'Pokemon Tyranitar V Alternate Art Battle Styles 155/163',
 'The chase alternate art of Battle Styles, and one of the standout V alternate arts of 2021.'),
('blaziken-vmax-alt-art-chilling-reign', 'Blaziken VMAX (Alternate Art)', 'Chilling Reign', '201/198', 'pokemon',
 'Pokemon Blaziken VMAX Alternate Art Chilling Reign 201/198',
 'The Blaziken VMAX alternate-art secret rare from Chilling Reign, one of the set''s top pulls.'),

-- ── Pokémon: Scarlet & Violet special illustration rares ─────────────────────
('blastoise-ex-sir-151', 'Blastoise ex (Special Illustration Rare)', 'Scarlet & Violet 151', '200/165', 'pokemon',
 'Pokemon Blastoise ex 200/165',
 'One of the three starter special illustration rares from Scarlet & Violet 151, the set built around the original 151 Pokémon.'),
('venusaur-ex-sir-151', 'Venusaur ex (Special Illustration Rare)', 'Scarlet & Violet 151', '198/165', 'pokemon',
 'Pokemon Venusaur ex 198/165',
 'The Venusaur ex special illustration rare from Scarlet & Violet 151, completing the starter trio with Charizard and Blastoise.'),
('alakazam-ex-sir-151', 'Alakazam ex (Special Illustration Rare)', 'Scarlet & Violet 151', '201/165', 'pokemon',
 'Pokemon Alakazam ex 201/165',
 'The Alakazam ex special illustration rare from Scarlet & Violet 151.'),
('erikas-invitation-sir-151', 'Erika''s Invitation (Special Illustration Rare)', 'Scarlet & Violet 151', '203/165', 'pokemon',
 'Pokemon Erika''s Invitation 203/165',
 'The trainer special illustration rare of Scarlet & Violet 151, featuring the Celadon City Gym Leader Erika.'),
('gardevoir-ex-sir-scarlet-violet', 'Gardevoir ex (Special Illustration Rare)', 'Scarlet & Violet', '245/198', 'pokemon',
 'Pokemon Gardevoir ex 245/198',
 'A special illustration rare from the Scarlet & Violet base set, and a card that saw heavy competitive play as well as collector demand.'),
('miraidon-ex-sir-scarlet-violet', 'Miraidon ex (Special Illustration Rare)', 'Scarlet & Violet', '244/198', 'pokemon',
 'Pokemon Miraidon ex 244/198',
 'The Miraidon ex special illustration rare from the Scarlet & Violet base set, featuring the Violet version''s box legendary.'),
('roaring-moon-ex-sir-paradox-rift', 'Roaring Moon ex (Special Illustration Rare)', 'Paradox Rift', '251/182', 'pokemon',
 'Pokemon Roaring Moon ex 251/182',
 'The Roaring Moon ex special illustration rare from Paradox Rift, the set built around the ancient and future Paradox Pokémon.'),
('terapagos-ex-sir-stellar-crown', 'Terapagos ex (Special Illustration Rare)', 'Stellar Crown', '170/142', 'pokemon',
 'Pokemon Terapagos ex 170/142',
 'The Terapagos ex special illustration rare from Stellar Crown, featuring the Stellar-type legendary.'),
('vaporeon-ex-sir-prismatic-evolutions', 'Vaporeon ex (Special Illustration Rare)', 'Prismatic Evolutions', '149/131', 'pokemon',
 'Pokemon Vaporeon ex 149/131',
 'One of the Eeveelution special illustration rares from Prismatic Evolutions, the Eevee-themed set that became one of the most sought-after releases of the Scarlet & Violet era.'),
('flareon-ex-sir-prismatic-evolutions', 'Flareon ex (Special Illustration Rare)', 'Prismatic Evolutions', '146/131', 'pokemon',
 'Pokemon Flareon ex 146/131',
 'The Flareon ex special illustration rare from Prismatic Evolutions, part of the set''s full run of Eeveelution special illustration rares.'),
('jolteon-ex-sir-prismatic-evolutions', 'Jolteon ex (Special Illustration Rare)', 'Prismatic Evolutions', '153/131', 'pokemon',
 'Pokemon Jolteon ex 153/131',
 'The Jolteon ex special illustration rare from Prismatic Evolutions, part of the set''s full run of Eeveelution special illustration rares.'),
('leafeon-ex-sir-prismatic-evolutions', 'Leafeon ex (Special Illustration Rare)', 'Prismatic Evolutions', '144/131', 'pokemon',
 'Pokemon Leafeon ex 144/131',
 'The Leafeon ex special illustration rare from Prismatic Evolutions, part of the set''s full run of Eeveelution special illustration rares.'),
('glaceon-ex-sir-prismatic-evolutions', 'Glaceon ex (Special Illustration Rare)', 'Prismatic Evolutions', '150/131', 'pokemon',
 'Pokemon Glaceon ex 150/131',
 'The Glaceon ex special illustration rare from Prismatic Evolutions, part of the set''s full run of Eeveelution special illustration rares.'),
('lillies-clefairy-ex-sir-journey-together', 'Lillie''s Clefairy ex (Special Illustration Rare)', 'Journey Together', '184/159', 'pokemon',
 'Pokemon Lillie''s Clefairy ex 184/159',
 'The chase card of Journey Together, the set that brought back trainer-owned Pokémon. It pairs Clefairy with the trainer Lillie.'),
('ns-zoroark-ex-sir-journey-together', 'N''s Zoroark ex (Special Illustration Rare)', 'Journey Together', '185/159', 'pokemon',
 'Pokemon N''s Zoroark ex 185/159',
 'A special illustration rare from Journey Together, featuring the trainer N and his partner Zoroark.'),
('team-rockets-mewtwo-ex-sir-destined-rivals', 'Team Rocket''s Mewtwo ex (Special Illustration Rare)', 'Destined Rivals', '231/182', 'pokemon',
 'Pokemon Team Rocket''s Mewtwo ex 231/182',
 'The top chase card of Destined Rivals, the set that brought Team Rocket''s Pokémon back to the TCG.'),
('mega-charizard-x-ex-sir-phantasmal-flames', 'Mega Charizard X ex (Special Illustration Rare)', 'Phantasmal Flames', '125/094', 'pokemon',
 'Pokemon Mega Charizard X ex 125/094',
 'The Mega Charizard X ex special illustration rare from Phantasmal Flames, the headline Charizard of the Mega Evolution era.'),
('mega-gardevoir-ex-sir-mega-evolution', 'Mega Gardevoir ex (Special Illustration Rare)', 'Mega Evolution', '178/132', 'pokemon',
 'Pokemon Mega Gardevoir ex 178/132',
 'A special illustration rare from the Mega Evolution base set, which brought Mega Evolution back to the Pokémon TCG.'),

-- ── One Piece: manga rares ───────────────────────────────────────────────────
-- `One Piece <name> <code> manga` — titles rarely carry "Card Game" or "rare".
-- English and Japanese printings share a code and are priced together.
('trafalgar-law-op10-119-manga', 'Trafalgar Law (Manga Rare)', 'Royal Blood (OP-10)', 'OP10-119', 'one-piece',
 'One Piece Trafalgar Law OP10-119 manga',
 'The manga rare of Royal Blood: Trafalgar Law in artwork drawn from the original manga panels.'),
('silvers-rayleigh-op08-118-manga', 'Silvers Rayleigh (Manga Rare)', 'Two Legends (OP-08)', 'OP08-118', 'one-piece',
 'One Piece Rayleigh OP08-118 manga',
 'The manga rare of Two Legends, featuring the Roger Pirates'' first mate Silvers Rayleigh in manga-panel artwork.'),
('roronoa-zoro-op06-118-manga', 'Roronoa Zoro (Manga Rare)', 'Wings of the Captain (OP-06)', 'OP06-118', 'one-piece',
 'One Piece Zoro OP06-118 manga',
 'The Zoro manga rare from Wings of the Captain. Most copies on the market are graded, so the graded price is the one to watch.'),
('luffy-op09-119-manga', 'Monkey D. Luffy (Manga Rare)', 'Emperors in the New World (OP-09)', 'OP09-119', 'one-piece',
 'One Piece Luffy OP09-119 manga',
 'The Luffy manga rare from Emperors in the New World, the set built around the Four Emperors.'),
('buggy-op09-051-manga', 'Buggy (Manga Rare)', 'Emperors in the New World (OP-09)', 'OP09-051', 'one-piece',
 'One Piece Buggy OP09-051 manga',
 'Buggy''s manga rare from Emperors in the New World, the set built around the Four Emperors.'),
('luffy-op11-118-manga', 'Monkey D. Luffy (Manga Rare)', 'A Fist of Divine Speed (OP-11)', 'OP11-118', 'one-piece',
 'One Piece Luffy OP11-118 manga',
 'The Luffy manga rare from A Fist of Divine Speed.'),
('portgas-d-ace-op13-119-manga', 'Portgas D. Ace (Manga Rare)', 'Carrying On His Will (OP-13)', 'OP13-119', 'one-piece',
 'One Piece Ace OP13-119 manga',
 'Ace''s manga rare from Carrying On His Will, one of the set''s run of manga rares for the three sworn brothers.'),
('sabo-op13-120-manga', 'Sabo (Manga Rare)', 'Carrying On His Will (OP-13)', 'OP13-120', 'one-piece',
 'One Piece Sabo OP13-120 manga',
 'Sabo''s manga rare from Carrying On His Will, alongside the set''s Luffy and Ace manga rares.'),
('jewelry-bonney-op12-118-manga', 'Jewelry Bonney (Manga Rare)', 'Legacy of the Master (OP-12)', 'OP12-118', 'one-piece',
 'One Piece Bonney OP12-118 manga',
 'The Jewelry Bonney manga rare from Legacy of the Master.'),

-- ── Basketball ───────────────────────────────────────────────────────────────
-- Base card number + exclusions keep parallels of the right card and drop
-- autographs, inserts and other products (Select, Optic, Mosaic…).
('kevin-durant-topps-chrome-rookie', 'Kevin Durant Topps Chrome Rookie', '2007-08 Topps Chrome', '#131', 'basketball',
 'Kevin Durant 2007-08 Topps Chrome rookie',
 'The Topps Chrome rookie card of a four-time NBA scoring champion and two-time Finals MVP, and one of the key modern-era rookie cards.'),
('tim-duncan-topps-chrome-rookie', 'Tim Duncan Topps Chrome Rookie', '1997-98 Topps Chrome', '#115', 'basketball',
 'Tim Duncan 1997-98 Topps Chrome rookie',
 'The Topps Chrome rookie card of the five-time champion Spurs great, one of the defining rookie cards of the late-1990s chrome era.'),
('trae-young-prizm-rookie', 'Trae Young Prizm Rookie', '2018-19 Panini Prizm', '#78', 'basketball',
 'Trae Young 2018-19 Prizm rookie 78 -auto',
 'The Prizm rookie card of the Hawks'' All-Star point guard, from the 2018 draft class alongside Luka Dončić.'),
('paolo-banchero-prizm-rookie', 'Paolo Banchero Prizm Rookie', '2022-23 Panini Prizm', '#249', 'basketball',
 'Paolo Banchero Prizm rookie 249 -select',
 'The Prizm rookie card of the 2022 first overall pick and Rookie of the Year for the Orlando Magic.'),
('ben-simmons-prizm-rookie', 'Ben Simmons Prizm Rookie', '2016-17 Panini Prizm', '#1', 'basketball',
 'Ben Simmons 2016-17 Prizm rookie -select -spectra -mosaic -excalibur -optic',
 'The Prizm rookie card of the Melbourne-born 2016 first overall pick and Rookie of the Year — card #1 in the set, and a staple for Australian basketball collectors.'),
('dyson-daniels-prizm-rookie', 'Dyson Daniels Prizm Rookie', '2022-23 Panini Prizm', '#233', 'basketball',
 'Dyson Daniels Prizm rookie 233 -select',
 'The Prizm rookie card of the Bendigo-born guard, a top-ten pick in the 2022 NBA Draft and one of the Australians collectors follow most closely.'),
('caitlin-clark-prizm-rookie', 'Caitlin Clark Prizm Rookie', '2024 Panini Prizm WNBA', '#22', 'basketball',
 'Caitlin Clark Prizm rookie',
 'The WNBA Prizm rookie card of the 2024 first overall pick, whose arrival brought record attention to women''s basketball cards.'),
('stephon-castle-prizm-rookie', 'Stephon Castle Prizm Rookie', '2024-25 Panini Prizm', '#234', 'basketball',
 'Stephon Castle Prizm rookie 234 -lot -hoops',
 'The Prizm rookie card of the San Antonio Spurs guard and 2024-25 Rookie of the Year.'),
('victor-wembanyama-donruss-rated-rookie', 'Victor Wembanyama Donruss Rated Rookie', '2023-24 Panini Donruss', '#220', 'basketball',
 'Wembanyama Donruss Rated Rookie -optic',
 'Wembanyama''s Donruss Rated Rookie — the classic Rated Rookie design and a more accessible companion to his Prizm rookie.'),

-- ── AFL ──────────────────────────────────────────────────────────────────────
-- Recent AFL rookies are in Select Optimum (2022) and Legacy (2023), not
-- Footy Stars. Draft-pick autographs are listed as "DPS"; `-auto -signature
-- -signed -dps` keeps them from posing as the rookie card's price.
('jason-horne-francis-rookie', 'Jason Horne-Francis Rookie Card', '2022 Select Optimum', NULL, 'afl',
 'Horne-Francis 2022 Optimum -auto -signature -signed -dps',
 'The rookie-year Optimum cards of the 2021 AFL Draft''s number one pick.'),
('will-ashcroft-rookie', 'Will Ashcroft Rookie Card', '2023 Select Legacy', NULL, 'afl',
 'Will Ashcroft 2023 Legacy -auto -signature -signed -dps',
 'The rookie-year Legacy cards of the Brisbane Lions midfielder, a father-son selection and son of Lions great Marcus Ashcroft.'),
('harry-sheezel-rookie', 'Harry Sheezel Rookie Card', '2023 Select Legacy', '#161', 'afl',
 'Harry Sheezel 2023 Legacy',
 'The rookie card of North Melbourne''s half-back, from 2023 Select Legacy — his debut season.'),

-- ── NRL ──────────────────────────────────────────────────────────────────────
('johnathan-thurston-rookie', 'Johnathan Thurston Rookie Card', '2003 Select', NULL, 'nrl',
 'Johnathan Thurston 2003 rookie',
 'The rookie-year card of the four-time Dally M Medallist and Cowboys premiership captain, one of the most decorated halves in rugby league history.')


on conflict (slug) do nothing;

-- ── 2. Repairs: pages whose search found nothing ─────────────────────────────

update public.tracked_cards set
  card_number = 'OP09-004',
  search_query = 'One Piece Shanks OP09-004 manga',
  updated_at = now()
where slug = 'shanks-op09-manga';

-- Sports rookies: the stored years/products were wrong for several players
-- (checked against listing titles), and "rookie card <year> NRL Traders"
-- matched nothing because titles rarely carry all of those words.
update public.tracked_cards set
  set_name = '2003 Select XL', card_number = '#123',
  search_query = 'Gary Ablett 2003 Select rookie', updated_at = now()
where slug = 'gary-ablett-jr-rookie';

update public.tracked_cards set
  set_name = '2017 NRL Elite', card_number = '#87',
  search_query = 'Kalyn Ponga 2017 rookie', updated_at = now()
where slug = 'kalyn-ponga-rookie';

update public.tracked_cards set
  set_name = '2016 NRL Elite',
  search_query = 'Latrell Mitchell 2016 Elite',
  blurb = 'The rookie card of one of the NRL''s biggest personalities and most damaging attacking players, from 2016 NRL Elite.',
  updated_at = now()
where slug = 'latrell-mitchell-rookie';

-- 2017 is his rookie year (Traders #104, Elite #103 — both priced here).
update public.tracked_cards set
  set_name = '2017 NRL Traders',
  search_query = 'Nathan Cleary 2017 rookie NRL', updated_at = now()
where slug = 'nathan-cleary-rookie';

-- 2022 is his rookie year (Elite #135 and Rivalry).
update public.tracked_cards set
  set_name = '2022 NRL Elite',
  search_query = 'Reece Walsh 2022 rookie',
  blurb = 'The most chased NRL rookie card of recent years. Walsh''s highlight-reel play for the Broncos has made his 2022 rookies the headline cards of the NRL hobby.',
  updated_at = now()
where slug = 'reece-walsh-rookie';

-- 2016 is his rookie year (Traders, Elite and Xtreme).
update public.tracked_cards set
  set_name = '2016 NRL Traders',
  search_query = 'Tom Trbojevic 2016 rookie', updated_at = now()
where slug = 'tom-trbojevic-rookie';

-- The base rookie is the 2006 Select Champions #80; 2005 only has draft-pick
-- autographs. "Buddy" in the query cut results to one.
update public.tracked_cards set
  set_name = '2006 Select Champions', card_number = '#80',
  search_query = 'Lance Franklin 2006 Select Champions -signed', updated_at = now()
where slug = 'lance-franklin-rookie';

-- Switched off: no search finds enough of the actual rookie card to price
-- it honestly. Payne Haas has almost no listings; Joseph Suaalii's are
-- almost all cheap inserts; Patrick Cripps' volume is his /400 draft-pick
-- autograph and Sam Darcy's is mostly autographs, both of which would
-- publish an autograph price as the "rookie card" price. An inactive card's
-- page 404s and drops out of the sitemap; the blog generator already skips
-- inactive cards. Flip `active` back once a reliable query exists.
update public.tracked_cards set active = false, updated_at = now()
where slug in ('payne-haas-rookie', 'joseph-suaalii-rookie', 'patrick-cripps-rookie', 'sam-darcy-rookie');

-- ── 2b. Repairs: existing searches that priced the wrong cards ───────────────
-- Audited 2026-11-05 against live eBay AU listings. These queries let other
-- printings into the average: Celebrations (2021) and "30th Celebration"
-- (2026) reprints inside the Base Set searches, 1st Editions at five and six
-- figures inside Neo Genesis, other cards of the same Pokémon inside long
-- rarity-word searches, and parallels/reprints sharing a One Piece code.

-- Two pages named the wrong card. 151 has no Mew ex special illustration
-- rare: 205/165 is the gold hyper rare (slug kept so the URL and history
-- stay). Leafeon VMAX's alternate art is 205/203; 204/203 is the rainbow.
update public.tracked_cards set
  name = 'Mew ex (Hyper Rare)',
  search_query = 'Pokemon Mew ex 205/165',
  blurb = 'The gold hyper rare Mew ex that closes out Scarlet & Violet 151 — Mew is the 151st Pokémon, the one the set is named for.',
  updated_at = now()
where slug = 'mew-ex-sir-151';

update public.tracked_cards set
  card_number = '205/203', search_query = 'Pokemon Leafeon VMAX 205/203', updated_at = now()
where slug = 'leafeon-vmax-alt-art-evolving-skies';

update public.tracked_cards set
  card_number = '17/17',
  search_query = 'Pokemon Umbreon Gold Star 17/17 -celebrations -celebration -classic -2021 -25th',
  blurb = 'Arguably the most coveted Umbreon card in existence, distributed only through 2007 POP Series 5 packs. The 2021 Celebrations reprint is priced separately and kept out of this page.',
  updated_at = now()
where slug = 'umbreon-gold-star-pop5';

update public.tracked_cards set
  card_number = '269/193', search_query = 'Pokemon Iono 269/193', updated_at = now()
where slug = 'iono-sar-paldea-evolved';

-- Base Set holos: keep out Celebrations / 30th Celebration reprints, 1st
-- Edition and Shadowless (each prices far above the unlimited card).
update public.tracked_cards set search_query = 'Pokemon Charizard 4/102 base set -celebrations -celebration -classic -1st -shadowless', updated_at = now()
where slug = 'charizard-base-set';
update public.tracked_cards set search_query = 'Pokemon Blastoise 2/102 base set -celebrations -celebration -classic -1st -shadowless', updated_at = now()
where slug = 'blastoise-base-set';
update public.tracked_cards set search_query = 'Pokemon Venusaur 15/102 base set -celebrations -celebration -classic -1st -shadowless', updated_at = now()
where slug = 'venusaur-base-set';
update public.tracked_cards set search_query = 'Pokemon Charizard 4/102 Celebrations -30th -2026 -metal -gold -upc -ultra', updated_at = now()
where slug = 'celebrations-charizard';
update public.tracked_cards set search_query = 'Pokemon Lugia 9/111 Neo Genesis -1st -first -german', updated_at = now()
where slug = 'lugia-neo-genesis';

-- Modern Pokémon: name + number only.
update public.tracked_cards set search_query = 'Pokemon Charizard ex 234/091', updated_at = now()
where slug = 'charizard-ex-shiny-paldean-fates';
update public.tracked_cards set search_query = 'Pokemon Charizard ex 223/197', updated_at = now()
where slug = 'charizard-ex-sir-obsidian-flames';
update public.tracked_cards set search_query = 'Pokemon Charizard V 154/172 -20pcs', updated_at = now()
where slug = 'charizard-v-alt-art-brilliant-stars';
update public.tracked_cards set search_query = 'Pokemon Rayquaza VMAX 218/203', updated_at = now()
where slug = 'rayquaza-vmax-alt-art-evolving-skies';
update public.tracked_cards set search_query = 'Pokemon Charizard GX SV49 -metal -fan -20pcs -gold', updated_at = now()
where slug = 'shiny-charizard-gx-hidden-fates';

-- Collector numbers several listing titles agree on (queries already clean).
update public.tracked_cards set card_number = '167/131', updated_at = now() where slug = 'eevee-ex-sir-prismatic-evolutions' and card_number is null;
update public.tracked_cards set card_number = '155/131', updated_at = now() where slug = 'espeon-ex-sir-prismatic-evolutions' and card_number is null;
update public.tracked_cards set card_number = '156/131', updated_at = now() where slug = 'sylveon-ex-sir-prismatic-evolutions' and card_number is null;
update public.tracked_cards set card_number = '214/167', updated_at = now() where slug = 'greninja-ex-sir-twilight-masquerade' and card_number is null;
update public.tracked_cards set card_number = '239/191', updated_at = now() where slug = 'latias-ex-sir-surging-sparks' and card_number is null;

-- One Piece: English/Japanese printings share a code, but parallels, manga,
-- SP and reprint products (PRB, Ultra Deck, Three Captains, Anniversary) can
-- be excluded by word.
update public.tracked_cards set
  name = 'Boa Hancock (Alternate Art)', set_name = '500 Years in the Future (OP-07)',
  card_number = 'OP07-051',
  search_query = 'One Piece Boa Hancock OP07-051 alt art -manga -binder -warlords -serial -SP',
  updated_at = now()
where slug = 'boa-hancock-op07';
update public.tracked_cards set search_query = 'One Piece Luffy OP05-119 -alt -alternate -parallel -manga -anniversary', updated_at = now()
where slug = 'luffy-gear-5-op05';
update public.tracked_cards set search_query = 'One Piece Nami OP01-016 alt art -manga -SP -EB05 -PRB01 -gift -special -ST10 -errata -anniversary -captains', updated_at = now()
where slug = 'nami-alt-art-op01';
update public.tracked_cards set search_query = 'One Piece Ace OP02-013 alt art -manga -SP -anniversary -4x', updated_at = now()
where slug = 'portgas-d-ace-alt-art-op02';
update public.tracked_cards set search_query = 'One Piece Zoro OP01-025 alt art -manga -SP -ultra -captains -errata', updated_at = now()
where slug = 'roronoa-zoro-alt-art-op01';
update public.tracked_cards set search_query = 'One Piece Shanks OP01-120 -parallel -alt -alternate -PRB01 -reprint -manga', updated_at = now()
where slug = 'shanks-op01-120';

-- The OP01 Luffy leader parallel can't be told apart from its reprints by
-- listing title (prices ran $22 to $1,200 for "the same card"), so there's
-- no honest price to publish. Switched off like the sports pages above.
update public.tracked_cards set active = false, updated_at = now()
where slug = 'monkey-d-luffy-leader-parallel-op01';

-- ── 3. Link new sports cards to their player pages ───────────────────────────
-- Same name match as 20261018020526_players.sql: a tracker card belongs to a
-- player when its name starts with the player's name or one of their aliases
-- (e.g. "Victor Wembanyama Donruss Rated Rookie" → victor-wembanyama).

update public.tracked_cards tc
set player_id = p.id
from public.players p
where tc.player_id is null
  and tc.category in ('basketball', 'afl', 'nrl')
  and lower(tc.name) like lower(p.name) || ' %';

update public.tracked_cards tc
set player_id = p.id
from public.players p
where tc.player_id is null
  and tc.category in ('basketball', 'afl', 'nrl')
  and exists (
    select 1 from unnest(p.aliases) a where lower(tc.name) like lower(a) || ' %'
  );
