-- Complete the TCG franchise hierarchy: manufacturers and sets.
--
-- Sellers found the listing form's Franchise → Manufacturer → Set pickers
-- missing most of what they were trying to list (a Panini Dragon Ball Z card
-- had nowhere to go: the franchise was named for one Bandai game and the only
-- manufacturer was Bandai). This migration:
--
--   1. Renames the "Dragon Ball Super" franchise to "Dragon Ball" (slug already
--      `dragon-ball`), keeping its id so attached manufacturers / sets /
--      parallels and every vault_items.franchise_id stay valid, and rewrites
--      the free-text `collection` the form wrote onto cards — the same shape
--      as 20261017044015_rename_hockey_franchise_to_nhl.sql. Card games based on
--      Dragon Ball were made by Score Entertainment (2000–06), Panini (2014–16)
--      and Bandai (2017–), so one franchise with three manufacturers is the
--      honest model. ("Bird Studio" printed on every card is the copyright
--      holder, not a manufacturer.)
--   2. Adds the missing manufacturers per franchise (ON CONFLICT (franchise_id,
--      name) DO NOTHING) and normalises a few odd names ("Bandai Battle
--      Spirits" → "Bandai").
--   3. Brings every TCG franchise's set list up to date (October 2026) from the
--      publishers' own set lists. Existing rows that are the same set under a
--      different name are UPDATED by id (name / series / release_date /
--      total_cards / manufacturer) so existing listings keep their set; new
--      sets are INSERTED with ON CONFLICT (slug) DO NOTHING and a same-name
--      guard, so the file is idempotent.
--
-- Generated once from the publishers' set lists (Bandai, Panini, Wizards of
-- the Coast via MTGJSON, Konami via Yugipedia, Ravensburger, FFG, LSS, …) as of
-- 2026-10-17; later additions go through Admin → Categories or a new migration
-- in the same shape. Rows are plain data, so the whole file runs inside the
-- transaction "supabase db push" already opens — no explicit begin/commit.

-- ── 1. Dragon Ball franchise rename ─────────────────────────────────────────
update public.categories c
   set name = 'Dragon Ball'
 where c.id = '2b774bf0-5f2a-4e29-82c5-c57d25298447'
   and c.name = 'Dragon Ball Super'
   and not exists (select 1 from public.categories x where x.name = 'Dragon Ball');
update public.vault_items       set collection = 'Dragon Ball' where collection = 'Dragon Ball Super';
update public.card_catalogue    set collection = 'Dragon Ball' where collection = 'Dragon Ball Super';
update public.card_scans        set collection = 'Dragon Ball' where collection = 'Dragon Ball Super';
update public.card_art_overrides set collection = 'Dragon Ball' where collection = 'Dragon Ball Super';

-- ── 2. Manufacturer name clean-ups ──────────────────────────────────────────
update public.manufacturers m set name = 'Bandai', slug = 'bandai'
 where m.name = 'Bandai Battle Spirits'
   and not exists (select 1 from public.manufacturers x where x.franchise_id = m.franchise_id and x.name = 'Bandai');
update public.manufacturers m set name = 'Bushiroad', slug = 'bushiroad'
 where m.name = 'Bushiroad Shadowverse'
   and not exists (select 1 from public.manufacturers x where x.franchise_id = m.franchise_id and x.name = 'Bushiroad');


-- ═══ Dragon Ball ═══════════════════════════════════════════════════
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('Panini', 'panini', '2b774bf0-5f2a-4e29-82c5-c57d25298447', 2, true)
on conflict (franchise_id, name) do nothing;
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('Score Entertainment', 'score-entertainment', '2b774bf0-5f2a-4e29-82c5-c57d25298447', 3, true)
on conflict (franchise_id, name) do nothing;
update public.sets set name = 'Galactic Battle (BT1)', series = 'DBS Card Game', release_date = coalesce('2017-07-28', release_date), total_cards = coalesce(114, total_cards), is_active = true where id = '5ba6baf5-d3a8-4e33-b5e7-7b496a90f365';
update public.sets set name = 'Union Force (BT2)', series = 'DBS Card Game', release_date = coalesce('2017-11-01', release_date), total_cards = coalesce(127, total_cards), is_active = true where id = 'a51ba398-fd80-4144-ac55-a2d94998c113';
update public.sets set name = 'Cross Worlds (BT3)', series = 'DBS Card Game', release_date = coalesce('2018-03-09', release_date), total_cards = coalesce(135, total_cards), is_active = true where id = 'e6bd26a3-2a04-4794-8152-93b016849e91';
update public.sets set name = 'Destroyer Kings (BT6)', series = 'DBS Card Game', release_date = coalesce('2019-03-01', release_date), total_cards = coalesce(138, total_cards), is_active = true where id = 'dac52c5e-675c-4a03-a5c4-309ddc89a2a3';
update public.sets set name = 'Universal Onslaught (BT9)', series = 'DBS Card Game', release_date = coalesce('2020-02-14', release_date), total_cards = coalesce(147, total_cards), is_active = true where id = 'cf608bc7-4e9c-4a03-afaf-acce4eca610f';
update public.sets set name = 'The Tournament of Power (TB1)', series = 'DBS Card Game', release_date = coalesce('2018-05-25', release_date), total_cards = coalesce(101, total_cards), is_active = true where id = 'a30fa2fe-d791-40aa-a2a2-794187b6a70d';
update public.sets set name = 'Realm of the Gods (BT16)', series = 'DBS Unison Warrior Series', release_date = coalesce('2022-03-11', release_date), is_active = true where id = 'fd2452f1-68b6-41b6-bb59-c90df130e698';
update public.sets set name = 'Power Absorbed (B20)', series = 'DBS Zenkai Series', release_date = coalesce('2023-03-17', release_date), is_active = true where id = '7a11f803-07ec-40a9-9ba6-c6b5741fee7b';
update public.sets set name = 'Critical Blow (B22)', series = 'DBS Zenkai Series', release_date = coalesce('2023-09-08', release_date), is_active = true where id = '119d0e8a-6326-42f3-a7a1-e265750cdbd1';
update public.sets set name = 'Perfect Combination (B23)', series = 'DBS Zenkai Series', release_date = coalesce('2023-12-01', release_date), is_active = true where id = 'bcda62a1-5a04-46b6-a47c-0a6e0eda27be';
update public.sets set name = 'Awakened Pulse (FB01)', series = 'DBS Fusion World', release_date = coalesce('2024-02-23', release_date), total_cards = coalesce(140, total_cards), is_active = true where id = 'bd14f9ee-92ba-437d-86b5-d4bf3f506f40';
update public.sets set name = 'Blazing Aura (FB02)', series = 'DBS Fusion World', release_date = coalesce('2024-05-10', release_date), total_cards = coalesce(144, total_cards), is_active = true where id = 'b34350c2-2259-456b-8360-d5e760592d43';
update public.sets set name = 'Raging Roar (FB03)', series = 'DBS Fusion World', release_date = coalesce('2024-08-16', release_date), total_cards = coalesce(143, total_cards), is_active = true where id = 'adde0696-aebe-452e-92f4-f91a89ba3566';
update public.sets set name = 'Ultra Limit (FB04)', series = 'DBS Fusion World', release_date = coalesce('2024-11-15', release_date), total_cards = coalesce(133, total_cards), is_active = true where id = '139b284b-38cb-407d-89e8-1bc3b43d282e';
update public.sets set name = 'New Adventure (FB05)', series = 'DBS Fusion World', release_date = coalesce('2025-02-14', release_date), total_cards = coalesce(133, total_cards), is_active = true where id = 'ecbbe3e7-f52a-467a-afa0-dacb5eaf32b2';
update public.sets set name = 'Rivals Clash (FB06)', series = 'DBS Fusion World', release_date = coalesce('2025-05-02', release_date), total_cards = coalesce(123, total_cards), is_active = true where id = '0eedfede-41c1-46dd-a311-4ecd5adb3aad';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '2b774bf0-5f2a-4e29-82c5-c57d25298447', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Colossal Warfare (BT4)', 'db-colossal-warfare-bt4', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-07-01', 128),
  ('Miraculous Revival (BT5)', 'db-miraculous-revival-bt5', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-11-01', 132),
  ('Assault of the Saiyans (BT7)', 'db-assault-of-the-saiyans-bt7', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-08-02', 149),
  ('Malicious Machinations (BT8)', 'db-malicious-machinations-bt8', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-11-22', 163),
  ('World Martial Arts Tournament (TB2)', 'db-world-martial-arts-tournament-tb2', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-09-21', 77),
  ('Clash of Fates (TB3)', 'db-clash-of-fates-tb3', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-01-18', 77),
  ('Expert Deck 01: Universe 6 Assailants (XD1)', 'db-expert-deck-01-universe-6-assailants-xd1', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-08-02', null),
  ('Expert Deck 02: Android Duality (XD2)', 'db-expert-deck-02-android-duality-xd2', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-11-22', null),
  ('Expert Deck 03: The Ultimate Life Form (XD3)', 'db-expert-deck-03-the-ultimate-life-form-xd3', 'DBS Card Game', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-02-14', null),
  ('Rise of the Unison Warrior (BT10)', 'db-rise-of-the-unison-warrior-bt10', 'DBS Unison Warrior Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-07-17', 164),
  ('Vermilion Bloodline (BT11)', 'db-vermilion-bloodline-bt11', 'DBS Unison Warrior Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-10-09', 164),
  ('Vicious Rejuvenation (BT12)', 'db-vicious-rejuvenation-bt12', 'DBS Unison Warrior Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-01-22', null),
  ('Supreme Rivalry (BT13)', 'db-supreme-rivalry-bt13', 'DBS Unison Warrior Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-05-07', null),
  ('Cross Spirits (BT14)', 'db-cross-spirits-bt14', 'DBS Unison Warrior Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-08-13', null),
  ('Saiyan Showdown (BT15)', 'db-saiyan-showdown-bt15', 'DBS Unison Warrior Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-11-01', null),
  ('Ultimate Squad (BT17)', 'db-ultimate-squad-bt17', 'DBS Unison Warrior Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-06-03', 164),
  ('Dawn of the Z-Legends (B18)', 'db-dawn-of-the-z-legends-b18', 'DBS Zenkai Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-09-16', 164),
  ('Fighter''s Ambition (B19)', 'db-fighter-s-ambition-b19', 'DBS Zenkai Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-11-18', null),
  ('Wild Resurgence (B21)', 'db-wild-resurgence-b21', 'DBS Zenkai Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2023-06-16', null),
  ('Beyond Generations (B24)', 'db-beyond-generations-b24', 'DBS Zenkai Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-03-22', null),
  ('Legend of the Dragon Balls (B25)', 'db-legend-of-the-dragon-balls-b25', 'DBS Zenkai Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-07-12', null),
  ('Ultimate Advent (B26)', 'db-ultimate-advent-b26', 'DBS Zenkai Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-10-11', null),
  ('History of Z (B27)', 'db-history-of-z-b27', 'DBS Zenkai Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-06-27', 188),
  ('Prismatic Clash (B28)', 'db-prismatic-clash-b28', 'DBS Ultra-Bout Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-09-05', 197),
  ('Fearsome Rivals (B29)', 'db-fearsome-rivals-b29', 'DBS Ultra-Bout Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-01-02', 178),
  ('Three Glorious Fighters (B30)', 'db-three-glorious-fighters-b30', 'DBS Ultra-Bout Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-03-27', 199),
  ('Impact Beyond Dimensions (B31)', 'db-impact-beyond-dimensions-b31', 'DBS Ultra-Bout Series', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-07-03', 178),
  ('Starter Deck: The Awakening (SD01)', 'db-starter-deck-the-awakening-sd01', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2017-07-28', null),
  ('Starter Deck: The Extreme Evolution (SD02)', 'db-starter-deck-the-extreme-evolution-sd02', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-03-09', null),
  ('Starter Deck: The Dark Invasion (SD03)', 'db-starter-deck-the-dark-invasion-sd03', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-06-01', null),
  ('Starter Deck: The Guardian of Namekians (SD04)', 'db-starter-deck-the-guardian-of-namekians-sd04', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-07-13', null),
  ('Starter Deck: The Crimson Saiyan (SD05)', 'db-starter-deck-the-crimson-saiyan-sd05', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-07-13', null),
  ('Starter Deck: Resurrected Fusion (SD06)', 'db-starter-deck-resurrected-fusion-sd06', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-11-02', null),
  ('Starter Deck: Shenron''s Advent (SD07)', 'db-starter-deck-shenron-s-advent-sd07', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-11-01', null),
  ('Starter Deck: Rising Broly (SD08)', 'db-starter-deck-rising-broly-sd08', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-03-15', null),
  ('Starter Deck: Saiyan Legacy (SD09)', 'db-starter-deck-saiyan-legacy-sd09', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-08-01', null),
  ('Starter Deck: Parasitic Overlord (SD10)', 'db-starter-deck-parasitic-overlord-sd10', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Starter Deck: Instinct Surpassed (SD11)', 'db-starter-deck-instinct-surpassed-sd11', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-02-01', null),
  ('Starter Deck: Spirit of Potara (SD12)', 'db-starter-deck-spirit-of-potara-sd12', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-06-05', null),
  ('Starter Deck: Clan Collusion (SD13)', 'db-starter-deck-clan-collusion-sd13', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-06-05', null),
  ('Starter Deck: Saiyan Wonder (SD14)', 'db-starter-deck-saiyan-wonder-sd14', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-06-05', null),
  ('Reboot Starter Deck: Pride of the Saiyans (SD15)', 'db-reboot-starter-deck-pride-of-the-saiyans-sd15', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-08-13', null),
  ('Reboot Starter Deck: Darkness Reborn (SD16)', 'db-reboot-starter-deck-darkness-reborn-sd16', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-08-13', null),
  ('Starter Deck: Red Rage (SD17)', 'db-starter-deck-red-rage-sd17', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-09-16', null),
  ('Starter Deck: Blue Future (SD18)', 'db-starter-deck-blue-future-sd18', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-09-16', null),
  ('Starter Deck: Green Fusion (SD19)', 'db-starter-deck-green-fusion-sd19', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-09-16', null),
  ('Starter Deck: Yellow Transformation (SD20)', 'db-starter-deck-yellow-transformation-sd20', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-09-16', null),
  ('Starter Deck: Ultimate Awakened Power (SD21)', 'db-starter-deck-ultimate-awakened-power-sd21', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2023-03-17', null),
  ('Starter Deck: Proud Warrior (SD22)', 'db-starter-deck-proud-warrior-sd22', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2023-03-17', null),
  ('Starter Deck: Final Radiance (SD23)', 'db-starter-deck-final-radiance-sd23', 'DBS Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2023-09-08', null),
  ('Draft Box 01', 'db-draft-box-01', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2017-12-08', null),
  ('Draft Box 02', 'db-draft-box-02', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-04-01', null),
  ('Draft Box 03 (Colossal Warfare packs)', 'db-draft-box-03-colossal-warfare-packs', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2018-10-12', null),
  ('Draft Box 04: Dragon Brawl (DB1)', 'db-draft-box-04-dragon-brawl-db1', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2019-09-20', 175),
  ('Draft Box 05: Divine Multiverse (DB2 / EB02)', 'db-draft-box-05-divine-multiverse-db2-eb02', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-03-27', 177),
  ('Draft Box 06: Giant Force (DB3 / EB03)', 'db-draft-box-06-giant-force-db3-eb03', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-11-13', 144),
  ('Battle Evolution Booster (EB01)', 'db-battle-evolution-booster-eb01', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-03-26', 68),
  ('Mythic Booster (MB01)', 'db-mythic-booster-mb01', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-12-03', 126),
  ('Gift Collection (GC01)', 'db-gift-collection-gc01', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-12-17', null),
  ('Special Anniversary Box 2020 (BE13)', 'db-special-anniversary-box-2020-be13', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-08-07', 36),
  ('Ultimate Deck (BE16)', 'db-ultimate-deck-be16', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-01-22', null),
  ('Special Anniversary Box 2021 (BE19)', 'db-special-anniversary-box-2021-be19', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-09-17', 35),
  ('Ultimate Deck 2022 (BE20)', 'db-ultimate-deck-2022-be20', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-05-06', 51),
  ('5th Anniversary Set (BE21)', 'db-5th-anniversary-set-be21', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-10-28', 43),
  ('Ultimate Deck 2023 (BE22)', 'db-ultimate-deck-2023-be22', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2023-05-19', null),
  ('Premium Anniversary Box 2023 (BE23)', 'db-premium-anniversary-box-2023-be23', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2023-10-06', null),
  ('Premium Anniversary Box 2024 (BE24)', 'db-premium-anniversary-box-2024-be24', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-09-20', null),
  ('Premium Anniversary Box 2025 (BE25)', 'db-premium-anniversary-box-2025-be25', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-07-18', null),
  ('Collector''s Selection Vol.1', 'db-collector-s-selection-vol-1', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-06-01', 18),
  ('Collector''s Selection Vol.2', 'db-collector-s-selection-vol-2', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-04-29', 18),
  ('Collector''s Selection Vol.3', 'db-collector-s-selection-vol-3', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2023-04-28', 18),
  ('Premium Pack Set 01', 'db-premium-pack-set-01', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-07-17', null),
  ('Premium Pack Set 02 (PP02, Vermilion Bloodline)', 'db-premium-pack-set-02-pp02-vermilion-bloodline', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2020-10-09', null),
  ('Premium Pack Set 03', 'db-premium-pack-set-03', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-01-22', null),
  ('Premium Pack Set 04 (PP04, Supreme Rivalry)', 'db-premium-pack-set-04-pp04-supreme-rivalry', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-05-21', null),
  ('Premium Pack Set 05 (PP05, Cross Spirits)', 'db-premium-pack-set-05-pp05-cross-spirits', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-08-13', null),
  ('Premium Pack Set 06 (PP06, Saiyan Showdown)', 'db-premium-pack-set-06-pp06-saiyan-showdown', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2021-11-19', null),
  ('Premium Pack Set 07 (PP07, Realm of the Gods)', 'db-premium-pack-set-07-pp07-realm-of-the-gods', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Premium Pack Set 08 (PP08, Ultimate Squad)', 'db-premium-pack-set-08-pp08-ultimate-squad', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-06-03', null),
  ('Premium Pack Set 09', 'db-premium-pack-set-09', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Premium Pack Set 10 (PP10, Fighter''s Ambition)', 'db-premium-pack-set-10-pp10-fighter-s-ambition', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2022-11-18', null),
  ('Premium Pack Set 11 (PP11, Power Absorbed)', 'db-premium-pack-set-11-pp11-power-absorbed', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Premium Pack Set 12 (PP12, Wild Resurgence)', 'db-premium-pack-set-12-pp12-wild-resurgence', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Premium Pack Set 13 (PP13, Critical Blow)', 'db-premium-pack-set-13-pp13-critical-blow', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Premium Pack Set 14 (PP14, Perfect Combination)', 'db-premium-pack-set-14-pp14-perfect-combination', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Promotion Cards (P)', 'db-promotion-cards-p', 'DBS Expansion & Special Sets', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Wish for Shenron (FB07)', 'db-wish-for-shenron-fb07', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-09-19', 125),
  ('Saiyan''s Pride (FB08)', 'db-saiyan-s-pride-fb08', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-12-12', 122),
  ('Dual Evolution (FB09)', 'db-dual-evolution-fb09', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-03-13', 123),
  ('Cross Force (FB10)', 'db-cross-force-fb10', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-06-12', 123),
  ('Brightness of Hope (FB11)', 'db-brightness-of-hope-fb11', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-10-16', 123),
  ('Reach the God (FB12)', 'db-reach-the-god-fb12', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-12-18', null),
  ('Manga Booster 01 (SB01)', 'db-manga-booster-01-sb01', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-06-27', 110),
  ('Manga Booster 02 (SB02)', 'db-manga-booster-02-sb02', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-11-14', null),
  ('Story Booster 01 (ST01)', 'db-story-booster-01-st01', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-08-21', 85),
  ('Premium Card Collection 01: Leaders', 'db-premium-card-collection-01-leaders', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-03-15', 6),
  ('Premium Card Collection 02', 'db-premium-card-collection-02', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-09-20', 6),
  ('1st Anniversary Set', 'db-1st-anniversary-set', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-07-11', 16),
  ('2nd Anniversary Set', 'db-2nd-anniversary-set', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-09-18', 10),
  ('Fusion World Promotion Cards (P)', 'db-fusion-world-promotion-cards-p', 'DBS Fusion World', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, null, null),
  ('Starter Deck: Son Goku (FS01)', 'db-starter-deck-son-goku-fs01', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-02-23', null),
  ('Starter Deck: Vegeta (FS02)', 'db-starter-deck-vegeta-fs02', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-02-23', null),
  ('Starter Deck: Broly (FS03)', 'db-starter-deck-broly-fs03', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-02-23', null),
  ('Starter Deck: Frieza (FS04)', 'db-starter-deck-frieza-fs04', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-02-23', null),
  ('Starter Deck: Bardock (FS05)', 'db-starter-deck-bardock-fs05', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-08-01', null),
  ('Starter Deck: Son Goku (Mini) (FS06)', 'db-starter-deck-son-goku-mini-fs06', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-11-08', null),
  ('Starter Deck: Vegeta (Mini) (FS07)', 'db-starter-deck-vegeta-mini-fs07', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2024-11-08', null),
  ('Starter Deck: Vegeta (Mini) Super Saiyan 3 (FS08)', 'db-starter-deck-vegeta-mini-super-saiyan-3-fs08', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-04-01', null),
  ('Starter Deck EX: Shallot (FS09)', 'db-starter-deck-ex-shallot-fs09', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-06-13', null),
  ('Starter Deck EX: Giblet (FS10)', 'db-starter-deck-ex-giblet-fs10', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2025-06-13', null),
  ('Starter Deck EX: The Phase of Evolution (FS11)', 'db-starter-deck-ex-the-phase-of-evolution-fs11', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-03-13', null),
  ('Starter Deck EX: The Beat of Ki (FS12)', 'db-starter-deck-ex-the-beat-of-ki-fs12', 'DBS Fusion World Starter Decks', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2026-03-13', null),
  ('Premiere Set (Set 1)', 'db-premiere-set-set-1', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), '2014-10-18', 344),
  ('Heroes & Villains', 'db-heroes-and-villains', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), '2015-03-04', 142),
  ('Movie Collection', 'db-movie-collection', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), '2015-06-26', 142),
  ('Evolution', 'db-evolution', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), '2015-10-01', 377),
  ('Perfection', 'db-perfection', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), '2016-02-26', 157),
  ('Vengeance', 'db-vengeance', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), '2016-07-01', 143),
  ('Awakening', 'db-awakening', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), '2016-10-28', 378),
  ('Panini Promo Cards', 'db-panini-promo-cards', 'Panini DBZ TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'panini' limit 1), null, 107),
  ('Saiyan Saga', 'db-saiyan-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2000-01-01', 250),
  ('Frieza Saga', 'db-frieza-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2001-01-01', null),
  ('Trunks Saga', 'db-trunks-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2001-01-01', null),
  ('Androids Saga', 'db-androids-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2001-01-01', null),
  ('Cell Saga', 'db-cell-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2002-01-01', 200),
  ('Cell Games Saga', 'db-cell-games-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2002-01-01', null),
  ('World Games Saga', 'db-world-games-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2002-01-01', null),
  ('Babidi Saga', 'db-babidi-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2003-01-01', null),
  ('Buu Saga', 'db-buu-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2003-01-01', null),
  ('Fusion Saga', 'db-fusion-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2003-01-01', null),
  ('Kid Buu Saga', 'db-kid-buu-saga', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2003-01-01', null),
  ('Capsule Corp Power Pack I (promo subset)', 'db-capsule-corp-power-pack-i-promo-subset', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), null, null),
  ('Capsule Corp Power Pack II (promo subset)', 'db-capsule-corp-power-pack-ii-promo-subset', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), null, null),
  ('Score DBZ Promo Cards', 'db-score-dbz-promo-cards', 'Score DBZ CCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), null, null),
  ('Arrival', 'db-arrival', 'Score DBZ TCG (2005)', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2005-07-15', 254),
  ('Showdown', 'db-showdown', 'Score DBZ TCG (2005)', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2005-01-01', null),
  ('Transformation', 'db-transformation', 'Score DBZ TCG (2005)', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2006-01-01', null),
  ('Baby Saga', 'db-baby-saga', 'Score DBGT TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2004-02-01', 301),
  ('Broly: The Second Coming (subset)', 'db-broly-the-second-coming-subset', 'Score DBGT TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2004-01-01', null),
  ('Super 17 Saga', 'db-super-17-saga', 'Score DBGT TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2004-01-01', 160),
  ('Shadow Dragon Saga', 'db-shadow-dragon-saga', 'Score DBGT TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2004-01-01', 292),
  ('Villain Invasion (subset)', 'db-villain-invasion-subset', 'Score DBGT TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), null, null),
  ('Lost Episodes Saga', 'db-lost-episodes-saga', 'Score DBGT TCG', (select id from public.manufacturers where franchise_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(name) = 'score entertainment' limit 1), '2005-01-01', null),
  ('Warriors Return', 'db-warriors-return', 'Bandai DBZ CCG (2008)', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2008-07-18', 113),
  ('The Awakening', 'db-the-awakening', 'Bandai DBZ CCG (2008)', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2008-10-17', 100),
  ('Destructive Fury', 'db-destructive-fury', 'Bandai DBZ CCG (2008)', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2009-01-01', 109),
  ('Fusion', 'db-fusion', 'Bandai DBZ CCG (2008)', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2009-01-01', 105),
  ('Clash of Sagas', 'db-clash-of-sagas', 'Bandai DBZ CCG (2008)', '0d6809b8-5395-446e-ac80-660cac0a3a0e'::uuid, '2009-01-01', 102)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '2b774bf0-5f2a-4e29-82c5-c57d25298447' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ One Piece Card Game ═══════════════════════════════════════════════════
update public.sets set name = 'Romance Dawn (OP-01)', series = 'Booster', release_date = coalesce('2022-12-02', release_date), total_cards = coalesce(121, total_cards), is_active = true where id = '407c1a75-1d7c-40c8-9133-a148420afa04';
update public.sets set name = 'Paramount War (OP-02)', series = 'Booster', release_date = coalesce('2023-03-10', release_date), total_cards = coalesce(121, total_cards), is_active = true where id = 'dea2a08a-bac6-411c-af00-fe58e26fbc18';
update public.sets set name = 'Pillars of Strength (OP-03)', series = 'Booster', release_date = coalesce('2023-06-30', release_date), is_active = true where id = '75cdeeb1-e408-41a6-8ecb-97de775bd220';
update public.sets set name = 'Kingdoms of Intrigue (OP-04)', series = 'Booster', release_date = coalesce('2023-09-22', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = '78b935f9-dc5c-449b-9fc6-34ce6b4ee7d7';
update public.sets set name = 'Awakening of the New Era (OP-05)', series = 'Booster', release_date = coalesce('2023-12-08', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = '4e5f2154-29db-41d1-97e7-a4feeb48af65';
update public.sets set name = 'Wings of the Captain (OP-06)', series = 'Booster', release_date = coalesce('2024-03-15', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = '95b99181-1460-4a25-8ed2-d5094b5488b6';
update public.sets set name = '500 Years in the Future (OP-07)', series = 'Booster', release_date = coalesce('2024-06-28', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = 'cafdfc7f-2619-4674-829a-983239ddaac8';
update public.sets set name = 'Two Legends (OP-08)', series = 'Booster', release_date = coalesce('2024-09-13', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = '747316a7-454e-455b-bc54-57e1d72ce5a9';
update public.sets set name = 'Emperors in the New World (OP-09)', series = 'Booster', release_date = coalesce('2024-12-13', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = '10ef5930-9ea8-4dd6-8e05-cc270d3729ad';
update public.sets set name = 'Royal Blood (OP-10)', series = 'Booster', release_date = coalesce('2025-03-21', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = 'fbe92ca4-0719-432e-8ac0-836226b9d9fc';
update public.sets set name = 'A Fist of Divine Speed (OP-11)', series = 'Booster', release_date = coalesce('2025-06-06', release_date), total_cards = coalesce(119, total_cards), is_active = true where id = '4fe61d7e-74c8-42e5-8de4-5b86eab32562';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '2a068a95-4810-407d-998c-5fe32096bfbe', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Legacy of the Master (OP-12)', 'op-legacy-of-the-master-op-12', 'Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-08-22', 119),
  ('Carrying On His Will (OP-13)', 'op-carrying-on-his-will-op-13', 'Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-11-07', 133),
  ('The Azure Sea''s Seven (OP-14 / OP14-EB04)', 'op-the-azure-sea-s-seven-op-14-op14-eb04', 'Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-01-16', 163),
  ('Adventure on Kami''s Island (OP-15 / OP15-EB04)', 'op-adventure-on-kami-s-island-op-15-op15-eb04', 'Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-04-03', 159),
  ('The Time of Battle (OP-16)', 'op-the-time-of-battle-op-16', 'Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-06-12', 126),
  ('The World''s Strongest Warriors (OP-17)', 'op-the-world-s-strongest-warriors-op-17', 'Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-08-28', 131),
  ('The Dominance of God (OP-18)', 'op-the-dominance-of-god-op-18', 'Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-11-20', 127),
  ('Memorial Collection (EB-01)', 'op-memorial-collection-eb-01', 'Extra Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-05-03', 61),
  ('Anime 25th Collection (EB-02)', 'op-anime-25th-collection-eb-02', 'Extra Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-05-09', 87),
  ('One Piece Heroines Edition (EB-03)', 'op-one-piece-heroines-edition-eb-03', 'Extra Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-02-20', 71),
  ('One Piece Heroines Edition Vol.2 (EB-05)', 'op-one-piece-heroines-edition-vol-2-eb-05', 'Extra Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-10-30', 75),
  ('One Piece Card The Best (PRB-01)', 'op-one-piece-card-the-best-prb-01', 'Premium Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-11-08', 104),
  ('One Piece Card The Best Vol.2 (PRB-02)', 'op-one-piece-card-the-best-vol-2-prb-02', 'Premium Booster', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-10-03', null),
  ('Straw Hat Crew (ST-01)', 'op-straw-hat-crew-st-01', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2022-12-02', null),
  ('Worst Generation (ST-02)', 'op-worst-generation-st-02', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2022-12-02', null),
  ('The Seven Warlords of the Sea (ST-03)', 'op-the-seven-warlords-of-the-sea-st-03', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2022-12-02', null),
  ('Animal Kingdom Pirates (ST-04)', 'op-animal-kingdom-pirates-st-04', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2022-12-02', null),
  ('Film Edition (ST-05)', 'op-film-edition-st-05', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2023-02-03', null),
  ('Absolute Justice (ST-06)', 'op-absolute-justice-st-06', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2023-03-10', null),
  ('Big Mom Pirates (ST-07)', 'op-big-mom-pirates-st-07', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2023-06-30', null),
  ('Side Monkey.D.Luffy (ST-08)', 'op-side-monkey-d-luffy-st-08', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2023-08-11', null),
  ('Side Yamato (ST-09)', 'op-side-yamato-st-09', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2023-08-11', null),
  ('Ultimate Deck - The Three Captains (ST-10)', 'op-ultimate-deck-the-three-captains-st-10', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2023-11-10', null),
  ('Side Uta (ST-11)', 'op-side-uta-st-11', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-02-02', null),
  ('Zoro & Sanji (ST-12)', 'op-zoro-and-sanji-st-12', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-03-15', null),
  ('Ultimate Deck - The Three Brothers (ST-13)', 'op-ultimate-deck-the-three-brothers-st-13', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-04-19', null),
  ('3D2Y (ST-14)', 'op-3d2y-st-14', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-08-16', null),
  ('Red Edward.Newgate (ST-15)', 'op-red-edward-newgate-st-15', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-10-25', null),
  ('Green Uta (ST-16)', 'op-green-uta-st-16', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-10-25', null),
  ('Blue Donquixote Doflamingo (ST-17)', 'op-blue-donquixote-doflamingo-st-17', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-10-25', null),
  ('Purple Monkey.D.Luffy (ST-18)', 'op-purple-monkey-d-luffy-st-18', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-10-25', null),
  ('Black Smoker (ST-19)', 'op-black-smoker-st-19', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-10-25', null),
  ('Yellow Charlotte Katakuri (ST-20)', 'op-yellow-charlotte-katakuri-st-20', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2024-10-25', null),
  ('Starter Deck EX - Gear 5 (ST-21)', 'op-starter-deck-ex-gear-5-st-21', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-03-14', null),
  ('Red Shanks (ST-23)', 'op-red-shanks-st-23', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-06-06', null),
  ('Green Jewelry Bonney (ST-24)', 'op-green-jewelry-bonney-st-24', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-06-06', null),
  ('Blue Buggy (ST-25)', 'op-blue-buggy-st-25', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-06-06', null),
  ('Purple Monkey.D.Luffy (ST-26)', 'op-purple-monkey-d-luffy-st-26', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-06-06', null),
  ('Black Marshall.D.Teach (ST-27)', 'op-black-marshall-d-teach-st-27', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-06-06', null),
  ('Yellow Yamato (ST-28)', 'op-yellow-yamato-st-28', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-06-06', null),
  ('Starter Deck EX - Ace & Newgate (ST-22)', 'op-starter-deck-ex-ace-and-newgate-st-22', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2025-09-05', null),
  ('Egghead (ST-29)', 'op-egghead-st-29', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-01-16', null),
  ('Starter Deck EX - Luffy & Ace (ST-30)', 'op-starter-deck-ex-luffy-and-ace-st-30', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-06-12', null),
  ('Red Monkey.D.Luffy (ST-31)', 'op-red-monkey-d-luffy-st-31', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-07-31', null),
  ('Green Roronoa Zoro (ST-32)', 'op-green-roronoa-zoro-st-32', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-07-31', null),
  ('Blue Kuzan (ST-33)', 'op-blue-kuzan-st-33', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-07-31', null),
  ('Purple Charlotte Katakuri (ST-34)', 'op-purple-charlotte-katakuri-st-34', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-07-31', null),
  ('Red/Black Sabo (ST-35)', 'op-red-black-sabo-st-35', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-07-31', null),
  ('Yellow Eustass "Captain" Kid (ST-36)', 'op-yellow-eustass-captain-kid-st-36', 'Starter Deck', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2026-07-31', null),
  ('Promotion Cards (P)', 'op-promotion-cards-p', 'Promo', 'ba2426e4-cdb4-44a7-bb2e-bcc7d7ae20df'::uuid, '2022-12-01', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '2a068a95-4810-407d-998c-5fe32096bfbe' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Digimon Card Game ═══════════════════════════════════════════════════
update public.sets set name = 'New Evolution (BT-01)', series = 'Booster', release_date = coalesce('2021-02-12', release_date), is_active = true where id = 'bf80c18a-81ac-4cd6-9ab4-26abb6e25e05';
update public.sets set name = 'Great Legend (BT-04)', series = 'Booster', release_date = coalesce('2021-06-11', release_date), is_active = true where id = '2f8e4f3b-1999-4a7c-82de-489c35d98ba5';
update public.sets set name = 'Battle of Omni (BT-05)', series = 'Booster', release_date = coalesce('2021-08-06', release_date), is_active = true where id = 'eb9b5cea-5038-45d4-976b-cd4ee9308983';
update public.sets set name = 'Double Diamond (BT-06)', series = 'Booster', release_date = coalesce('2021-10-15', release_date), is_active = true where id = '871b9345-f6c5-4d8b-a499-0cc202e19257';
update public.sets set name = 'Next Adventure (BT-07)', series = 'Booster', release_date = coalesce('2022-03-04', release_date), is_active = true where id = 'e5d74e7e-a2e6-4048-b7a6-2db8f22f0825';
update public.sets set name = 'X Record (BT-09)', series = 'Booster', release_date = coalesce('2022-07-29', release_date), is_active = true where id = 'c7d4ec93-1b11-4cc9-8495-c6c3ad24c0c6';
update public.sets set name = 'Across Time (BT-12)', series = 'Booster', release_date = coalesce('2023-04-28', release_date), is_active = true where id = '7157e246-95da-478c-9367-560ae9bb9950';
update public.sets set name = 'Blast Ace (BT-14)', series = 'Booster', release_date = coalesce('2023-11-17', release_date), is_active = true where id = '9419d86e-9f31-42cc-9955-57956007545c';
update public.sets set name = 'Beginning Observer (BT-16)', series = 'Booster', release_date = coalesce('2024-05-24', release_date), is_active = true where id = '7c2bbb51-a0a1-4b4b-bbc9-732a32755209';
update public.sets set name = 'World Convergence (BT-21)', series = 'Booster', release_date = coalesce('2025-04-25', release_date), is_active = true where id = '046413e5-6490-4312-b438-9060d2047fa0';
update public.sets set name = 'Infernal Ascension (EX-06)', series = 'Extra Booster', release_date = coalesce('2024-06-28', release_date), is_active = true where id = 'c729fea2-ac91-4a3d-8265-e692b5f0474e';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '6f59eb40-386a-4817-b6e1-9ffee6e8ca7a', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Ultimate Power (BT-02)', 'digimon-card-game-ultimate-power-bt-02', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-02-12', null),
  ('Union Impact (BT-03)', 'digimon-card-game-union-impact-bt-03', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-02-12', null),
  ('New Awakening (BT-08)', 'digimon-card-game-new-awakening-bt-08', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-05-13', null),
  ('Xros Encounter (BT-10)', 'digimon-card-game-xros-encounter-bt-10', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-10-14', null),
  ('Dimensional Phase (BT-11)', 'digimon-card-game-dimensional-phase-bt-11', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2023-02-17', null),
  ('Versus Royal Knights (BT-13)', 'digimon-card-game-versus-royal-knights-bt-13', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2023-07-21', null),
  ('Exceed Apocalypse (BT-15)', 'digimon-card-game-exceed-apocalypse-bt-15', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-02-16', null),
  ('Secret Crisis (BT-17)', 'digimon-card-game-secret-crisis-bt-17', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-08-09', null),
  ('Release Special Booster Ver.2.0 (BT-18)', 'digimon-card-game-release-special-booster-ver-2-0-bt-18', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-11-01', null),
  ('Xros Evolution (BT-19)', 'digimon-card-game-xros-evolution-bt-19', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, null, null),
  ('Over the X (BT-20)', 'digimon-card-game-over-the-x-bt-20', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-01-31', null),
  ('Cyber Eden (BT-22)', 'digimon-card-game-cyber-eden-bt-22', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-07-25', null),
  ('Hackers'' Slumber (BT-23)', 'digimon-card-game-hackers-slumber-bt-23', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-10-24', null),
  ('Time Stranger (BT-24)', 'digimon-card-game-time-stranger-bt-24', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-01-17', null),
  ('Dual Revolution (BT-25)', 'digimon-card-game-dual-revolution-bt-25', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-05-16', null),
  ('Timeless Bonds (BT-26)', 'digimon-card-game-timeless-bonds-bt-26', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-08-29', null),
  ('Ignition of X (BT-27)', 'digimon-card-game-ignition-of-x-bt-27', 'Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-12-05', null),
  ('Classic Collection (EX-01)', 'digimon-card-game-classic-collection-ex-01', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-01-21', null),
  ('Digital Hazard (EX-02)', 'digimon-card-game-digital-hazard-ex-02', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-06-24', null),
  ('Draconic Roar (EX-03)', 'digimon-card-game-draconic-roar-ex-03', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-11-11', null),
  ('Alternative Being (EX-04)', 'digimon-card-game-alternative-being-ex-04', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2023-06-23', null),
  ('Animal Colosseum (EX-05)', 'digimon-card-game-animal-colosseum-ex-05', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-01-19', null),
  ('Digimon Liberator (EX-07)', 'digimon-card-game-digimon-liberator-ex-07', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-12-13', null),
  ('Chain of Liberation (EX-08)', 'digimon-card-game-chain-of-liberation-ex-08', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-01-10', null),
  ('Versus Monsters (EX-09)', 'digimon-card-game-versus-monsters-ex-09', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-06-01', null),
  ('Sinister Order (EX-10)', 'digimon-card-game-sinister-order-ex-10', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-09-19', null),
  ('Dawn of Liberator (EX-11)', 'digimon-card-game-dawn-of-liberator-ex-11', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-02-14', null),
  ('Digital World Shambala (EX-12)', 'digimon-card-game-digital-world-shambala-ex-12', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-07-04', null),
  ('Chivalrous XIII (EX-13)', 'digimon-card-game-chivalrous-xiii-ex-13', 'Extra Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-10-03', null),
  ('Resurgence Booster (RB-01)', 'digimon-card-game-resurgence-booster-rb-01', 'Resurgence Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2023-09-29', null),
  ('Release Special Booster Ver.1.0 (BT01-03)', 'digimon-card-game-release-special-booster-ver-1-0-bt01-03', 'Special Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-02-12', null),
  ('Release Special Booster Ver.1.5 (BT01-03)', 'digimon-card-game-release-special-booster-ver-1-5-bt01-03', 'Special Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-03-12', null),
  ('Release Special Booster Ver.2.0 (BT18-19)', 'digimon-card-game-release-special-booster-ver-2-0-bt18-19', 'Special Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-11-01', null),
  ('Release Special Booster Ver.2.5 (BT19-20)', 'digimon-card-game-release-special-booster-ver-2-5-bt19-20', 'Special Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-02-28', null),
  ('Digimon Generation (AD-01)', 'digimon-card-game-digimon-generation-ad-01', 'Special Booster', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-03-28', null),
  ('Gaia Red (ST-1)', 'digimon-card-game-gaia-red-st-1', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-01-29', null),
  ('Cocytus Blue (ST-2)', 'digimon-card-game-cocytus-blue-st-2', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-01-29', null),
  ('Heaven''s Yellow (ST-3)', 'digimon-card-game-heaven-s-yellow-st-3', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-01-29', null),
  ('Giga Green (ST-4)', 'digimon-card-game-giga-green-st-4', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-06-01', null),
  ('Machine Black (ST-5)', 'digimon-card-game-machine-black-st-5', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-06-01', null),
  ('Venomous Violet (ST-6)', 'digimon-card-game-venomous-violet-st-6', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-06-01', null),
  ('Gallantmon (ST-7)', 'digimon-card-game-gallantmon-st-7', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-10-01', null),
  ('UlforceVeedramon (ST-8)', 'digimon-card-game-ulforceveedramon-st-8', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-10-01', null),
  ('Ultimate Ancient Dragon (ST-9)', 'digimon-card-game-ultimate-ancient-dragon-st-9', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-05-13', null),
  ('Parallel World Tactician (ST-10)', 'digimon-card-game-parallel-world-tactician-st-10', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-05-13', null),
  ('Special Entry Set (ST-11)', 'digimon-card-game-special-entry-set-st-11', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, null, null),
  ('Jesmon (ST-12)', 'digimon-card-game-jesmon-st-12', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-10-14', null),
  ('RagnaLoardmon (ST-13)', 'digimon-card-game-ragnaloardmon-st-13', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-10-14', null),
  ('Beelzemon Advanced Deck Set (ST-14)', 'digimon-card-game-beelzemon-advanced-deck-set-st-14', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2022-12-09', null),
  ('Dragon of Courage (ST-15)', 'digimon-card-game-dragon-of-courage-st-15', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2023-10-13', null),
  ('Wolf of Friendship (ST-16)', 'digimon-card-game-wolf-of-friendship-st-16', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2023-10-13', null),
  ('Advanced Deck Double Typhoon (ST-17)', 'digimon-card-game-advanced-deck-double-typhoon-st-17', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-03-08', null),
  ('Guardian Vortex (ST-18)', 'digimon-card-game-guardian-vortex-st-18', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-09-13', null),
  ('Fable Waltz (ST-19)', 'digimon-card-game-fable-waltz-st-19', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2024-09-13', null),
  ('Protector of Light (ST-20)', 'digimon-card-game-protector-of-light-st-20', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-04-18', null),
  ('Hero of Hope (ST-21)', 'digimon-card-game-hero-of-hope-st-21', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-04-18', null),
  ('Advanced Deck Set Amethyst Mandala (ST-22)', 'digimon-card-game-advanced-deck-set-amethyst-mandala-st-22', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2025-12-05', null),
  ('Digimon Beatbreak (ST-23)', 'digimon-card-game-digimon-beatbreak-st-23', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-05-16', null),
  ('Digimon Data Squad (ST-24)', 'digimon-card-game-digimon-data-squad-st-24', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-05-16', null),
  ('Digimon Alysion Rubeusdramon (ST-25)', 'digimon-card-game-digimon-alysion-rubeusdramon-st-25', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-12-04', null),
  ('Digimon Alysion Yukinamon (ST-26)', 'digimon-card-game-digimon-alysion-yukinamon-st-26', 'Starter Deck', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2026-12-04', null),
  ('Promotion Cards (P)', 'digimon-card-game-promotion-cards-p', 'Promo', '16141256-488e-447b-bb05-cdc04e068e93'::uuid, '2021-01-01', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '6f59eb40-386a-4817-b6e1-9ffee6e8ca7a' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Gundam Card Game ═══════════════════════════════════════════════════
update public.sets set name = 'Newtype Rising (GD01)', series = 'Booster', release_date = coalesce('2025-07-25', release_date), is_active = true where id = '20116e6a-9a0a-4e2d-98e1-d0bf8ecbf6d6';
update public.sets set name = 'Dual Impact (GD02)', series = 'Booster', release_date = coalesce('2025-10-24', release_date), is_active = true where id = 'b6a6cb54-df45-4e8b-a16c-0c5edfd11ff9';
update public.sets set name = 'Zeon''s Rush (ST03)', series = 'Starter Deck', release_date = coalesce('2025-07-11', release_date), is_active = true where id = '53d22495-1627-4756-8daa-23e18b76a5dc';
update public.sets set is_active = false where id = '07b94492-02ef-4ebe-b732-9768e2463469';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'e4334363-eb39-4faa-81ed-916664a304db', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Edition Beta (GD01-B)', 'gundam-edition-beta-gd01-b', 'Beta', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2024-12-07', null),
  ('Steel Requiem (GD03)', 'gundam-steel-requiem-gd03', 'Booster', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-01-30', null),
  ('Phantom Aria (GD04)', 'gundam-phantom-aria-gd04', 'Booster', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-04-24', null),
  ('Freedom Ascension (GD05)', 'gundam-freedom-ascension-gd05', 'Booster', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-07-24', null),
  ('Stardust Trails (GD06)', 'gundam-stardust-trails-gd06', 'Booster', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-10-30', null),
  ('Eternal Nexus (EB01)', 'gundam-eternal-nexus-eb01', 'Extra Booster', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-06-26', null),
  ('Heroic Beginnings (ST01)', 'gundam-heroic-beginnings-st01', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2025-07-11', null),
  ('Wings of Advance (ST02)', 'gundam-wings-of-advance-st02', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2025-07-11', null),
  ('SEED Strike (ST04)', 'gundam-seed-strike-st04', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2025-07-11', null),
  ('Iron Bloom (ST05)', 'gundam-iron-bloom-st05', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2025-09-26', null),
  ('Clan Unity (ST06)', 'gundam-clan-unity-st06', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2025-10-24', null),
  ('Celestial Drive (ST07)', 'gundam-celestial-drive-st07', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-01-16', null),
  ('Flash of Radiance (ST08)', 'gundam-flash-of-radiance-st08', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-01-16', null),
  ('Destiny Ignition (ST09)', 'gundam-destiny-ignition-st09', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-03-27', null),
  ('Generation Pulse (ST10)', 'gundam-generation-pulse-st10', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-06-26', null),
  ('Aquatic Assault (ST11)', 'gundam-aquatic-assault-st11', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-09-25', null),
  ('Raging Onslaught (ST12)', 'gundam-raging-onslaught-st12', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-09-25', null),
  ('Silent Barrage (ST13)', 'gundam-silent-barrage-st13', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-09-25', null),
  ('Heavy Dominion (ST14)', 'gundam-heavy-dominion-st14', 'Starter Deck', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2026-09-25', null),
  ('Promotion Cards (P)', 'gundam-promotion-cards-p', 'Promo', '06c3b9fb-0bcd-4dd8-8859-21b718fd07f5'::uuid, '2025-07-01', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'e4334363-eb39-4faa-81ed-916664a304db' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Union Arena ═══════════════════════════════════════════════════
update public.sets set name = 'Bleach: Thousand-Year Blood War (UE01BT)', series = 'Booster', release_date = coalesce('2024-10-04', release_date), is_active = true where id = '45bd5659-5cef-4c2c-86ab-64b82db07f7a';
update public.sets set name = 'Hunter x Hunter (UE02BT)', series = 'Booster', release_date = coalesce('2024-10-04', release_date), is_active = true where id = 'ecd08142-e4a2-4cfa-860b-9eebea3e4b66';
update public.sets set name = 'Jujutsu Kaisen (UE03BT)', series = 'Booster', release_date = coalesce('2024-11-22', release_date), is_active = true where id = '4569b91c-49f2-4005-9805-f6032e4610af';
update public.sets set name = 'Code Geass: Lelouch of the Rebellion (UE04BT)', series = 'Booster', release_date = coalesce('2024-12-13', release_date), is_active = true where id = '4c158cdd-a09f-4fa4-b41f-084c9404d467';
update public.sets set name = 'Demon Slayer: Kimetsu no Yaiba (UE05BT)', series = 'Booster', release_date = coalesce('2025-01-24', release_date), is_active = true where id = 'bbfc83c2-3e4f-4f44-91d1-1a932124f295';
update public.sets set name = 'One Punch Man (UE06BT)', series = 'Booster', release_date = coalesce('2025-03-07', release_date), is_active = true where id = '3122d7e9-3716-4abc-baad-721353b1a659';
update public.sets set name = 'Sword Art Online (UE07BT)', series = 'Booster', release_date = coalesce('2025-05-02', release_date), is_active = true where id = 'c0929b3d-871c-4f1c-9f33-4c4bd4f89c3c';
update public.sets set name = 'Kaiju No. 8 (UE12BT)', series = 'Booster', release_date = coalesce('2025-10-01', release_date), is_active = true where id = '38ed4a4a-91db-4cb9-be52-24591210f4f3';
update public.sets set name = 'Solo Leveling (UE17BT)', series = 'Booster', release_date = coalesce('2026-03-20', release_date), is_active = true where id = 'cfb7c65a-01ed-4142-a80c-5b2c0d7bb16b';
update public.sets set name = 'My Hero Academia (UE25BT)', series = 'Booster', release_date = coalesce('2026-12-11', release_date), is_active = true where id = 'fb81dee3-0204-40c8-a772-54a223c6fec9';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'd7127af4-c19f-4cd3-8fba-2aefa7cae26b', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Black Clover (UE08BT)', 'ua-black-clover-ue08bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-05-30', null),
  ('Bleach: Thousand-Year Blood War Vol.2 (UEX01BT)', 'ua-bleach-thousand-year-blood-war-vol-2-uex01bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-05-30', null),
  ('Jujutsu Kaisen Vol.2 (UEX02BT)', 'ua-jujutsu-kaisen-vol-2-uex02bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-06-20', null),
  ('Fullmetal Alchemist (UE09BT)', 'ua-fullmetal-alchemist-ue09bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-07-25', null),
  ('Code Geass: Lelouch of the Rebellion Vol.2 (UEX03BT)', 'ua-code-geass-lelouch-of-the-rebellion-vol-2-uex03bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-08-22', null),
  ('Attack on Titan (UE10BT)', 'ua-attack-on-titan-ue10bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-08-29', null),
  ('Rurouni Kenshin (UE11BT)', 'ua-rurouni-kenshin-ue11bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-09-26', null),
  ('Hunter x Hunter Vol.2 (UEX04BT)', 'ua-hunter-x-hunter-vol-2-uex04bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-09-26', null),
  ('Yu Yu Hakusho: Ghost Files (UE13BT)', 'ua-yu-yu-hakusho-ghost-files-ue13bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-10-31', null),
  ('Goddess OF Victory: Nikke (UE14BT)', 'ua-goddess-of-victory-nikke-ue14bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-11-28', null),
  ('Demon Slayer: Kimetsu no Yaiba Vol.2 (UEX05BT)', 'ua-demon-slayer-kimetsu-no-yaiba-vol-2-uex05bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2025-12-01', null),
  ('Evangelion: New Theatrical Edition (UE15BT)', 'ua-evangelion-new-theatrical-edition-ue15bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-01-30', null),
  ('Sword Art Online Vol.2 (UEX06BT)', 'ua-sword-art-online-vol-2-uex06bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-01-30', null),
  ('Kagurabachi (UE16BT)', 'ua-kagurabachi-ue16bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-02-27', null),
  ('Tokyo Ghoul (UE18BT)', 'ua-tokyo-ghoul-ue18bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-04-24', null),
  ('Sakamoto Days (UE19BT)', 'ua-sakamoto-days-ue19bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-05-29', null),
  ('That Time I Got Reincarnated as a Slime (UE20BT)', 'ua-that-time-i-got-reincarnated-as-a-slime-ue20bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-06-26', null),
  ('The 100 Girlfriends Who Really, Really, Really, Really, Really Love You (UE21BT)', 'ua-the-100-girlfriends-who-really-really-really-really-really-love-you-ue21bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-07-10', null),
  ('Chainsaw Man (UE22BT)', 'ua-chainsaw-man-ue22bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-07-31', null),
  ('Inuyasha (UE23BT)', 'ua-inuyasha-ue23bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-08-14', null),
  ('Re:Zero -Starting Life in Another World- (UE24BT)', 'ua-re-zero-starting-life-in-another-world-ue24bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-09-18', null),
  ('Attack on Titan Vol.2 (UEX07BT)', 'ua-attack-on-titan-vol-2-uex07bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-09-18', null),
  ('Goddess OF Victory: Nikke Precious Booster (UP01BT)', 'ua-goddess-of-victory-nikke-precious-booster-up01bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-10-23', null),
  ('Bleach: Thousand-Year Blood War Vol.3 (UEX08BT)', 'ua-bleach-thousand-year-blood-war-vol-3-uex08bt', 'Booster', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-11-13', null),
  ('Bleach: Thousand-Year Blood War Starter Deck (UE01ST)', 'ua-bleach-thousand-year-blood-war-starter-deck-ue01st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2024-09-27', 50),
  ('Hunter x Hunter Starter Deck (UE02ST)', 'ua-hunter-x-hunter-starter-deck-ue02st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2024-09-27', 50),
  ('Jujutsu Kaisen Starter Deck (UE03ST)', 'ua-jujutsu-kaisen-starter-deck-ue03st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2024-11-22', 50),
  ('Demon Slayer: Kimetsu no Yaiba Starter Deck (UE05ST)', 'ua-demon-slayer-kimetsu-no-yaiba-starter-deck-ue05st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, null, 50),
  ('One Punch Man Starter Deck (UE06ST)', 'ua-one-punch-man-starter-deck-ue06st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, null, 50),
  ('Sword Art Online Starter Deck (UE07ST)', 'ua-sword-art-online-starter-deck-ue07st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, null, 50),
  ('Black Clover Starter Deck (UE08ST)', 'ua-black-clover-starter-deck-ue08st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, null, 50),
  ('Evangelion: New Theatrical Edition Starter Deck (UE15ST)', 'ua-evangelion-new-theatrical-edition-starter-deck-ue15st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, null, 50),
  ('Re:Zero -Starting Life in Another World- Starter Deck (UE24ST)', 'ua-re-zero-starting-life-in-another-world-starter-deck-ue24st', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-09-18', 50),
  ('Bleach: Thousand-Year Blood War Advanced Deck (UE01DC)', 'ua-bleach-thousand-year-blood-war-advanced-deck-ue01dc', 'Starter Deck', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2026-11-06', null),
  ('Promotion Cards (PR)', 'ua-promotion-cards-pr', 'Promo', '616a8f13-13cd-4548-9707-3825390bc70b'::uuid, '2024-09-01', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'd7127af4-c19f-4cd3-8fba-2aefa7cae26b' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Battle Spirits Saga ═══════════════════════════════════════════════════
update public.sets set name = 'False Gods (BSS02)', series = 'Booster', release_date = coalesce('2023-07-28', release_date), is_active = true where id = '7059b1d9-b3dc-44b0-acd3-3ae0969a182c';
update public.sets set name = 'Aquatic Invaders (BSS03)', series = 'Booster', release_date = coalesce('2023-10-01', release_date), total_cards = coalesce(138, total_cards), is_active = true where id = 'f99b563c-103e-4975-bbbb-20d1175304fa';
update public.sets set is_active = false where id = '23a08697-f9e0-4313-9f69-927d87207a88';
update public.sets set is_active = false where id = '87265952-336a-43a2-8bb8-1cb26f319cfa';
update public.sets set is_active = false where id = '81fca53a-1fa7-44b4-ac6b-416bf3a6dd4c';
update public.sets set is_active = false where id = 'b354edeb-38d8-41e0-8d04-8f7bcbb6ac76';
update public.sets set is_active = false where id = '09938099-165e-4f35-9e56-2dc4e37674c9';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'e0a232de-6363-459c-bb61-9f3bbb8cec9c', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Dawn of History (BSS01)', 'bss-dawn-of-history-bss01', 'Booster', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-04-28', 136),
  ('Savior of Chaos (BSS04)', 'bss-savior-of-chaos-bss04', 'Booster', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2024-03-01', 139),
  ('Halo of Awakening - Evangelion Collaboration (CB01)', 'bss-halo-of-awakening-evangelion-collaboration-cb01', 'Collaboration Booster', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2024-06-14', null),
  ('Strangers in the Sky (BSS05)', 'bss-strangers-in-the-sky-bss05', 'Booster', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2024-08-02', null),
  ('Generational Link (BSS06)', 'bss-generational-link-bss06', 'Booster', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2024-12-06', 116),
  ('Dragon Onslaught (ST01)', 'bss-dragon-onslaught-st01', 'Starter Deck', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-04-28', 16),
  ('Call of the Curse (ST02)', 'bss-call-of-the-curse-st02', 'Starter Deck', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-04-28', 16),
  ('Aegis of the Machine (ST03)', 'bss-aegis-of-the-machine-st03', 'Starter Deck', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-04-28', 16),
  ('Forbidden Magic (ST04)', 'bss-forbidden-magic-st04', 'Starter Deck', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-04-28', 16),
  ('Verdant Wings (ST05)', 'bss-verdant-wings-st05', 'Starter Deck', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-07-28', 16),
  ('Bodies of Steel (ST06)', 'bss-bodies-of-steel-st06', 'Starter Deck', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-10-27', 16),
  ('Destined Assault - Evangelion Collaboration (ST07)', 'bss-destined-assault-evangelion-collaboration-st07', 'Starter Deck', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2024-06-07', 16),
  ('Promotion Cards (P)', 'bss-promotion-cards-p', 'Promo', 'a9f8eb13-2b93-41d1-9f62-32d89d40c3a3'::uuid, '2023-04-01', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'e0a232de-6363-459c-bb61-9f3bbb8cec9c' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Disney Lorcana ═══════════════════════════════════════════════════
update public.sets set name = 'The First Chapter', series = 'Main set', release_date = coalesce('2023-08-18', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = 'c91c116f-eaf0-4e65-a467-dc23cff01999';
update public.sets set name = 'Rise of the Floodborn', series = 'Main set', release_date = coalesce('2023-11-17', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = 'c6dfae23-212b-4b29-adda-ca545d6070f2';
update public.sets set name = 'Into the Inklands', series = 'Main set', release_date = coalesce('2024-02-23', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = 'fddb6b1b-a287-49fa-8af5-50bf88cd5bcd';
update public.sets set name = 'Ursula''s Return', series = 'Main set', release_date = coalesce('2024-05-17', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = 'e2b898cd-2d06-4406-961c-525eac95644c';
update public.sets set name = 'Shimmering Skies', series = 'Main set', release_date = coalesce('2024-08-09', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = 'b75fab6a-a877-4e6c-ac57-b323f5e34278';
update public.sets set name = 'Azurite Sea', series = 'Main set', release_date = coalesce('2024-11-15', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = 'a926a683-0a8d-4aa2-8a8a-2b1098bb10be';
update public.sets set name = 'Archazia''s Island', series = 'Main set', release_date = coalesce('2025-03-07', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = 'acfaac5e-b7ef-41fd-a0cb-14d44dbcc053';
update public.sets set name = 'Reign of Jafar', series = 'Main set', release_date = coalesce('2025-05-30', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = '52b5db96-cbb7-4b5d-a3e9-a61724b94e3c';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '3bb01774-c0b3-486b-8d27-967f202c7709', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Disney100', 'lorcana-disney100', 'Promo / special', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2023-11-17', 6),
  ('Illumineer''s Quest: Deep Trouble', 'lorcana-illumineer-s-quest-deep-trouble', 'Illumineer''s Quest (co-op box)', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2024-05-01', null),
  ('Challenge Set 1 (Lorcana Challenge promos)', 'lorcana-challenge-set-1-lorcana-challenge-promos', 'Promo / special', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2024-05-25', 15),
  ('Gateway (learn-to-play set)', 'lorcana-gateway-learn-to-play-set', 'Learn-to-play product', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2024-08-09', null),
  ('D23 Collection', 'lorcana-d23-collection', 'Promo / special', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2024-08-09', 16),
  ('Illumineer''s Quest: Palace Heist', 'lorcana-illumineer-s-quest-palace-heist', 'Illumineer''s Quest (co-op box)', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2025-05-30', null),
  ('Fabled', 'lorcana-fabled', 'Main set', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2025-08-29', 205),
  ('Whispers in the Well', 'lorcana-whispers-in-the-well', 'Main set', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2025-11-01', 204),
  ('Winterspell', 'lorcana-winterspell', 'Main set', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-02-01', 204),
  ('Wilds Unknown', 'lorcana-wilds-unknown', 'Main set', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-05-01', 204),
  ('Curator''s Collection: Heroines Edition', 'lorcana-curator-s-collection-heroines-edition', 'Promo / special', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-07-17', 6),
  ('Attack of the Vine!', 'lorcana-attack-of-the-vine', 'Main set', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-07-24', 207),
  ('Challenge Set 3 (Lorcana Challenge promos)', 'lorcana-challenge-set-3-lorcana-challenge-promos', 'Promo / special', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-09-06', 13),
  ('Illumineer''s Quest: The Great Hunny Rescue', 'lorcana-illumineer-s-quest-the-great-hunny-rescue', 'Illumineer''s Quest (co-op box)', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-10-02', null),
  ('Curator''s Collection: Beauty and the Beast Edition', 'lorcana-curator-s-collection-beauty-and-the-beast-edition', 'Promo / special', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-10-01', 6),
  ('Hyperia City', 'lorcana-hyperia-city', 'Main set', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, '2026-10-23', null),
  ('Promo Cards', 'lorcana-promo-cards', 'Promo / special', 'e57f193a-c52a-4ce1-8d37-a03c2a8ac8ce'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '3bb01774-c0b3-486b-8d27-967f202c7709' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Star Wars Unlimited ═══════════════════════════════════════════════════
update public.sets set name = 'Spark of Rebellion', series = 'Booster set', release_date = coalesce('2024-03-08', release_date), total_cards = coalesce(252, total_cards), is_active = true where id = 'ace64b15-e55a-4e9a-87a0-df803fdf3918';
update public.sets set name = 'Shadows of the Galaxy', series = 'Booster set', release_date = coalesce('2024-07-12', release_date), total_cards = coalesce(262, total_cards), is_active = true where id = '22ba6997-c56b-4202-a48d-1ba46a54b5d2';
update public.sets set name = 'Twilight of the Republic', series = 'Booster set', release_date = coalesce('2024-11-08', release_date), total_cards = coalesce(257, total_cards), is_active = true where id = 'da4c918a-4679-4119-a97b-14d675ddf6ce';
update public.sets set name = 'Jump to Lightspeed', series = 'Booster set', release_date = coalesce('2025-03-14', release_date), total_cards = coalesce(262, total_cards), is_active = true where id = 'f6ff6c56-8360-48f6-8698-4620d0d3a07d';
update public.sets set name = 'Legends of the Force', series = 'Booster set', release_date = coalesce('2025-07-11', release_date), total_cards = coalesce(264, total_cards), is_active = true where id = '4fe6e862-c1aa-4bae-a942-5358959105dd';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '59901767-7ef4-47c3-a6c8-85525921a71b', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Secrets of Power', 'swu-secrets-of-power', 'Booster set', 'a9e5f189-523b-4e82-a8bc-8e7c01dfac68'::uuid, '2025-11-07', 264),
  ('A Lawless Time', 'swu-a-lawless-time', 'Booster set', 'a9e5f189-523b-4e82-a8bc-8e7c01dfac68'::uuid, '2026-03-01', 264),
  ('Twin Suns Pre-constructed Decks (2026)', 'swu-twin-suns-pre-constructed-decks-2026', 'Preconstructed decks', 'a9e5f189-523b-4e82-a8bc-8e7c01dfac68'::uuid, '2026-05-08', 84),
  ('Ashes of the Empire', 'swu-ashes-of-the-empire', 'Booster set', 'a9e5f189-523b-4e82-a8bc-8e7c01dfac68'::uuid, '2026-07-17', 264),
  ('Homeworlds', 'swu-homeworlds', 'Booster set', 'a9e5f189-523b-4e82-a8bc-8e7c01dfac68'::uuid, '2026-10-09', 272),
  ('Icons (2027 Edition mini-set)', 'swu-icons-2027-edition-mini-set', 'Mini-set', 'a9e5f189-523b-4e82-a8bc-8e7c01dfac68'::uuid, '2026-11-20', 194)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '59901767-7ef4-47c3-a6c8-85525921a71b' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Riftbound ═══════════════════════════════════════════════════
update public.sets set is_active = false where id = '5b69f4ab-6cac-4f95-a624-971f2c77dc72';
update public.sets set is_active = false where id = 'cb083848-edbc-44b6-a827-25c0f11eb949';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'c1afa87b-9477-4090-b92a-8afaba9c0443', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Origins', 'riftbound-origins', 'Booster set', '80df51d7-4dde-46a5-ba97-b32d7226d6f5'::uuid, '2025-10-31', 298),
  ('Origins: Proving Grounds', 'riftbound-origins-proving-grounds', 'Starter box set', '80df51d7-4dde-46a5-ba97-b32d7226d6f5'::uuid, '2025-10-31', 24),
  ('Spiritforged', 'riftbound-spiritforged', 'Booster set', '80df51d7-4dde-46a5-ba97-b32d7226d6f5'::uuid, '2026-02-13', 221),
  ('Unleashed', 'riftbound-unleashed', 'Booster set', '80df51d7-4dde-46a5-ba97-b32d7226d6f5'::uuid, '2026-05-08', 219),
  ('Vendetta', 'riftbound-vendetta', 'Booster set', '80df51d7-4dde-46a5-ba97-b32d7226d6f5'::uuid, '2026-07-31', 166),
  ('Radiance', 'riftbound-radiance', 'Booster set', '80df51d7-4dde-46a5-ba97-b32d7226d6f5'::uuid, '2026-10-23', null),
  ('Promotional Cards', 'riftbound-promotional-cards', 'Promo', '80df51d7-4dde-46a5-ba97-b32d7226d6f5'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'c1afa87b-9477-4090-b92a-8afaba9c0443' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Flesh and Blood ═══════════════════════════════════════════════════
update public.sets set name = 'Welcome to Rathe', series = 'Booster set', release_date = coalesce('2019-10-11', release_date), total_cards = coalesce(226, total_cards), is_active = true where id = '2a1c438f-4c1c-424b-ad59-085df681c280';
update public.sets set name = 'Arcane Rising', series = 'Booster set', release_date = coalesce('2020-03-27', release_date), total_cards = coalesce(219, total_cards), is_active = true where id = 'd5bd4a9d-83db-401d-8eb8-8e8ce2985801';
update public.sets set name = 'Crucible of War', series = 'Booster set', release_date = coalesce('2020-08-28', release_date), total_cards = coalesce(198, total_cards), is_active = true where id = 'ee0477e7-ac9f-418e-928d-f35fff928464';
update public.sets set name = 'Monarch', series = 'Booster set', release_date = coalesce('2021-05-07', release_date), total_cards = coalesce(307, total_cards), is_active = true where id = '2aea3c6c-1228-4e8f-b2ca-7208d8afd4d4';
update public.sets set name = 'Tales of Aria', series = 'Booster set', release_date = coalesce('2021-09-24', release_date), total_cards = coalesce(238, total_cards), is_active = true where id = 'ad682c3a-f22b-4f47-ba4e-7fc78b7c1528';
update public.sets set name = 'Everfest', series = 'Booster set', release_date = coalesce('2022-02-04', release_date), is_active = true where id = '01abc1aa-1dfd-4330-9a24-baa36089a1ad';
update public.sets set name = 'Uprising', series = 'Booster set', release_date = coalesce('2022-06-24', release_date), is_active = true where id = 'df61a67e-cc96-400e-9741-271dcfb9282f';
update public.sets set name = 'Dynasty', series = 'Booster set', release_date = coalesce('2022-11-11', release_date), is_active = true where id = '8994cf4d-8c49-4296-8498-ef3cc9f825dd';
update public.sets set name = 'Outsiders', series = 'Booster set', release_date = coalesce('2023-03-24', release_date), is_active = true where id = 'ba3de20c-2b4f-4e2c-9eaa-f40f7ba0e809';
update public.sets set name = 'Dusk till Dawn', series = 'Booster set', release_date = coalesce('2023-07-14', release_date), is_active = true where id = '7eff158d-e2d1-4d20-9c61-b813ea5a206a';
update public.sets set name = 'Bright Lights', series = 'Booster set', release_date = coalesce('2023-10-06', release_date), is_active = true where id = '9da2a26a-d01f-4488-8856-5f0a4a09c143';
update public.sets set name = 'Heavy Hitters', series = 'Booster set', release_date = coalesce('2024-02-02', release_date), is_active = true where id = 'ee82fd8e-785d-4f5b-b019-9f4a7c8e76eb';
update public.sets set name = 'Part the Mistveil', series = 'Booster set', release_date = coalesce('2024-05-31', release_date), is_active = true where id = 'a2bbcfbc-46fc-4b49-b1e1-4a96a8f2f0ae';
update public.sets set name = 'Rosetta', series = 'Booster set', release_date = coalesce('2024-09-20', release_date), is_active = true where id = '3a221db0-5238-4939-b350-a9f2aab6bab4';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'cb611fc6-840d-4e8f-b218-428b25cb6b12', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Welcome Deck: Ira', 'fab-welcome-deck-ira', 'Welcome / demo decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2019-08-01', null),
  ('Hero Decks', 'fab-hero-decks', 'Hero decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, null, null),
  ('Blitz Decks', 'fab-blitz-decks', 'Blitz decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, null, null),
  ('Classic Battles: Rhinar vs Dorinthea', 'fab-classic-battles-rhinar-vs-dorinthea', 'Box set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2022-05-01', null),
  ('History Pack 1', 'fab-history-pack-1', 'Reprint booster set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2022-05-01', null),
  ('History Pack 1 Blitz Decks', 'fab-history-pack-1-blitz-decks', 'Blitz decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2023-04-07', null),
  ('Round the Table: TCC x LSS', 'fab-round-the-table-tcc-x-lss', 'Box set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2023-09-01', null),
  ('Armory Decks', 'fab-armory-decks', 'Armory decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2024-05-03', null),
  ('1st Strike: Terra / 1st Strike: Aurora', 'fab-1st-strike-terra-1st-strike-aurora', 'Starter decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2024-08-01', null),
  ('The Hunted', 'fab-the-hunted', 'Booster set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2025-01-31', null),
  ('High Seas', 'fab-high-seas', 'Booster set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2025-06-06', null),
  ('Mastery Pack: Guardian', 'fab-mastery-pack-guardian', 'Mastery packs', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2025-08-08', 130),
  ('Super Slam', 'fab-super-slam', 'Booster set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2025-09-26', null),
  ('Compendium of Rathe', 'fab-compendium-of-rathe', 'Booster set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2026-02-13', 348),
  ('Compendium of Rathe: Antiquity Pack', 'fab-compendium-of-rathe-antiquity-pack', 'Supplementary pack', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2026-02-13', 38),
  ('Omens of the Third Age', 'fab-omens-of-the-third-age', 'Booster set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2026-06-05', 251),
  ('Mastery Pack: Warrior', 'fab-mastery-pack-warrior', 'Mastery packs', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2026-08-07', 156),
  ('Dorinthea Demo Deck', 'fab-dorinthea-demo-deck', 'Welcome / demo decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2026-08-01', null),
  ('Prism Silver Age Deck', 'fab-prism-silver-age-deck', 'Silver Age decks', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2026-09-01', null),
  ('Usurp the Shadow Throne', 'fab-usurp-the-shadow-throne', 'Booster set', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, '2026-09-25', 263),
  ('Promos and Extras', 'fab-promos-and-extras', 'Promo', '12bad219-a437-4146-a2a8-5ab22e210436'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'cb611fc6-840d-4e8f-b218-428b25cb6b12' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Grand Archive ═══════════════════════════════════════════════════
update public.sets set name = 'Dawn of Ashes', series = 'Standard set', release_date = coalesce('2023-04-28', release_date), is_active = true where id = '78abe4a6-b7e9-4d1e-ad1e-5cc0804c7f75';
update public.sets set name = 'Fractured Crown', series = 'Expansion set', release_date = coalesce('2023-08-25', release_date), total_cards = coalesce(90, total_cards), is_active = true where id = 'a54c8efe-249a-4bcc-8de6-d11b6920e056';
update public.sets set name = 'Mercurial Heart', series = 'Expansion set', release_date = coalesce('2024-05-17', release_date), is_active = true where id = '06a8bcef-4be1-4038-bc90-3f751a57c14d';
update public.sets set name = 'Mortal Ambition', series = 'Standard set', release_date = coalesce('2024-10-11', release_date), is_active = true where id = '3d073523-356f-45ef-a5e8-af64d00d9423';
update public.sets set name = 'Abyssal Heaven', series = 'Expansion set', release_date = coalesce('2025-03-07', release_date), is_active = true where id = 'e2d02c44-c314-4cb6-9dcd-3c1ea1574647';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'f6b02542-dac1-4e81-8f8d-baf8277917b5', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Dawn of Ashes: Alter Edition', 'ga-dawn-of-ashes-alter-edition', 'Alter Edition', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2023-04-27', null),
  ('Alchemical Revolution', 'ga-alchemical-revolution', 'Standard set', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2024-01-26', null),
  ('Alchemical Revolution: Alter Edition', 'ga-alchemical-revolution-alter-edition', 'Alter Edition', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2025-01-10', null),
  ('Mercurial Heart: Alter Edition', 'ga-mercurial-heart-alter-edition', 'Alter Edition', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2025-05-29', null),
  ('Distorted Reflections', 'ga-distorted-reflections', 'Standard set', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2025-07-25', null),
  ('Phantom Monarchs', 'ga-phantom-monarchs', 'Expansion set', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2025-12-05', null),
  ('Mortal Ambition: Alter Edition', 'ga-mortal-ambition-alter-edition', 'Alter Edition', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2026-01-30', null),
  ('Radiant Origins', 'ga-radiant-origins', 'Capstone set', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2026-04-03', null),
  ('Radiant Origins: Pantheon', 'ga-radiant-origins-pantheon', 'Pantheon (companion product)', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2026-04-03', null),
  ('.asphodel/paradise', 'ga-asphodel-paradise', 'Standard set', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2026-08-21', null),
  ('.asphodel/paradise: Pantheon', 'ga-asphodel-paradise-pantheon', 'Pantheon (companion product)', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2026-08-21', null),
  ('Distorted Reflections: Alter Edition', 'ga-distorted-reflections-alter-edition', 'Alter Edition', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2026-10-15', null),
  ('.asphodel/cantabile', 'ga-asphodel-cantabile', 'Expansion set', '752f702a-a6e5-4aa7-b3f6-0f17dda47986'::uuid, '2026-12-11', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'f6b02542-dac1-4e81-8f8d-baf8277917b5' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Sorcery: Contested Realm ═══════════════════════════════════════════════════
update public.sets set name = 'Alpha', series = 'Core set', release_date = coalesce('2023-05-01', release_date), total_cards = coalesce(403, total_cards), is_active = true where id = '77905552-d7e7-4ecf-b7b0-2b073dbb4403';
update public.sets set name = 'Beta', series = 'Core set (retail printing)', release_date = coalesce('2023-11-10', release_date), total_cards = coalesce(402, total_cards), is_active = true where id = '3ceed079-aa72-4edd-ba51-9e60b555d246';
update public.sets set name = 'Arthurian Legends', series = 'Expansion', release_date = coalesce('2024-10-04', release_date), total_cards = coalesce(220, total_cards), is_active = true where id = 'e4495d47-44e2-480b-9293-421da07f8b5b';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'ae5864af-ab77-44a5-9b73-4cf10852ff56', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Dragonlord', 'sorcery-dragonlord', 'Mini set', '9219a71a-e422-40b8-9b0c-850a2fb6727e'::uuid, '2025-08-01', 13),
  ('Gothic', 'sorcery-gothic', 'Expansion', '9219a71a-e422-40b8-9b0c-850a2fb6727e'::uuid, '2025-12-05', 440),
  ('Frost Mage vs Lavamancer (preconstructed decks)', 'sorcery-frost-mage-vs-lavamancer-preconstructed-decks', 'Preconstructed decks', '9219a71a-e422-40b8-9b0c-850a2fb6727e'::uuid, '2026-11-14', 69)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'ae5864af-ab77-44a5-9b73-4cf10852ff56' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Altered TCG ═══════════════════════════════════════════════════
update public.sets set name = 'Beyond the Gates (Kickstarter Edition)', series = 'Booster set', is_active = true where id = 'fadcf243-cbbe-4ace-b2d9-aa37c07a224f';
update public.sets set is_active = false where id = 'b043d1e0-58d9-4ca4-8ee3-dc735822fa35';
update public.sets set is_active = false where id = '5f989ad8-62f9-4247-ba1b-1c9143298074';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '3d1f203f-53f6-4f64-bfdc-b7ed73e8ade6', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Beyond the Gates', 'altered-beyond-the-gates', 'Booster set', '687a2186-4580-446f-9767-4ebe56ebe065'::uuid, '2024-09-13', null),
  ('Trial by Frost', 'altered-trial-by-frost', 'Booster set', '687a2186-4580-446f-9767-4ebe56ebe065'::uuid, '2025-01-31', 282),
  ('Whispers from the Maze', 'altered-whispers-from-the-maze', 'Booster set', '687a2186-4580-446f-9767-4ebe56ebe065'::uuid, '2025-06-06', 282),
  ('Skybound Odyssey', 'altered-skybound-odyssey', 'Booster set', '687a2186-4580-446f-9767-4ebe56ebe065'::uuid, '2025-10-03', 282),
  ('Seeds of Unity', 'altered-seeds-of-unity', 'Booster set', '687a2186-4580-446f-9767-4ebe56ebe065'::uuid, '2026-02-27', null),
  ('Roots of Corruption', 'altered-roots-of-corruption', 'Booster set', '687a2186-4580-446f-9767-4ebe56ebe065'::uuid, null, null),
  ('Neverending Journey', 'altered-neverending-journey', 'Booster set', '687a2186-4580-446f-9767-4ebe56ebe065'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '3d1f203f-53f6-4f64-bfdc-b7ed73e8ade6' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Elestrals ═══════════════════════════════════════════════════
update public.sets set name = 'Base Set (First Edition)', series = 'Base Set', release_date = coalesce('2024-06-01', release_date), is_active = true where id = 'adc4ca05-e0ee-4090-b990-079f7f8a31b5';
update public.sets set is_active = false where id = 'c1eb7cda-0203-437c-8e54-7a838590583d';
update public.sets set is_active = false where id = 'd0609cca-dfa0-441a-9a9f-61ba50768ee6';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '04c8abfd-780f-4892-b1d7-11fe5d37d1e4', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Base Set (Kickstarter Edition)', 'elestrals-base-set-kickstarter-edition', 'Base Set', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, '2023-06-20', 126),
  ('Frostfall', 'elestrals-frostfall', 'Expansion', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, '2024-06-01', null),
  ('Daybreak', 'elestrals-daybreak', 'Expansion', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, '2024-08-01', null),
  ('Moonrise', 'elestrals-moonrise', 'Expansion', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, '2025-01-17', null),
  ('Divine Champions: Firestorm', 'elestrals-divine-champions-firestorm', 'Divine Champions', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, null, null),
  ('Divine Champions: Lifestream', 'elestrals-divine-champions-lifestream', 'Divine Champions', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, '2025-10-03', null),
  ('Divine Champions: Sunstrike', 'elestrals-divine-champions-sunstrike', 'Divine Champions', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, '2026-05-22', null),
  ('Divine Champions: Snowshade', 'elestrals-divine-champions-snowshade', 'Divine Champions', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, '2026-10-16', null),
  ('Shattered Stars: Chapter 1', 'elestrals-shattered-stars-chapter-1', 'Shattered Stars', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, null, null),
  ('Shattered Stars: Chapter 2', 'elestrals-shattered-stars-chapter-2', 'Shattered Stars', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, null, null),
  ('Shattered Stars: Chapter 3', 'elestrals-shattered-stars-chapter-3', 'Shattered Stars', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, null, null),
  ('Organized Play Series promos', 'elestrals-organized-play-series-promos', 'Promo', '8fa0b5c9-2732-4617-a0d5-cfdb0e37b203'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '04c8abfd-780f-4892-b1d7-11fe5d37d1e4' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ KeyForge ═══════════════════════════════════════════════════
update public.sets set name = 'Call of the Archons', series = 'Standard set', release_date = coalesce('2018-11-15', release_date), total_cards = coalesce(370, total_cards), is_active = true where id = '764fb9dc-e959-4d7f-8377-ecd7967d7167';
update public.sets set name = 'Age of Ascension', series = 'Standard set', release_date = coalesce('2019-05-30', release_date), total_cards = coalesce(204, total_cards), is_active = true where id = '3a034860-c924-4f82-b4bc-9366696beb62';
update public.sets set name = 'Worlds Collide', series = 'Standard set', release_date = coalesce('2019-11-08', release_date), total_cards = coalesce(297, total_cards), is_active = true where id = '6482cead-2324-46a0-9e77-066de93071ed';
update public.sets set name = 'Mass Mutation', series = 'Standard set', release_date = coalesce('2020-07-10', release_date), total_cards = coalesce(422, total_cards), is_active = true where id = '9bb85977-1ff2-493e-ac27-dc5197a31a4a';
update public.sets set name = 'Dark Tidings', series = 'Standard set', release_date = coalesce('2021-05-14', release_date), is_active = true where id = '04878f15-8f22-4b2d-8d63-d6a4c98ea057';
update public.sets set name = 'Winds of Exchange', series = 'Standard set', release_date = coalesce('2023-09-15', release_date), total_cards = coalesce(262, total_cards), is_active = true where id = '610036aa-4a45-4c57-8553-992e06a87287';
update public.sets set name = 'Grim Reminders', series = 'Standard set', release_date = coalesce('2024-03-01', release_date), is_active = true where id = '876f5f80-eee5-460f-a63d-356c843f6240';
update public.sets set name = 'Æmber Skies', series = 'Standard set', release_date = coalesce('2024-10-18', release_date), is_active = true where id = 'a2fa7ee2-53de-4e7a-8058-3188f51aef7c';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'ed644632-fa1e-4be6-b95a-bc9e98c4ebc9', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Unchained', 'keyforge-unchained', 'Special set', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, null, null),
  ('Martian Civil War', 'keyforge-martian-civil-war', 'Special set', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, null, null),
  ('Vault Masters 2023', 'keyforge-vault-masters-2023', 'Special set (Vault Tour)', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2023-07-07', null),
  ('Vault Masters 2024', 'keyforge-vault-masters-2024', 'Special set (Vault Tour)', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2024-04-05', null),
  ('Menagerie', 'keyforge-menagerie', 'Special set', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2024-05-10', null),
  ('More Mutation', 'keyforge-more-mutation', 'Special set', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, null, null),
  ('Tokens of Change', 'keyforge-tokens-of-change', 'Special set', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2024-12-06', null),
  ('Discovery', 'keyforge-discovery', 'Special set (new-player starters)', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2025-01-31', null),
  ('Vault Masters 2025', 'keyforge-vault-masters-2025', 'Special set (Vault Tour)', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2025-04-25', null),
  ('Prophetic Visions', 'keyforge-prophetic-visions', 'Standard set', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2025-07-18', null),
  ('Crucible Clash', 'keyforge-crucible-clash', 'Special set (sealed play)', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2025-09-01', null),
  ('Vault Masters 2026', 'keyforge-vault-masters-2026', 'Special set (Vault Tour)', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, null, null),
  ('Draconian Measures', 'keyforge-draconian-measures', 'Standard set', '00f04559-5c74-45d2-8514-3b8668478bfa'::uuid, '2026-05-29', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'ed644632-fa1e-4be6-b95a-bc9e98c4ebc9' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ MetaZoo ═══════════════════════════════════════════════════
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('GameQbator Labs', 'gameqbator-labs', '813496b3-93a5-4f5e-9b33-eab2932a1b66', 2, true)
on conflict (franchise_id, name) do nothing;
update public.sets set name = 'Nightfall: First Edition', series = 'Cryptid Nation (original run)', release_date = coalesce('2021-10-01', release_date), is_active = true where id = '3eb376e0-642c-4a40-b819-81d6d56dc6b0';
update public.sets set name = 'Wilderness: First Edition', series = 'Cryptid Nation (original run)', release_date = coalesce('2022-03-01', release_date), total_cards = coalesce(173, total_cards), is_active = true where id = 'bbfa42f6-1de5-40d9-847e-56f665f8de68';
update public.sets set name = 'UFO: First Edition', series = 'Cryptid Nation (original run)', release_date = coalesce('2022-07-01', release_date), total_cards = coalesce(172, total_cards), is_active = true where id = 'f381f38b-fd2b-4342-9dbf-4e812563ff11';
update public.sets set name = 'Seance: First Edition', series = 'Cryptid Nation (original run)', release_date = coalesce('2022-10-01', release_date), total_cards = coalesce(175, total_cards), is_active = true where id = 'e5111e93-3d6e-4192-bb46-d7e259cbf000';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '813496b3-93a5-4f5e-9b33-eab2932a1b66', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Cryptid Nation: Kickstarter Edition', 'metazoo-cryptid-nation-kickstarter-edition', 'Cryptid Nation (original run)', '70124cf6-3e3f-4bee-addb-1fc9d8c32b4e'::uuid, '2021-02-15', 159),
  ('Cryptid Nation: First Edition', 'metazoo-cryptid-nation-first-edition', 'Cryptid Nation (original run)', '70124cf6-3e3f-4bee-addb-1fc9d8c32b4e'::uuid, '2021-07-01', 159),
  ('Cryptid Nation: Second Edition', 'metazoo-cryptid-nation-second-edition', 'Cryptid Nation (original run)', '70124cf6-3e3f-4bee-addb-1fc9d8c32b4e'::uuid, '2021-12-31', 159),
  ('Native: First Edition', 'metazoo-native-first-edition', 'Cryptid Nation (original run)', '70124cf6-3e3f-4bee-addb-1fc9d8c32b4e'::uuid, '2023-04-01', 175),
  ('Base Set (2025)', 'metazoo-base-set-2025', 'Relaunch (GameQbator Labs)', (select id from public.manufacturers where franchise_id = '813496b3-93a5-4f5e-9b33-eab2932a1b66' and lower(name) = 'gameqbator labs' limit 1), '2025-03-28', null),
  ('Torrential Tides', 'metazoo-torrential-tides', 'Relaunch (GameQbator Labs)', (select id from public.manufacturers where franchise_id = '813496b3-93a5-4f5e-9b33-eab2932a1b66' and lower(name) = 'gameqbator labs' limit 1), '2025-08-15', null),
  ('Secret Shadows', 'metazoo-secret-shadows', 'Relaunch (GameQbator Labs)', (select id from public.manufacturers where franchise_id = '813496b3-93a5-4f5e-9b33-eab2932a1b66' and lower(name) = 'gameqbator labs' limit 1), '2025-11-24', null),
  ('Dynamic Decks: Series 1', 'metazoo-dynamic-decks-series-1', 'Relaunch (GameQbator Labs) preconstructed decks', (select id from public.manufacturers where franchise_id = '813496b3-93a5-4f5e-9b33-eab2932a1b66' and lower(name) = 'gameqbator labs' limit 1), '2026-02-20', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '813496b3-93a5-4f5e-9b33-eab2932a1b66' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Force of Will ═══════════════════════════════════════════════════
update public.sets set is_active = false where id = 'd9561452-381f-4373-8836-e772ba8a26ab';
update public.sets set is_active = false where id = '4369c67f-f3bd-4a4b-8434-c26cd55f02eb';
update public.sets set is_active = false where id = '74078e44-6423-470b-b731-6d920c13500b';
update public.sets set is_active = false where id = '97c36cdb-443a-46f3-b888-bca81fefa8bd';
update public.sets set is_active = false where id = 'd00acdbc-38ca-46b5-8b86-af07fedbf336';
update public.sets set is_active = false where id = '712437c7-822f-4390-b4b7-5cf6d2a62a64';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '3e290f9a-c014-4320-8fa7-11e64c2f1393', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('The Dawn of Valhalla', 'fow-the-dawn-of-valhalla', 'Valhalla Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2014-02-04', 259),
  ('The War of Valhalla', 'fow-the-war-of-valhalla', 'Valhalla Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2014-07-25', 240),
  ('The Crimson Moon''s Fairy Tale', 'fow-the-crimson-moon-s-fairy-tale', 'Grimm Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2014-09-12', null),
  ('The Castle of Heaven and The Two Towers', 'fow-the-castle-of-heaven-and-the-two-towers', 'Grimm Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('The Moon Priestess Returns', 'fow-the-moon-priestess-returns', 'Grimm Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('The Millennia of Ages', 'fow-the-millennia-of-ages', 'Grimm Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('Vingolf: Engage Knights', 'fow-vingolf-engage-knights', 'Grimm Cluster (fixed set)', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2015-07-30', null),
  ('The Seven Kings of the Lands', 'fow-the-seven-kings-of-the-lands', 'Alice Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2015-09-25', null),
  ('The Twilight Wanderer', 'fow-the-twilight-wanderer', 'Alice Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2015-12-11', null),
  ('Battle for Attoractia', 'fow-battle-for-attoractia', 'Alice Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2016-06-10', null),
  ('Curse of the Frozen Casket', 'fow-curse-of-the-frozen-casket', 'Lapis Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2016-09-09', null),
  ('Legacy Lost', 'fow-legacy-lost', 'Lapis Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2016-12-09', null),
  ('Return of the Dragon Emperor', 'fow-return-of-the-dragon-emperor', 'Lapis Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2017-03-10', null),
  ('Echoes of the New World', 'fow-echoes-of-the-new-world', 'Lapis Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2017-06-23', null),
  ('Ancient Nights', 'fow-ancient-nights', 'Reiya Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2017-09-08', null),
  ('Advent of the Demon King', 'fow-advent-of-the-demon-king', 'Reiya Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2017-12-08', null),
  ('The Time Spinning Witch', 'fow-the-time-spinning-witch', 'Reiya Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('Winds of the Ominous Moon', 'fow-winds-of-the-ominous-moon', 'Reiya Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('New Dawn Rises', 'fow-new-dawn-rises', 'New Valhalla Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2018-09-28', null),
  ('The Strangers of New Valhalla', 'fow-the-strangers-of-new-valhalla', 'New Valhalla Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('Awakening of the Ancients', 'fow-awakening-of-the-ancients', 'New Valhalla Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('The Decisive Battle of Valhalla', 'fow-the-decisive-battle-of-valhalla', 'New Valhalla Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('Alice Origin', 'fow-alice-origin', 'Alice Origin Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2019-11-01', null),
  ('Alice Origin II', 'fow-alice-origin-ii', 'Alice Origin Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2020-02-01', null),
  ('Alice Origin III', 'fow-alice-origin-iii', 'Alice Origin Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2020-05-22', null),
  ('Prologue of Attoractia', 'fow-prologue-of-attoractia', 'Alice Origin Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2020-08-01', null),
  ('The Epic of the Dragon Lord', 'fow-the-epic-of-the-dragon-lord', 'Saga Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2020-11-01', null),
  ('The Magic Stone War - Zero', 'fow-the-magic-stone-war-zero', 'Saga Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2021-02-26', null),
  ('Assault into the Demonic World', 'fow-assault-into-the-demonic-world', 'Saga Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2021-05-29', null),
  ('The Seventh', 'fow-the-seventh', 'Saga Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2021-08-01', null),
  ('Rebirth of Legend', 'fow-rebirth-of-legend', 'Saga Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('Game of Gods', 'fow-game-of-gods', 'Duel Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2021-12-10', null),
  ('Game of Gods Reloaded', 'fow-game-of-gods-reloaded', 'Duel Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2022-02-01', null),
  ('Game of Gods Revolution', 'fow-game-of-gods-revolution', 'Duel Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2022-05-01', null),
  ('A New World Emerges', 'fow-a-new-world-emerges', 'Hero Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2022-08-01', null),
  ('The Underworld of Secrets', 'fow-the-underworld-of-secrets', 'Hero Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2022-11-01', null),
  ('Ruler Collection Set', 'fow-ruler-collection-set', 'Hero Cluster (supplementary)', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2022-12-01', null),
  ('The War of the Suns', 'fow-the-war-of-the-suns', 'Hero Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2023-02-01', null),
  ('Crimson Moon''s Battleground', 'fow-crimson-moon-s-battleground', 'Hero Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2023-05-01', null),
  ('Clash of the Star Trees', 'fow-clash-of-the-star-trees', 'Hero Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2023-09-01', null),
  ('Judgment of the Rogue Planet', 'fow-judgment-of-the-rogue-planet', 'Hero Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2023-12-01', null),
  ('Masterpiece "Pilgrim-Memories"', 'fow-masterpiece-pilgrim-memories', 'Hero Cluster (supplementary)', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2024-01-01', null),
  ('Thoth of the Trinity', 'fow-thoth-of-the-trinity', 'Trinity Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2024-05-01', null),
  ('The Battle at the Sacred Ruins', 'fow-the-battle-at-the-sacred-ruins', 'Trinity Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2024-08-01', null),
  ('Timeless Eclipse of the Underworld', 'fow-timeless-eclipse-of-the-underworld', 'Trinity Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2024-11-01', null),
  ('Ten Oaths of Protopaterpolis'' War', 'fow-ten-oaths-of-protopaterpolis-war', 'Trinity Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2025-05-01', null),
  ('Masterpiece Collection 02 "Fates Reunited!"', 'fow-masterpiece-collection-02-fates-reunited', 'Trinity Cluster (supplementary)', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, null, null),
  ('Descent into the Raven''s Catacombs', 'fow-descent-into-the-raven-s-catacombs', 'Evil Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2025-08-29', null),
  ('Antechamber of the Ten Dimensions', 'fow-antechamber-of-the-ten-dimensions', 'Evil Cluster (supplementary)', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2025-11-01', null),
  ('Journey to Ravidra', 'fow-journey-to-ravidra', 'Evil Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2025-12-19', null),
  ('Masterpiece 03 "Dimensional Hope"', 'fow-masterpiece-03-dimensional-hope', 'Evil Cluster (supplementary)', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2026-03-01', null),
  ('Attack on Velmardia', 'fow-attack-on-velmardia', 'Evil Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2026-06-26', null),
  ('The Quest of the Seven Keys', 'fow-the-quest-of-the-seven-keys', 'Evil Cluster', '57fbc11b-f6dd-45dd-8b1a-6af19021422f'::uuid, '2026-09-25', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '3e290f9a-c014-4320-8fa7-11e64c2f1393' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ TMNT ═══════════════════════════════════════════════════
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('Topps', 'topps', '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96', 1, true)
on conflict (franchise_id, name) do nothing;
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('Fleer', 'fleer', '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96', 2, true)
on conflict (franchise_id, name) do nothing;
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('UVS Games', 'uvs-games', '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96', 3, true)
on conflict (franchise_id, name) do nothing;
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('Panini', 'panini', '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96', 4, true)
on conflict (franchise_id, name) do nothing;
insert into public.manufacturers (name, slug, franchise_id, sort_order, is_active)
values ('Super7', 'super7', '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96', 5, true)
on conflict (franchise_id, name) do nothing;
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Teenage Mutant Ninja Turtles (1989, Series 1)', 'tmnt-teenage-mutant-ninja-turtles-1989-series-1', 'Topps collector cards (cartoon)', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'topps' limit 1), '1989-01-01', 88),
  ('Teenage Mutant Ninja Turtles (1989, Series 2)', 'tmnt-teenage-mutant-ninja-turtles-1989-series-2', 'Topps collector cards (cartoon)', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'topps' limit 1), '1989-01-01', null),
  ('Teenage Mutant Ninja Turtles (1990 movie cards)', 'tmnt-teenage-mutant-ninja-turtles-1990-movie-cards', 'Topps collector cards (movie)', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'topps' limit 1), '1990-01-01', 132),
  ('Teenage Mutant Ninja Turtles II: The Secret of the Ooze (1991)', 'tmnt-teenage-mutant-ninja-turtles-ii-the-secret-of-the-ooze-1991', 'Topps collector cards (movie)', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'topps' limit 1), '1991-01-01', null),
  ('Teenage Mutant Ninja Turtles III (1992)', 'tmnt-teenage-mutant-ninja-turtles-iii-1992', 'Topps collector cards (movie)', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'topps' limit 1), '1992-01-01', null),
  ('Teenage Mutant Ninja Turtles (2003)', 'tmnt-teenage-mutant-ninja-turtles-2003', 'Fleer collector cards', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'fleer' limit 1), '2003-01-01', 125),
  ('UniVersus: Teenage Mutant Ninja Turtles', 'tmnt-universus-teenage-mutant-ninja-turtles', 'UniVersus CCG (playable TCG)', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'uvs games' limit 1), '2025-08-15', 186),
  ('Teenage Mutant Ninja Turtles Trading Card Game (Panini, 2025)', 'tmnt-teenage-mutant-ninja-turtles-trading-card-game-panini-2025', 'Panini album collection / card game', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'panini' limit 1), '2025-01-01', 225),
  ('Teenage Mutant Ninja Turtles Wax Pack Cards (Super7, 2025)', 'tmnt-teenage-mutant-ninja-turtles-wax-pack-cards-super7-2025', 'Super7 retro collector cards', (select id from public.manufacturers where franchise_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(name) = 'super7' limit 1), '2025-01-01', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '9948e610-dccf-4a9a-ab5c-5bd3d0d3fd96' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Magic: The Gathering ═══════════════════════════════════════════════════
update public.sets set name = 'Dominaria', series = 'Expansion', release_date = coalesce('2018-04-27', release_date), total_cards = coalesce(280, total_cards), is_active = true where id = '1fe93c6d-7300-4cae-9276-dcb93f298a19';
update public.sets set name = 'War of the Spark', series = 'Expansion', release_date = coalesce('2019-05-03', release_date), total_cards = coalesce(311, total_cards), is_active = true where id = '7bc015e0-182f-4190-9503-3abbd2fae60c';
update public.sets set name = 'Modern Horizons', series = 'Draft Innovation', release_date = coalesce('2019-06-14', release_date), total_cards = coalesce(255, total_cards), is_active = true where id = '6d28a55e-cf61-4ee0-b6e8-726f381e6ee3';
update public.sets set name = 'Throne of Eldraine', series = 'Expansion', release_date = coalesce('2019-10-04', release_date), total_cards = coalesce(397, total_cards), is_active = true where id = '8c23785b-42ea-4863-84cf-a531cdd2ef1e';
update public.sets set name = 'Modern Horizons 2', series = 'Draft Innovation', release_date = coalesce('2021-06-18', release_date), total_cards = coalesce(492, total_cards), is_active = true where id = '55dec1a2-abbc-4894-9cd5-e9ce09e93ae7';
update public.sets set name = 'Innistrad: Midnight Hunt', series = 'Expansion', release_date = coalesce('2021-09-24', release_date), total_cards = coalesce(392, total_cards), is_active = true where id = '479bad17-3eb6-4320-8939-dce821ec1b6c';
update public.sets set name = 'Kamigawa: Neon Dynasty', series = 'Expansion', release_date = coalesce('2022-02-18', release_date), total_cards = coalesce(515, total_cards), is_active = true where id = '0dd2c0d1-07ce-4d50-9325-a91160b01f11';
update public.sets set name = 'Streets of New Capenna', series = 'Expansion', release_date = coalesce('2022-04-29', release_date), total_cards = coalesce(469, total_cards), is_active = true where id = 'd3cfc3ca-0657-4d32-b7d4-d516b09b1ab2';
update public.sets set name = 'The Brothers'' War', series = 'Expansion', release_date = coalesce('2022-11-18', release_date), total_cards = coalesce(387, total_cards), is_active = true where id = 'c63373fc-d769-40fb-817f-86ee9eb5eb50';
update public.sets set name = 'Phyrexia: All Will Be One', series = 'Expansion', release_date = coalesce('2023-02-03', release_date), total_cards = coalesce(479, total_cards), is_active = true where id = 'facec665-63ff-4d7b-b3a6-8ba774bb73e3';
update public.sets set name = 'March of the Machine', series = 'Expansion', release_date = coalesce('2023-04-21', release_date), total_cards = coalesce(387, total_cards), is_active = true where id = '014bee76-5eb5-49b9-a969-e263f5db45dc';
update public.sets set name = 'The Lost Caverns of Ixalan', series = 'Expansion', release_date = coalesce('2023-11-17', release_date), total_cards = coalesce(415, total_cards), is_active = true where id = '8b35d5fb-e5ca-4b13-b06b-9fd8dff5e28c';
update public.sets set name = 'Murders at Karlov Manor', series = 'Expansion', release_date = coalesce('2024-02-09', release_date), total_cards = coalesce(451, total_cards), is_active = true where id = '3c43ea19-9401-4453-8145-3dc5a6fa4370';
update public.sets set name = 'Outlaws of Thunder Junction', series = 'Expansion', release_date = coalesce('2024-04-19', release_date), total_cards = coalesce(374, total_cards), is_active = true where id = '7540838a-e3bc-43c5-94aa-6837de93df6a';
update public.sets set name = 'Modern Horizons 3', series = 'Draft Innovation', release_date = coalesce('2024-06-14', release_date), total_cards = coalesce(524, total_cards), is_active = true where id = '29811c08-63e0-4fc0-933f-377a187e1cd7';
update public.sets set name = 'Bloomburrow', series = 'Expansion', release_date = coalesce('2024-08-02', release_date), total_cards = coalesce(397, total_cards), is_active = true where id = 'a5871eec-b433-4a37-8093-b3190f90fae9';
update public.sets set name = 'Duskmourn: House of Horror', series = 'Expansion', release_date = coalesce('2024-09-27', release_date), total_cards = coalesce(417, total_cards), is_active = true where id = 'ba898dbc-2689-4744-8f6b-d452cce75bfb';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '47205824-a2a0-410a-8fd2-4ff0ed8f46df', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Limited Edition Alpha', 'mtg-limited-edition-alpha', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1993-08-05', 295),
  ('Limited Edition Beta', 'mtg-limited-edition-beta', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1993-10-04', 302),
  ('Unlimited Edition', 'mtg-unlimited-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1993-12-01', 302),
  ('Arabian Nights', 'mtg-arabian-nights', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1993-12-17', 92),
  ('Antiquities', 'mtg-antiquities', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1994-03-04', 102),
  ('Revised Edition', 'mtg-revised-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1994-04-11', 306),
  ('Legends', 'mtg-legends', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1994-06-01', 310),
  ('The Dark', 'mtg-the-dark', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1994-08-01', 122),
  ('Fallen Empires', 'mtg-fallen-empires', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1994-11-01', 187),
  ('Fourth Edition', 'mtg-fourth-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1995-04-01', 380),
  ('Ice Age', 'mtg-ice-age', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1995-06-03', 383),
  ('Chronicles', 'mtg-chronicles', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1995-07-01', 125),
  ('Homelands', 'mtg-homelands', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1995-10-01', 140),
  ('Alliances', 'mtg-alliances', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1996-06-10', 199),
  ('Mirage', 'mtg-mirage', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1996-10-08', 353),
  ('Introductory Two-Player Set', 'mtg-introductory-two-player-set', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1996-12-31', 67),
  ('Visions', 'mtg-visions', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1997-02-03', 167),
  ('Fifth Edition', 'mtg-fifth-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1997-03-24', 460),
  ('Portal', 'mtg-portal', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1997-05-01', 257),
  ('Weatherlight', 'mtg-weatherlight', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1997-06-09', 167),
  ('Tempest', 'mtg-tempest', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1997-10-14', 350),
  ('Stronghold', 'mtg-stronghold', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1998-03-02', 143),
  ('Exodus', 'mtg-exodus', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1998-06-15', 143),
  ('Portal Second Age', 'mtg-portal-second-age', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1998-06-24', 165),
  ('Unglued', 'mtg-unglued', 'Un-set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1998-08-11', 88),
  ('Urza''s Saga', 'mtg-urza-s-saga', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1998-10-12', 357),
  ('Urza''s Legacy', 'mtg-urza-s-legacy', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1999-02-15', 143),
  ('Classic Sixth Edition', 'mtg-classic-sixth-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1999-04-21', 351),
  ('Portal Three Kingdoms', 'mtg-portal-three-kingdoms', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1999-05-01', 180),
  ('Urza''s Destiny', 'mtg-urza-s-destiny', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1999-06-07', 143),
  ('Starter 1999', 'mtg-starter-1999', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1999-07-01', 173),
  ('Mercadian Masques', 'mtg-mercadian-masques', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '1999-10-04', 350),
  ('Nemesis', 'mtg-nemesis', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2000-02-14', 143),
  ('Starter 2000', 'mtg-starter-2000', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2000-04-01', 20),
  ('Prophecy', 'mtg-prophecy', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2000-06-05', 144),
  ('Invasion', 'mtg-invasion', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2000-10-02', 354),
  ('Planeshift', 'mtg-planeshift', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2001-02-05', 146),
  ('Seventh Edition', 'mtg-seventh-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2001-04-11', 708),
  ('Apocalypse', 'mtg-apocalypse', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2001-06-04', 143),
  ('Odyssey', 'mtg-odyssey', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2001-10-01', 353),
  ('Torment', 'mtg-torment', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2002-02-04', 143),
  ('Judgment', 'mtg-judgment', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2002-05-27', 143),
  ('Onslaught', 'mtg-onslaught', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2002-10-07', 351),
  ('Legions', 'mtg-legions', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2003-02-03', 145),
  ('Scourge', 'mtg-scourge', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2003-05-26', 143),
  ('Eighth Edition', 'mtg-eighth-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2003-07-28', 711),
  ('Mirrodin', 'mtg-mirrodin', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2003-10-02', 306),
  ('Darksteel', 'mtg-darksteel', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2004-02-06', 165),
  ('Fifth Dawn', 'mtg-fifth-dawn', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2004-06-04', 165),
  ('Champions of Kamigawa', 'mtg-champions-of-kamigawa', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2004-10-01', 307),
  ('Unhinged', 'mtg-unhinged', 'Un-set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2004-11-19', 168),
  ('Betrayers of Kamigawa', 'mtg-betrayers-of-kamigawa', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2005-02-04', 165),
  ('Saviors of Kamigawa', 'mtg-saviors-of-kamigawa', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2005-06-03', 165),
  ('Ninth Edition', 'mtg-ninth-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2005-07-29', 710),
  ('Ravnica: City of Guilds', 'mtg-ravnica-city-of-guilds', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2005-10-07', 306),
  ('Guildpact', 'mtg-guildpact', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2006-02-03', 167),
  ('Dissension', 'mtg-dissension', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2006-05-05', 180),
  ('Coldsnap', 'mtg-coldsnap', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2006-07-21', 155),
  ('Time Spiral Timeshifted', 'mtg-time-spiral-timeshifted', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2006-10-06', 121),
  ('Time Spiral', 'mtg-time-spiral', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2006-10-06', 301),
  ('Planar Chaos', 'mtg-planar-chaos', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2007-02-02', 165),
  ('Future Sight', 'mtg-future-sight', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2007-05-04', 180),
  ('Tenth Edition', 'mtg-tenth-edition', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2007-07-13', 510),
  ('Lorwyn', 'mtg-lorwyn', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2007-10-12', 301),
  ('Morningtide', 'mtg-morningtide', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2008-02-01', 150),
  ('Shadowmoor', 'mtg-shadowmoor', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2008-05-02', 302),
  ('Eventide', 'mtg-eventide', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2008-07-25', 180),
  ('Shards of Alara', 'mtg-shards-of-alara', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2008-10-03', 250),
  ('Conflux', 'mtg-conflux', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2009-02-06', 145),
  ('Alara Reborn', 'mtg-alara-reborn', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2009-04-30', 145),
  ('Magic 2010', 'mtg-magic-2010', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2009-07-17', 249),
  ('Zendikar', 'mtg-zendikar', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2009-10-02', 269),
  ('Worldwake', 'mtg-worldwake', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2010-02-05', 145),
  ('Rise of the Eldrazi', 'mtg-rise-of-the-eldrazi', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2010-04-23', 248),
  ('Magic 2011', 'mtg-magic-2011', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2010-07-16', 249),
  ('Scars of Mirrodin', 'mtg-scars-of-mirrodin', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2010-10-01', 249),
  ('Mirrodin Besieged', 'mtg-mirrodin-besieged', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2011-02-04', 155),
  ('New Phyrexia', 'mtg-new-phyrexia', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2011-05-13', 175),
  ('Commander 2011', 'mtg-commander-2011', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2011-06-17', 318),
  ('Magic 2012', 'mtg-magic-2012', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2011-07-15', 249),
  ('Innistrad', 'mtg-innistrad', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2011-09-30', 264),
  ('Dark Ascension', 'mtg-dark-ascension', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2012-02-03', 158),
  ('Avacyn Restored', 'mtg-avacyn-restored', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2012-05-04', 244),
  ('Magic 2013', 'mtg-magic-2013', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2012-07-13', 249),
  ('Return to Ravnica', 'mtg-return-to-ravnica', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2012-10-05', 274),
  ('Gatecrash', 'mtg-gatecrash', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2013-02-01', 249),
  ('Dragon''s Maze', 'mtg-dragon-s-maze', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2013-05-03', 156),
  ('Modern Masters', 'mtg-modern-masters', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2013-06-07', 229),
  ('Magic 2014', 'mtg-magic-2014', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2013-07-19', 249),
  ('Theros', 'mtg-theros', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2013-09-27', 249),
  ('Commander 2013', 'mtg-commander-2013', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2013-11-01', 356),
  ('Born of the Gods', 'mtg-born-of-the-gods', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2014-02-07', 165),
  ('Journey into Nyx', 'mtg-journey-into-nyx', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2014-05-02', 165),
  ('Conspiracy', 'mtg-conspiracy', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2014-06-06', 210),
  ('Magic 2015 Clash Pack', 'mtg-magic-2015-clash-pack', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2014-07-18', 6),
  ('Magic 2015', 'mtg-magic-2015', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2014-07-18', 284),
  ('Khans of Tarkir', 'mtg-khans-of-tarkir', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2014-09-26', 293),
  ('Commander 2014', 'mtg-commander-2014', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2014-11-07', 337),
  ('Fate Reforged Clash Pack', 'mtg-fate-reforged-clash-pack', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-01-23', 6),
  ('Fate Reforged', 'mtg-fate-reforged', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-01-23', 191),
  ('Dragons of Tarkir', 'mtg-dragons-of-tarkir', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-03-27', 264),
  ('Modern Masters 2015', 'mtg-modern-masters-2015', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-05-22', 249),
  ('Magic Origins Clash Pack', 'mtg-magic-origins-clash-pack', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-07-17', 6),
  ('Magic Origins', 'mtg-magic-origins', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-07-17', 288),
  ('Battle for Zendikar', 'mtg-battle-for-zendikar', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-10-02', 299),
  ('Commander 2015', 'mtg-commander-2015', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2015-11-13', 342),
  ('Oath of the Gatewatch', 'mtg-oath-of-the-gatewatch', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-01-22', 187),
  ('Shadows over Innistrad', 'mtg-shadows-over-innistrad', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-04-08', 302),
  ('Welcome Deck 2016', 'mtg-welcome-deck-2016', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-04-08', 16),
  ('Eternal Masters', 'mtg-eternal-masters', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-06-10', 249),
  ('Eldritch Moon', 'mtg-eldritch-moon', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-07-22', 208),
  ('Conspiracy: Take the Crown', 'mtg-conspiracy-take-the-crown', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-08-26', 222),
  ('Kaladesh', 'mtg-kaladesh', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-09-30', 278),
  ('Commander 2016', 'mtg-commander-2016', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2016-11-11', 351),
  ('Aether Revolt', 'mtg-aether-revolt', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-01-20', 197),
  ('Modern Masters 2017', 'mtg-modern-masters-2017', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-03-17', 249),
  ('Welcome Deck 2017', 'mtg-welcome-deck-2017', 'Starter', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-04-15', 30),
  ('Amonkhet', 'mtg-amonkhet', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-04-28', 287),
  ('Commander Anthology', 'mtg-commander-anthology', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-06-09', 320),
  ('Hour of Devastation', 'mtg-hour-of-devastation', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-07-14', 209),
  ('Commander 2017', 'mtg-commander-2017', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-08-25', 309),
  ('Ixalan', 'mtg-ixalan', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-09-29', 289),
  ('Iconic Masters', 'mtg-iconic-masters', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-11-17', 249),
  ('Unstable', 'mtg-unstable', 'Un-set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2017-12-08', 268),
  ('Rivals of Ixalan', 'mtg-rivals-of-ixalan', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-01-19', 205),
  ('Masters 25', 'mtg-masters-25', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-03-16', 249),
  ('Battlebond', 'mtg-battlebond', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-06-08', 256),
  ('Commander Anthology Volume II', 'mtg-commander-anthology-volume-ii', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-06-08', 312),
  ('Core Set 2019', 'mtg-core-set-2019', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-07-13', 314),
  ('Commander 2018', 'mtg-commander-2018', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-08-10', 307),
  ('Guilds of Ravnica', 'mtg-guilds-of-ravnica', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-10-05', 273),
  ('Ultimate Masters', 'mtg-ultimate-masters', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2018-12-07', 254),
  ('Ravnica Allegiance', 'mtg-ravnica-allegiance', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2019-01-25', 273),
  ('Core Set 2020', 'mtg-core-set-2020', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2019-07-12', 345),
  ('Commander 2019', 'mtg-commander-2019', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2019-08-23', 302),
  ('Mystery Booster', 'mtg-mystery-booster', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2019-11-07', 249),
  ('Theros Beyond Death', 'mtg-theros-beyond-death', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-01-24', 358),
  ('Unsanctioned', 'mtg-unsanctioned', 'Un-set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-02-29', 96),
  ('Commander 2020', 'mtg-commander-2020', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-04-17', 322),
  ('Ikoria: Lair of Behemoths', 'mtg-ikoria-lair-of-behemoths', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-04-24', 389),
  ('Core Set 2021', 'mtg-core-set-2021', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-07-03', 397),
  ('Jumpstart', 'mtg-jumpstart', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-07-17', 496),
  ('Double Masters', 'mtg-double-masters', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-08-07', 384),
  ('Zendikar Rising Commander', 'mtg-zendikar-rising-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-09-25', 142),
  ('Zendikar Rising', 'mtg-zendikar-rising', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-09-25', 392),
  ('Commander Legends', 'mtg-commander-legends', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2020-11-20', 718),
  ('Kaldheim Commander', 'mtg-kaldheim-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-02-05', 119),
  ('Kaldheim', 'mtg-kaldheim', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-02-05', 407),
  ('Time Spiral Remastered', 'mtg-time-spiral-remastered', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-03-19', 411),
  ('Commander 2021', 'mtg-commander-2021', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-04-23', 409),
  ('Strixhaven: School of Mages', 'mtg-strixhaven-school-of-mages', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-04-23', 383),
  ('Forgotten Realms Commander', 'mtg-forgotten-realms-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-07-23', 331),
  ('Adventures in the Forgotten Realms', 'mtg-adventures-in-the-forgotten-realms', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-07-23', 402),
  ('Midnight Hunt Commander', 'mtg-midnight-hunt-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-09-24', 187),
  ('Crimson Vow Commander', 'mtg-crimson-vow-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-11-19', 188),
  ('Innistrad: Crimson Vow', 'mtg-innistrad-crimson-vow', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2021-11-19', 412),
  ('Innistrad: Double Feature', 'mtg-innistrad-double-feature', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-01-28', 535),
  ('Neon Dynasty Commander', 'mtg-neon-dynasty-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-02-18', 179),
  ('New Capenna Commander', 'mtg-new-capenna-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-04-29', 447),
  ('Commander Legends: Battle for Baldur''s Gate', 'mtg-commander-legends-battle-for-baldur-s-gate', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-06-10', 936),
  ('Double Masters 2022', 'mtg-double-masters-2022', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-07-08', 579),
  ('Dominaria United Commander', 'mtg-dominaria-united-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-09-09', 240),
  ('Dominaria United', 'mtg-dominaria-united', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-09-09', 436),
  ('Warhammer 40,000 Commander', 'mtg-warhammer-40-000-commander', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-10-07', 617),
  ('Unfinity', 'mtg-unfinity', 'Un-set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-10-07', 639),
  ('Transformers', 'mtg-transformers', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-11-18', 29),
  ('The Brothers'' War Commander', 'mtg-the-brothers-war-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-11-18', 209),
  ('Jumpstart 2022', 'mtg-jumpstart-2022', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-12-02', 835),
  ('Starter Commander Decks', 'mtg-starter-commander-decks', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2022-12-02', 352),
  ('Dominaria Remastered', 'mtg-dominaria-remastered', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-01-13', 457),
  ('Phyrexia: All Will Be One Commander', 'mtg-phyrexia-all-will-be-one-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-02-03', 174),
  ('March of the Machine Commander', 'mtg-march-of-the-machine-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-04-21', 450),
  ('March of the Machine: The Aftermath', 'mtg-march-of-the-machine-the-aftermath', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-05-12', 230),
  ('Tales of Middle-earth Commander', 'mtg-tales-of-middle-earth-commander', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-06-23', 591),
  ('The Lord of the Rings: Tales of Middle-earth', 'mtg-the-lord-of-the-rings-tales-of-middle-earth', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-06-23', 854),
  ('Commander Masters', 'mtg-commander-masters', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-08-04', 1067),
  ('Wilds of Eldraine Commander', 'mtg-wilds-of-eldraine-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-09-08', 173),
  ('Wilds of Eldraine', 'mtg-wilds-of-eldraine', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-09-08', 381),
  ('Doctor Who', 'mtg-doctor-who', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-10-13', 1178),
  ('The Lost Caverns of Ixalan Commander', 'mtg-the-lost-caverns-of-ixalan-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-11-17', 370),
  ('Jurassic World Collection', 'mtg-jurassic-world-collection', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2023-11-17', 45),
  ('Ravnica Remastered', 'mtg-ravnica-remastered', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-01-12', 531),
  ('Ravnica: Clue Edition', 'mtg-ravnica-clue-edition', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-02-09', 284),
  ('Murders at Karlov Manor Commander', 'mtg-murders-at-karlov-manor-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-02-09', 358),
  ('Fallout', 'mtg-fallout', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-03-08', 1068),
  ('The Big Score', 'mtg-the-big-score', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-04-19', 95),
  ('Outlaws of Thunder Junction Commander', 'mtg-outlaws-of-thunder-junction-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-04-19', 342),
  ('Modern Horizons 3 Commander', 'mtg-modern-horizons-3-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-06-14', 398),
  ('Assassin''s Creed', 'mtg-assassin-s-creed', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-07-05', 309),
  ('Bloomburrow Commander', 'mtg-bloomburrow-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-08-02', 356),
  ('Mystery Booster 2', 'mtg-mystery-booster-2', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-08-02', 384),
  ('Duskmourn: House of Horror Commander', 'mtg-duskmourn-house-of-horror-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-09-27', 373),
  ('Foundations Commander', 'mtg-foundations-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-11-15', 319),
  ('Foundations', 'mtg-foundations', 'Core Set', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-11-15', 771),
  ('Foundations Jumpstart', 'mtg-foundations-jumpstart', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2024-11-15', 779),
  ('Innistrad Remastered', 'mtg-innistrad-remastered', 'Masters', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-01-24', 495),
  ('Aetherdrift', 'mtg-aetherdrift', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-02-14', 553),
  ('Aetherdrift Commander', 'mtg-aetherdrift-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-02-14', 184),
  ('Tarkir: Dragonstorm Commander', 'mtg-tarkir-dragonstorm-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-04-11', 413),
  ('Tarkir: Dragonstorm', 'mtg-tarkir-dragonstorm', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-04-11', 426),
  ('Final Fantasy Commander', 'mtg-final-fantasy-commander', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-06-13', 486),
  ('Final Fantasy', 'mtg-final-fantasy', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-06-13', 598),
  ('Edge of Eternities Commander', 'mtg-edge-of-eternities-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-08-01', 191),
  ('Edge of Eternities', 'mtg-edge-of-eternities', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-08-01', 400),
  ('Marvel''s Spider-Man', 'mtg-marvel-s-spider-man', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-09-26', 286),
  ('Avatar: The Last Airbender', 'mtg-avatar-the-last-airbender', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2025-11-21', 394),
  ('Lorwyn Eclipsed Commander', 'mtg-lorwyn-eclipsed-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-01-23', 176),
  ('Lorwyn Eclipsed', 'mtg-lorwyn-eclipsed', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-01-23', 408),
  ('Teenage Mutant Ninja Turtles', 'mtg-teenage-mutant-ninja-turtles', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-03-06', 320),
  ('Secrets of Strixhaven Commander', 'mtg-secrets-of-strixhaven-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-04-24', 426),
  ('Secrets of Strixhaven', 'mtg-secrets-of-strixhaven', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-04-24', 368),
  ('Marvel Super Heroes Commander', 'mtg-marvel-super-heroes-commander', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-06-26', 866),
  ('Marvel Super Heroes', 'mtg-marvel-super-heroes', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-06-26', 453),
  ('The Hobbit', 'mtg-the-hobbit', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-08-14', 321),
  ('Reality Fracture', 'mtg-reality-fracture', 'Expansion', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-10-02', 462),
  ('Reality Fracture Commander', 'mtg-reality-fracture-commander', 'Commander', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-10-02', 103),
  ('Mystery Booster Commander Edition', 'mtg-mystery-booster-commander-edition', 'Draft Innovation', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-10-19', 80),
  ('Star Trek Commander', 'mtg-star-trek-commander', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-11-13', 41),
  ('Star Trek', 'mtg-star-trek', 'Universes Beyond', 'b2c2d6c8-5bd6-434a-9fb1-db95a9063263'::uuid, '2026-11-13', 135)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '47205824-a2a0-410a-8fd2-4ff0ed8f46df' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Yu-Gi-Oh! ═══════════════════════════════════════════════════
update public.sets set name = 'Legend of Blue Eyes White Dragon', series = 'Core Booster', release_date = coalesce('2002-03-08', release_date), total_cards = coalesce(126, total_cards), is_active = true where id = '2bc0b3ec-77e3-42f0-8443-c1829523eb37';
update public.sets set name = 'Metal Raiders', series = 'Core Booster', release_date = coalesce('2002-06-26', release_date), total_cards = coalesce(144, total_cards), is_active = true where id = 'a538a07f-77e3-4dbe-a681-922a1c2eb1cd';
update public.sets set name = 'Spell Ruler', series = 'Core Booster', release_date = coalesce('2002-09-16', release_date), total_cards = coalesce(131, total_cards), is_active = true where id = 'aea901d2-2db1-49f5-bfe6-4ff126b6ddd0';
update public.sets set name = 'Invasion of Chaos', series = 'Core Booster', release_date = coalesce('2004-03-01', release_date), total_cards = coalesce(112, total_cards), is_active = true where id = 'a85ea26d-b688-4851-b601-6cff41f18cd2';
update public.sets set name = 'Power of the Duelist', series = 'Core Booster', release_date = coalesce('2006-08-16', release_date), total_cards = coalesce(60, total_cards), is_active = true where id = 'dd1eca0e-aece-4956-8990-14dee66f912e';
update public.sets set name = 'Darkwing Blast', series = 'Core Booster', release_date = coalesce('2022-10-20', release_date), total_cards = coalesce(101, total_cards), is_active = true where id = '5f7b7bbe-e40c-4233-9bb3-2ae152eef0b1';
update public.sets set name = 'Cyberstorm Access', series = 'Core Booster', release_date = coalesce('2023-05-04', release_date), total_cards = coalesce(101, total_cards), is_active = true where id = 'ebf94aa5-ed32-4442-a579-a4e1e6f2ef9d';
update public.sets set name = 'Age of Overlord', series = 'Core Booster', release_date = coalesce('2023-10-19', release_date), total_cards = coalesce(101, total_cards), is_active = true where id = 'fea4d94b-342e-45ab-b813-746d8db18275';
update public.sets set name = 'Maze of Millennia', series = 'Special Booster', release_date = coalesce('2024-01-18', release_date), total_cards = coalesce(85, total_cards), is_active = true where id = '107e1d05-91a7-42cd-b38b-e157821122a4';
update public.sets set name = 'Phantom Nightmare', series = 'Core Booster', release_date = coalesce('2024-02-08', release_date), total_cards = coalesce(101, total_cards), is_active = true where id = 'fbd4f456-8cd5-4887-8d5e-991fc511fb8f';
update public.sets set name = 'Legacy of Destruction', series = 'Core Booster', release_date = coalesce('2024-04-25', release_date), total_cards = coalesce(106, total_cards), is_active = true where id = 'bb0208a3-00bf-438c-aa87-d12fca923e9d';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '867b2ddc-a097-4c21-b18a-a7c8fe082fb2', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Pharaoh''s Servant', 'ygo-pharaoh-s-servant', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2002-10-20', 105),
  ('Labyrinth of Nightmare', 'ygo-labyrinth-of-nightmare', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2003-03-01', 105),
  ('Legacy of Darkness', 'ygo-legacy-of-darkness', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2003-06-06', 101),
  ('Pharaonic Guardian', 'ygo-pharaonic-guardian', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2003-07-18', 108),
  ('Magician''s Force', 'ygo-magician-s-force', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2003-10-10', 108),
  ('Dark Crisis', 'ygo-dark-crisis', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2003-12-01', 106),
  ('Ancient Sanctuary', 'ygo-ancient-sanctuary', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2004-06-01', 112),
  ('Movie Pack', 'ygo-movie-pack', 'Movie Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2004-08-13', 4),
  ('Soul of the Duelist', 'ygo-soul-of-the-duelist', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2004-10-01', 60),
  ('Dark Beginning 1', 'ygo-dark-beginning-1', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2004-10-12', 250),
  ('Rise of Destiny', 'ygo-rise-of-destiny', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2004-12-01', 60),
  ('Flaming Eternity', 'ygo-flaming-eternity', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2005-03-01', 60),
  ('Dark Revelation Volume 1', 'ygo-dark-revelation-volume-1', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2005-03-19', 267),
  ('The Lost Millennium', 'ygo-the-lost-millennium', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2005-06-01', 60),
  ('Dark Beginning 2', 'ygo-dark-beginning-2', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2005-07-27', 250),
  ('Cybernetic Revolution', 'ygo-cybernetic-revolution', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2005-08-17', 60),
  ('Dark Revelation Volume 2', 'ygo-dark-revelation-volume-2', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2005-10-20', 224),
  ('Elemental Energy', 'ygo-elemental-energy', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2005-11-16', 60),
  ('Duelist Pack: Chazz Princeton', 'ygo-duelist-pack-chazz-princeton', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2006-02-08', 30),
  ('Duelist Pack: Jaden Yuki', 'ygo-duelist-pack-jaden-yuki', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2006-02-08', 30),
  ('Shadow of Infinity', 'ygo-shadow-of-infinity', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2006-03-01', 60),
  ('Enemy of Justice', 'ygo-enemy-of-justice', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2006-05-17', 60),
  ('Cyberdark Impact', 'ygo-cyberdark-impact', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2006-11-15', 60),
  ('Dark Revelation Volume 3', 'ygo-dark-revelation-volume-3', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2006-11-25', 240),
  ('Duelist Pack: Aster Phoenix', 'ygo-duelist-pack-aster-phoenix', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-02-07', 30),
  ('Duelist Pack: Jaden Yuki 2', 'ygo-duelist-pack-jaden-yuki-2', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-02-07', 30),
  ('Strike of Neos', 'ygo-strike-of-neos', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-02-28', 69),
  ('Duelist Pack: Zane Truesdale', 'ygo-duelist-pack-zane-truesdale', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-03-07', 30),
  ('Force of the Breaker', 'ygo-force-of-the-breaker', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-05-16', 69),
  ('Premium Pack', 'ygo-premium-pack', 'Premium Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-07-26', 15),
  ('Tactical Evolution', 'ygo-tactical-evolution', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-08-15', 90),
  ('Dark Revelation Volume 4', 'ygo-dark-revelation-volume-4', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-11-14', 245),
  ('Gladiator''s Assault', 'ygo-gladiator-s-assault', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2007-11-14', 95),
  ('Duelist Pack: Jaden Yuki 3', 'ygo-duelist-pack-jaden-yuki-3', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-01-26', 25),
  ('Duelist Pack: Jesse Anderson', 'ygo-duelist-pack-jesse-anderson', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-01-26', 25),
  ('Phantom Darkness', 'ygo-phantom-darkness', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-02-13', 100),
  ('Gold Series', 'ygo-gold-series', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-04-02', 45),
  ('Light of Destruction', 'ygo-light-of-destruction', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-05-13', 100),
  ('Retro Pack', 'ygo-retro-pack', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-07-08', 101),
  ('Premium Pack 2', 'ygo-premium-pack-2', 'Premium Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-07-31', 20),
  ('The Duelist Genesis', 'ygo-the-duelist-genesis', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-09-02', 100),
  ('Crossroads of Chaos', 'ygo-crossroads-of-chaos', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-11-18', 100),
  ('Dark Legends', 'ygo-dark-legends', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-11-21', 113),
  ('Anniversary Pack', 'ygo-anniversary-pack', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2008-12-08', 8),
  ('Duelist Pack: Yusei', 'ygo-duelist-pack-yusei', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-02-24', 30),
  ('Crimson Crisis', 'ygo-crimson-crisis', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-03-03', 100),
  ('Gold Series 2009', 'ygo-gold-series-2009', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-04-21', 50),
  ('Raging Battle', 'ygo-raging-battle', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-05-12', 100),
  ('Duelist Pack: Yugi', 'ygo-duelist-pack-yugi', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-07-07', 30),
  ('Retro Pack 2', 'ygo-retro-pack-2', 'Reprint Set', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-07-24', 101),
  ('Ancient Prophecy', 'ygo-ancient-prophecy', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-09-01', 100),
  ('Hidden Arsenal', 'ygo-hidden-arsenal', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-11-05', 30),
  ('Stardust Overdrive', 'ygo-stardust-overdrive', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2009-11-17', 100),
  ('Duelist Pack: Yusei 2', 'ygo-duelist-pack-yusei-2', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-01-15', 30),
  ('Absolute Powerforce', 'ygo-absolute-powerforce', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-02-12', 100),
  ('Duelist Pack: Kaiba', 'ygo-duelist-pack-kaiba', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-04-16', 40),
  ('The Shining Darkness', 'ygo-the-shining-darkness', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-05-07', 100),
  ('Gold Series 3', 'ygo-gold-series-3', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-06-18', 50),
  ('Hidden Arsenal 2', 'ygo-hidden-arsenal-2', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-07-15', 60),
  ('Duelist Revolution', 'ygo-duelist-revolution', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-08-17', 100),
  ('Starstrike Blast', 'ygo-starstrike-blast', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-11-11', 100),
  ('Hidden Arsenal 3', 'ygo-hidden-arsenal-3', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2010-12-02', 60),
  ('Duelist Pack: Yusei 3', 'ygo-duelist-pack-yusei-3', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-01-21', 30),
  ('Storm of Ragnarok', 'ygo-storm-of-ragnarok', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-02-08', 100),
  ('Yu-Gi-Oh! 3D Bonds Beyond Time Movie Pack', 'ygo-yu-gi-oh-3d-bonds-beyond-time-movie-pack', 'Movie Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-02-22', 9),
  ('Hidden Arsenal 4: Trishula''s Triumph', 'ygo-hidden-arsenal-4-trishula-s-triumph', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-04-15', 60),
  ('Extreme Victory', 'ygo-extreme-victory', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-05-06', 100),
  ('Duelist Pack: Crow', 'ygo-duelist-pack-crow', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-05-27', 30),
  ('Gold Series 4: Pyramids Edition', 'ygo-gold-series-4-pyramids-edition', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-06-24', 50),
  ('Generation Force', 'ygo-generation-force', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-08-12', 100),
  ('Legendary Collection 2: The Duel Academy Years Mega Pack', 'ygo-legendary-collection-2-the-duel-academy-years-mega-pack', 'Legendary Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-10-04', 266),
  ('Photon Shockwave', 'ygo-photon-shockwave', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-11-10', 100),
  ('Hidden Arsenal 5: Steelswarm Invasion', 'ygo-hidden-arsenal-5-steelswarm-invasion', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2011-12-01', 60),
  ('Order of Chaos', 'ygo-order-of-chaos', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-01-20', 100),
  ('Ra Yellow Mega Pack', 'ygo-ra-yellow-mega-pack', 'Mega Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-02-17', 113),
  ('Galactic Overlord', 'ygo-galactic-overlord', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-05-08', 100),
  ('Battle Pack: Epic Dawn', 'ygo-battle-pack-epic-dawn', 'Battle Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-05-24', 220),
  ('Gold Series: Haunted Mine', 'ygo-gold-series-haunted-mine', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-06-07', 55),
  ('Hidden Arsenal 6: Omega Xyz', 'ygo-hidden-arsenal-6-omega-xyz', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-07-24', 60),
  ('Return of the Duelist', 'ygo-return-of-the-duelist', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-08-24', 100),
  ('Legendary Collection 3: Yugi''s World Mega Pack', 'ygo-legendary-collection-3-yugi-s-world-mega-pack', 'Legendary Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-09-29', 306),
  ('Abyss Rising', 'ygo-abyss-rising', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2012-11-09', 100),
  ('Cosmo Blazer', 'ygo-cosmo-blazer', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-01-25', 100),
  ('Hidden Arsenal 7: Knight of Stars', 'ygo-hidden-arsenal-7-knight-of-stars', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-04-26', 70),
  ('Lord of the Tachyon Galaxy', 'ygo-lord-of-the-tachyon-galaxy', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-05-17', 100),
  ('Battle Pack 2: War of the Giants', 'ygo-battle-pack-2-war-of-the-giants', 'Battle Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-06-28', 215),
  ('Number Hunters', 'ygo-number-hunters', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-07-12', 60),
  ('Judgment of the Light', 'ygo-judgment-of-the-light', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-08-08', 100),
  ('Legendary Collection 4: Joey''s World Mega Pack', 'ygo-legendary-collection-4-joey-s-world-mega-pack', 'Legendary Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-10-11', 298),
  ('Shadow Specters', 'ygo-shadow-specters', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2013-11-08', 100),
  ('War of the Giants Reinforcements', 'ygo-war-of-the-giants-reinforcements', 'Battle Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-01-17', 104),
  ('War of the Giants: Round 2', 'ygo-war-of-the-giants-round-2', 'Battle Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-01-17', 103),
  ('Legacy of the Valiant', 'ygo-legacy-of-the-valiant', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-01-24', 100),
  ('Premium Gold', 'ygo-premium-gold', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-03-28', 90),
  ('Dragons of Legend', 'ygo-dragons-of-legend', 'Dragons of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-04-25', 51),
  ('Primal Origin', 'ygo-primal-origin', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-05-16', 99),
  ('Battle Pack 3: Monster League', 'ygo-battle-pack-3-monster-league', 'Battle Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-07-31', 237),
  ('Duelist Alliance', 'ygo-duelist-alliance', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-08-14', 100),
  ('Legendary Collection 5D''s Mega Pack', 'ygo-legendary-collection-5d-s-mega-pack', 'Legendary Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-10-23', 256),
  ('The New Challengers', 'ygo-the-new-challengers', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2014-11-06', 100),
  ('Secrets of Eternity', 'ygo-secrets-of-eternity', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-01-15', 100),
  ('The Secret Forces', 'ygo-the-secret-forces', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-02-12', 60),
  ('Premium Gold: Return of the Bling', 'ygo-premium-gold-return-of-the-bling', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-03-19', 91),
  ('World Superstars', 'ygo-world-superstars', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-04-16', 52),
  ('Crossed Souls', 'ygo-crossed-souls', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-05-14', 100),
  ('Duelist Pack: Battle City', 'ygo-duelist-pack-battle-city', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-06-19', 47),
  ('Dragons of Legend 2', 'ygo-dragons-of-legend-2', 'Dragons of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-07-16', 45),
  ('Clash of Rebellions', 'ygo-clash-of-rebellions', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-08-06', 100),
  ('High-Speed Riders', 'ygo-high-speed-riders', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-10-01', 60),
  ('Dimension of Chaos', 'ygo-dimension-of-chaos', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2015-11-05', 100),
  ('Breakers of Shadow', 'ygo-breakers-of-shadow', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-01-14', 100),
  ('Wing Raiders', 'ygo-wing-raiders', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-02-11', 60),
  ('Premium Gold: Infinite Gold', 'ygo-premium-gold-infinite-gold', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-03-17', 100),
  ('Millennium Pack', 'ygo-millennium-pack', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-04-14', 48),
  ('Shining Victories', 'ygo-shining-victories', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-05-05', 100),
  ('Yu-Gi-Oh! The Dark Side of Dimensions Movie Pack', 'ygo-yu-gi-oh-the-dark-side-of-dimensions-movie-pack', 'Movie Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-07-21', 57),
  ('The Dark Illusion', 'ygo-the-dark-illusion', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-08-04', 100),
  ('Dragons of Legend: Unleashed', 'ygo-dragons-of-legend-unleashed', 'Dragons of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-08-18', 73),
  ('Duelist Pack: Rivals of the Pharaoh', 'ygo-duelist-pack-rivals-of-the-pharaoh', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-09-15', 46),
  ('Invasion: Vengeance', 'ygo-invasion-vengeance', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-11-03', 100),
  ('Destiny Soldiers', 'ygo-destiny-soldiers', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2016-11-17', 60),
  ('Raging Tempest', 'ygo-raging-tempest', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-02-09', 100),
  ('Fusion Enforcers', 'ygo-fusion-enforcers', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-02-23', 60),
  ('Duelist Saga', 'ygo-duelist-saga', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-03-30', 100),
  ('Maximum Crisis', 'ygo-maximum-crisis', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-05-04', 100),
  ('Duelist Pack: Dimensional Guardians', 'ygo-duelist-pack-dimensional-guardians', 'Duelist Pack', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-05-25', 45),
  ('Pendulum Evolution', 'ygo-pendulum-evolution', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-06-22', 60),
  ('Battles of Legend: Light''s Revenge', 'ygo-battles-of-legend-light-s-revenge', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-07-06', 80),
  ('Code of the Duelist', 'ygo-code-of-the-duelist', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-08-03', 100),
  ('Legendary Duelists', 'ygo-legendary-duelists', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-09-07', 52),
  ('Circuit Break', 'ygo-circuit-break', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-10-19', 100),
  ('Spirit Warriors', 'ygo-spirit-warriors', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2017-11-16', 60),
  ('Extreme Force', 'ygo-extreme-force', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-02-01', 100),
  ('Legendary Duelists: Ancient Millennium', 'ygo-legendary-duelists-ancient-millennium', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-02-22', 53),
  ('Legendary Collection Kaiba Mega Pack', 'ygo-legendary-collection-kaiba-mega-pack', 'Legendary Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-03-08', 110),
  ('Flames of Destruction', 'ygo-flames-of-destruction', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-05-03', 100),
  ('Dark Saviors', 'ygo-dark-saviors', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-05-24', 60),
  ('Battles of Legend: Relentless Revenge', 'ygo-battles-of-legend-relentless-revenge', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-06-28', 105),
  ('Cybernetic Horizon', 'ygo-cybernetic-horizon', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-07-26', 100),
  ('Shadows in Valhalla', 'ygo-shadows-in-valhalla', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-08-16', 60),
  ('Legendary Duelists: White Dragon Abyss', 'ygo-legendary-duelists-white-dragon-abyss', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-09-27', 56),
  ('Soul Fusion', 'ygo-soul-fusion', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-10-18', 100),
  ('Hidden Summoners', 'ygo-hidden-summoners', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2018-11-15', 60),
  ('Legendary Duelists: Sisters of the Rose', 'ygo-legendary-duelists-sisters-of-the-rose', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-01-10', 56),
  ('Savage Strike', 'ygo-savage-strike', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-01-31', 100),
  ('The Infinity Chasers', 'ygo-the-infinity-chasers', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-03-21', 60),
  ('Dark Neostorm', 'ygo-dark-neostorm', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-05-02', 100),
  ('Battles of Legend: Hero''s Revenge', 'ygo-battles-of-legend-hero-s-revenge', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-07-11', 94),
  ('Rising Rampage', 'ygo-rising-rampage', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-07-25', 100),
  ('Fists of the Gadgets', 'ygo-fists-of-the-gadgets', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-08-22', 60),
  ('Legendary Duelists: Immortal Destiny', 'ygo-legendary-duelists-immortal-destiny', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-09-26', 58),
  ('Chaos Impact', 'ygo-chaos-impact', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-10-24', 100),
  ('Mystic Fighters', 'ygo-mystic-fighters', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2019-11-21', 60),
  ('Legendary Duelists: Magical Hero', 'ygo-legendary-duelists-magical-hero', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-01-16', 56),
  ('Ignition Assault', 'ygo-ignition-assault', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-01-30', 100),
  ('Secret Slayers', 'ygo-secret-slayers', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-04-03', 60),
  ('Eternity Code', 'ygo-eternity-code', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-04-30', 101),
  ('Toon Chaos', 'ygo-toon-chaos', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-06-18', 60),
  ('Legendary Duelists: Season 1', 'ygo-legendary-duelists-season-1', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-07-02', 121),
  ('Battles of Legend: Armageddon', 'ygo-battles-of-legend-armageddon', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-07-23', 94),
  ('Rise of the Duelist', 'ygo-rise-of-the-duelist', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-08-06', 101),
  ('Dragons of Legend: The Complete Series', 'ygo-dragons-of-legend-the-complete-series', 'Dragons of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-09-10', 149),
  ('Legendary Duelists: Rage of Ra', 'ygo-legendary-duelists-rage-of-ra', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-09-24', 57),
  ('Phantom Rage', 'ygo-phantom-rage', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-11-05', 101),
  ('Maximum Gold', 'ygo-maximum-gold', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-11-12', 162),
  ('Genesis Impact', 'ygo-genesis-impact', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2020-12-03', 60),
  ('Legendary Duelists: Season 2', 'ygo-legendary-duelists-season-2', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-01-21', 131),
  ('Blazing Vortex', 'ygo-blazing-vortex', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-02-04', 101),
  ('Ghosts From the Past', 'ygo-ghosts-from-the-past', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-04-15', 132),
  ('Ancient Guardians', 'ygo-ancient-guardians', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-05-06', 60),
  ('Lightning Overdrive', 'ygo-lightning-overdrive', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-06-03', 101),
  ('King''s Court', 'ygo-king-s-court', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-07-08', 65),
  ('Dawn of Majesty', 'ygo-dawn-of-majesty', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-08-12', 101),
  ('Legendary Duelists: Synchro Storm', 'ygo-legendary-duelists-synchro-storm', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-10-28', 56),
  ('Burst of Destiny', 'ygo-burst-of-destiny', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-11-04', 101),
  ('Maximum Gold: El Dorado', 'ygo-maximum-gold-el-dorado', 'Gold Series', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-11-18', 152),
  ('Brothers of Legend', 'ygo-brothers-of-legend', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2021-12-02', 95),
  ('The Grand Creators', 'ygo-the-grand-creators', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-01-27', 60),
  ('Battle of Chaos', 'ygo-battle-of-chaos', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-02-10', 102),
  ('Hidden Arsenal: Chapter 1', 'ygo-hidden-arsenal-chapter-1', 'Hidden Arsenal', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-03-10', 178),
  ('Ghosts From the Past: The 2nd Haunting', 'ygo-ghosts-from-the-past-the-2nd-haunting', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-05-05', 183),
  ('Dimension Force', 'ygo-dimension-force', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-05-19', 101),
  ('Legendary Duelists: Duels From the Deep', 'ygo-legendary-duelists-duels-from-the-deep', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-06-16', 57),
  ('Legendary Duelists: Season 3', 'ygo-legendary-duelists-season-3', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-07-21', 138),
  ('Power of the Elements', 'ygo-power-of-the-elements', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-08-04', 101),
  ('Tactical Masters', 'ygo-tactical-masters', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-08-25', 60),
  ('Battles of Legend: Crystal Revenge', 'ygo-battles-of-legend-crystal-revenge', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2022-11-17', 105),
  ('Amazing Defenders', 'ygo-amazing-defenders', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-01-19', 60),
  ('Photon Hypernova', 'ygo-photon-hypernova', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-02-09', 101),
  ('Maze of Memories', 'ygo-maze-of-memories', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-03-09', 67),
  ('Wild Survivors', 'ygo-wild-survivors', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-06-01', 60),
  ('Battles of Legend: Monstrous Revenge', 'ygo-battles-of-legend-monstrous-revenge', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-06-22', 104),
  ('Duelist Nexus', 'ygo-duelist-nexus', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-07-27', 100),
  ('Legendary Duelists: Soulburning Volcano', 'ygo-legendary-duelists-soulburning-volcano', 'Legendary Duelists', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-08-10', 62),
  ('25th Anniversary Rarity Collection', 'ygo-25th-anniversary-rarity-collection', 'Rarity Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-11-02', 79),
  ('Valiant Smashers', 'ygo-valiant-smashers', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2023-11-16', 60),
  ('Battles of Legend: Chapter 1', 'ygo-battles-of-legend-chapter-1', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2024-02-22', 163),
  ('25th Anniversary Rarity Collection II', 'ygo-25th-anniversary-rarity-collection-ii', 'Rarity Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2024-05-23', 79),
  ('Battles of Legend: Terminal Revenge', 'ygo-battles-of-legend-terminal-revenge', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2024-06-20', 118),
  ('The Infinite Forbidden', 'ygo-the-infinite-forbidden', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2024-07-18', 106),
  ('Rage of the Abyss', 'ygo-rage-of-the-abyss', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2024-10-10', 101),
  ('Quarter Century Bonanza', 'ygo-quarter-century-bonanza', 'Rarity Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2024-11-07', 276),
  ('Crossover Breakers', 'ygo-crossover-breakers', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2024-12-05', 60),
  ('Supreme Darkness', 'ygo-supreme-darkness', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2025-01-23', null),
  ('Maze of the Master', 'ygo-maze-of-the-master', 'Special Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2025-03-13', null),
  ('Quarter Century Stampede', 'ygo-quarter-century-stampede', 'Rarity Collection', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2025-04-10', null),
  ('Alliance Insight', 'ygo-alliance-insight', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2025-05-01', null),
  ('Battles of Legend: Monster Mayhem', 'ygo-battles-of-legend-monster-mayhem', 'Battles of Legend', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2025-06-12', null),
  ('Duelist''s Advance', 'ygo-duelist-s-advance', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2025-07-03', null),
  ('Doom of Dimensions', 'ygo-doom-of-dimensions', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2025-10-16', null),
  ('Justice Hunters', 'ygo-justice-hunters', 'Core Booster', '7b576ac8-c16e-410f-9223-debea8938bbc'::uuid, '2026-01-22', null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '867b2ddc-a097-4c21-b18a-a7c8fe082fb2' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Final Fantasy TCG ═══════════════════════════════════════════════════
update public.sets set name = 'Opus I', series = 'Opus', release_date = coalesce('2016-10-28', release_date), is_active = true where id = '1b99fb2b-970e-46ee-82e6-932d0d4a2593';
update public.sets set name = 'Opus II', series = 'Opus', release_date = coalesce('2017-03-24', release_date), is_active = true where id = '46d61572-e2ac-48d0-b445-79ad0b5518b4';
update public.sets set name = 'Opus III', series = 'Opus', release_date = coalesce('2017-07-28', release_date), is_active = true where id = '1817fe7c-876a-4df5-bc7a-335d29f54081';
update public.sets set name = 'Opus IV', series = 'Opus', release_date = coalesce('2017-11-17', release_date), is_active = true where id = 'e2c173e8-2c63-457f-b866-dfb2fcb55175';
update public.sets set name = 'Opus V', series = 'Opus', release_date = coalesce('2018-03-23', release_date), is_active = true where id = '15551916-cc4e-4cb2-ab13-ef8b4d4ee2a0';
update public.sets set name = 'Opus VI', series = 'Opus', release_date = coalesce('2018-07-20', release_date), is_active = true where id = '75a15612-27e2-4166-a4a2-826d28943d36';
update public.sets set name = 'Opus VII', series = 'Opus', release_date = coalesce('2018-11-09', release_date), is_active = true where id = 'fb79b397-b5cd-4f65-8c71-77b757d026fc';
update public.sets set name = 'Opus VIII', series = 'Opus', release_date = coalesce('2019-03-29', release_date), is_active = true where id = '2c48ccae-d051-42e0-bf2e-7815376b60bb';
update public.sets set name = 'Opus IX', series = 'Opus', release_date = coalesce('2019-07-26', release_date), is_active = true where id = '4d138ab5-589e-4f5d-b95b-cc792dab68f0';
update public.sets set name = 'Opus X', series = 'Opus', release_date = coalesce('2019-11-22', release_date), is_active = true where id = '9e9132bf-dc4f-4a08-8c72-a0cf4fe3f544';
update public.sets set name = 'Opus XI', series = 'Opus', is_active = true where id = '2c57f2b8-d457-4fce-abb6-598414aa651b';
update public.sets set name = 'Opus XII', series = 'Opus', is_active = true where id = '9d3dcd33-c7a7-47f9-99b3-eb09169f8bec';
update public.sets set name = 'Opus XIII', series = 'Opus', is_active = true where id = '5edac757-8d8f-4d6b-90f2-be0c6bb11aaf';
update public.sets set name = 'Opus XIV', series = 'Opus', is_active = true where id = '03b1ea2e-d541-4b98-8191-6743ea700a82';
update public.sets set name = 'Crystal Dominion (Opus XV)', series = 'Named Set', is_active = true where id = 'bc41c06e-a4b9-4318-a201-2c4149eb1537';
update public.sets set name = 'Emissaries of Light (Opus XVI)', series = 'Named Set', is_active = true where id = '6127be9b-6428-462d-9865-b4722187af9d';
update public.sets set name = 'Starter Sets & Boss Decks', series = 'Starter / Boss Deck', is_active = true where id = '23f1ccd5-cf6b-48d3-80f4-cb54add8cce3';
update public.sets set is_active = false where id = 'd9286e4e-eaac-44ff-afa9-08ab80a8805a';
update public.sets set is_active = false where id = '94f4a510-84b4-425f-a00a-b15ad1e67ecc';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '1f9ac140-1667-4607-9113-2d41c9da7ea8', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Rebellion''s Call (Opus XVII)', 'fftcg-rebellion-s-call-opus-xvii', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('Resurgence of Power (Opus XVIII)', 'fftcg-resurgence-of-power-opus-xviii', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('From Nightmares (Opus XIX)', 'fftcg-from-nightmares-opus-xix', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('Dawn of Heroes (Opus XX)', 'fftcg-dawn-of-heroes-opus-xx', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('Beyond Destiny (Opus XXI)', 'fftcg-beyond-destiny-opus-xxi', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('Hidden Hope (Opus XXII)', 'fftcg-hidden-hope-opus-xxii', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('Hidden Trials (Opus XXIII)', 'fftcg-hidden-trials-opus-xxiii', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('Hidden Legends (Opus XXIV)', 'fftcg-hidden-legends-opus-xxiv', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null),
  ('Tears of the Planet (Opus XXV)', 'fftcg-tears-of-the-planet-opus-xxv', 'Named Set', '045b6cd1-8bcd-48d1-9661-a77d30aa000b'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '1f9ac140-1667-4607-9113-2d41c9da7ea8' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Weiss Schwarz ═══════════════════════════════════════════════════
update public.sets set name = 'Weiss Schwarz: Fate/stay night', series = 'Title Booster', is_active = true where id = 'f30388d9-eb5a-4782-923e-a51c1829ca91';
update public.sets set name = 'Weiss Schwarz: Sword Art Online', series = 'Title Booster', is_active = true where id = 'b094078a-d0d9-4ab2-bcf7-e8cf3e9e1713';
update public.sets set name = 'Weiss Schwarz: Attack on Titan', series = 'Title Booster', is_active = true where id = 'b08922be-a373-4338-bd33-b96aed20e154';
update public.sets set name = 'Weiss Schwarz: Re:ZERO -Starting Life in Another World-', series = 'Title Booster', is_active = true where id = '258c82e6-15b4-4094-90e6-df355ba43f24';
update public.sets set name = 'Weiss Schwarz: Marvel Card Collection', series = 'Title Booster', is_active = true where id = '235c256f-cbec-4984-b9d3-05ef13bd9272';
update public.sets set name = 'Weiss Schwarz: hololive production', series = 'Title Booster', is_active = true where id = 'd5ebe252-d2a1-47be-aad7-2fc6d205bd74';
update public.sets set name = 'Weiss Schwarz: Disney 100', series = 'Title Booster', is_active = true where id = '2fc1516c-277c-478d-ba48-f894f70e7c10';
update public.sets set name = 'Weiss Schwarz: Chainsaw Man', series = 'Title Booster', is_active = true where id = '9d2adbd7-c69f-4a32-97eb-6633eba1d9c9';
update public.sets set name = 'Weiss Schwarz: Pixar Characters', series = 'Title Booster', is_active = true where id = '22148b6b-7ec9-4f18-8d68-5f528247b0d6';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '5265b0e9-479e-4504-8ef8-149a9b5e0519', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Weiss Schwarz: Disgaea', 'ws-weiss-schwarz-disgaea', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Shana', 'ws-weiss-schwarz-shana', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Lucky Star', 'ws-weiss-schwarz-lucky-star', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Persona 3', 'ws-weiss-schwarz-persona-3', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Fate/Zero', 'ws-weiss-schwarz-fate-zero', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Puella Magi Madoka Magica', 'ws-weiss-schwarz-puella-magi-madoka-magica', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Love Live!', 'ws-weiss-schwarz-love-live', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Persona 4', 'ws-weiss-schwarz-persona-4', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Kill la Kill', 'ws-weiss-schwarz-kill-la-kill', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Nisekoi', 'ws-weiss-schwarz-nisekoi', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Log Horizon', 'ws-weiss-schwarz-log-horizon', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Sword Art Online II', 'ws-weiss-schwarz-sword-art-online-ii', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Hatsune Miku: Project DIVA f', 'ws-weiss-schwarz-hatsune-miku-project-diva-f', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: KanColle', 'ws-weiss-schwarz-kancolle', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Bakemonogatari', 'ws-weiss-schwarz-bakemonogatari', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Charlotte', 'ws-weiss-schwarz-charlotte', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Angel Beats! Re:Edit', 'ws-weiss-schwarz-angel-beats-re-edit', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Love Live! Sunshine!!', 'ws-weiss-schwarz-love-live-sunshine', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Rewrite', 'ws-weiss-schwarz-rewrite', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Attack on Titan Vol. 2', 'ws-weiss-schwarz-attack-on-titan-vol-2', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Cardcaptor Sakura: Clear Card', 'ws-weiss-schwarz-cardcaptor-sakura-clear-card', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: BanG Dream!', 'ws-weiss-schwarz-bang-dream', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Fate/Apocrypha', 'ws-weiss-schwarz-fate-apocrypha', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: KonoSuba', 'ws-weiss-schwarz-konosuba', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Overlord', 'ws-weiss-schwarz-overlord', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Goblin Slayer', 'ws-weiss-schwarz-goblin-slayer', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Date A Live', 'ws-weiss-schwarz-date-a-live', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Persona 5', 'ws-weiss-schwarz-persona-5', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Adventure Time', 'ws-weiss-schwarz-adventure-time', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Batman Ninja', 'ws-weiss-schwarz-batman-ninja', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Sword Art Online: Alicization', 'ws-weiss-schwarz-sword-art-online-alicization', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Fate/Grand Order Absolute Demonic Front: Babylonia', 'ws-weiss-schwarz-fate-grand-order-absolute-demonic-front-babylonia', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: RWBY', 'ws-weiss-schwarz-rwby', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: That Time I Got Reincarnated as a Slime', 'ws-weiss-schwarz-that-time-i-got-reincarnated-as-a-slime', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Kaguya-sama: Love Is War', 'ws-weiss-schwarz-kaguya-sama-love-is-war', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: KonoSuba Vol. 2', 'ws-weiss-schwarz-konosuba-vol-2', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: BOFURI', 'ws-weiss-schwarz-bofuri', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Rascal Does Not Dream of Bunny Girl Senpai', 'ws-weiss-schwarz-rascal-does-not-dream-of-bunny-girl-senpai', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: The Quintessential Quintuplets', 'ws-weiss-schwarz-the-quintessential-quintuplets', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Demon Slayer: Kimetsu no Yaiba', 'ws-weiss-schwarz-demon-slayer-kimetsu-no-yaiba', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Shaman King', 'ws-weiss-schwarz-shaman-king', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Love Live! Nijigasaki High School Idol Club', 'ws-weiss-schwarz-love-live-nijigasaki-high-school-idol-club', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Fate/Grand Order THE MOVIE Divine Realm of the Round Table: Camelot', 'ws-weiss-schwarz-fate-grand-order-the-movie-divine-realm-of-the-round-table-camelot', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Spy x Family', 'ws-weiss-schwarz-spy-x-family', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Lycoris Recoil', 'ws-weiss-schwarz-lycoris-recoil', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Tokyo Revengers', 'ws-weiss-schwarz-tokyo-revengers', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Attack on Titan Final Season', 'ws-weiss-schwarz-attack-on-titan-final-season', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: hololive production Vol. 2', 'ws-weiss-schwarz-hololive-production-vol-2', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Sword Art Online 10th Anniversary', 'ws-weiss-schwarz-sword-art-online-10th-anniversary', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Oshi no Ko', 'ws-weiss-schwarz-oshi-no-ko', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Bocchi the Rock!', 'ws-weiss-schwarz-bocchi-the-rock', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: hololive production Vol. 3 / hololive English', 'ws-weiss-schwarz-hololive-production-vol-3-hololive-english', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null),
  ('Weiss Schwarz: Frieren: Beyond Journey''s End', 'ws-weiss-schwarz-frieren-beyond-journey-s-end', 'Title Booster', '8559759b-9be2-41c5-8e9c-58b83bab6153'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '5265b0e9-479e-4504-8ef8-149a9b5e0519' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Cardfight!! Vanguard ═══════════════════════════════════════════════════
update public.sets set is_active = false where id = 'bf273b0b-f4fc-4876-a438-3eef3473be62';
update public.sets set is_active = false where id = '6951e015-096b-4c0b-b98a-a4b501b74a61';
update public.sets set is_active = false where id = '7800dd35-ea34-49e0-af4d-7e37832e4682';
update public.sets set is_active = false where id = 'e6c33d5c-71c0-459f-b09c-e7be4883cfee';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '3ca9f6a7-8900-421c-b492-5cf3401f589e', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('BT01 Descent of the King of Knights', 'cfv-bt01-descent-of-the-king-of-knights', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT02 Onslaught of Dragon Souls', 'cfv-bt02-onslaught-of-dragon-souls', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT03 Demonic Lord Invasion', 'cfv-bt03-demonic-lord-invasion', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT04 Eclipse of Illusionary Shadows', 'cfv-bt04-eclipse-of-illusionary-shadows', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT05 Awakening of Twin Blades', 'cfv-bt05-awakening-of-twin-blades', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT06 Breaker of Limits', 'cfv-bt06-breaker-of-limits', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT07 Rampage of the Beast King', 'cfv-bt07-rampage-of-the-beast-king', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT08 Blue Storm Armada', 'cfv-bt08-blue-storm-armada', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT09 Clash of the Knights & Dragons', 'cfv-bt09-clash-of-the-knights-and-dragons', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT10 Triumphant Return of the King of Knights', 'cfv-bt10-triumphant-return-of-the-king-of-knights', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT11 Seal Dragons Unleashed', 'cfv-bt11-seal-dragons-unleashed', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT12 Binding Force of the Black Rings', 'cfv-bt12-binding-force-of-the-black-rings', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT13 Catastrophic Outbreak', 'cfv-bt13-catastrophic-outbreak', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT14 Brilliant Strike', 'cfv-bt14-brilliant-strike', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT15 Infinite Rebirth', 'cfv-bt15-infinite-rebirth', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT16 Legion of Dragons & Blades', 'cfv-bt16-legion-of-dragons-and-blades', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('BT17 Blazing Perdition', 'cfv-bt17-blazing-perdition', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB01 Comic Style Vol. 1', 'cfv-eb01-comic-style-vol-1', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB02 Banquet of Divas', 'cfv-eb02-banquet-of-divas', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB03 Cavalry of Black Steel', 'cfv-eb03-cavalry-of-black-steel', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB04 Infinite Phantom Legion', 'cfv-eb04-infinite-phantom-legion', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB05 Celestial Valkyries', 'cfv-eb05-celestial-valkyries', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB06 Dazzling Divas', 'cfv-eb06-dazzling-divas', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB07 Mystical Magus', 'cfv-eb07-mystical-magus', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB08 Champions of the Cosmos', 'cfv-eb08-champions-of-the-cosmos', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB09 Divine Dragon Progression', 'cfv-eb09-divine-dragon-progression', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB10 Divas Duet', 'cfv-eb10-divas-duet', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB11 Requiem at Dusk', 'cfv-eb11-requiem-at-dusk', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('EB12 Waltz of the Goddess', 'cfv-eb12-waltz-of-the-goddess', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('FC01 Fighter''s Collection 2013', 'cfv-fc01-fighter-s-collection-2013', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('FC02 Fighter''s Collection 2014', 'cfv-fc02-fighter-s-collection-2014', 'Original', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT01 Generation Stride', 'cfv-g-bt01-generation-stride', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT02 Soaring Ascent of Gale & Blossom', 'cfv-g-bt02-soaring-ascent-of-gale-and-blossom', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT03 Sovereign Star Dragon', 'cfv-g-bt03-sovereign-star-dragon', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT04 Soul Strike Against the Supreme', 'cfv-g-bt04-soul-strike-against-the-supreme', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT05 Moonlit Dragonfang', 'cfv-g-bt05-moonlit-dragonfang', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT06 Transcension of Blade & Blossom', 'cfv-g-bt06-transcension-of-blade-and-blossom', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT07 Glorious Bravery of Radiant Sword', 'cfv-g-bt07-glorious-bravery-of-radiant-sword', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT08 Absolute Judgment', 'cfv-g-bt08-absolute-judgment', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT09 Divine Dragon Caper', 'cfv-g-bt09-divine-dragon-caper', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT10 Raging Clash of the Blade Fangs', 'cfv-g-bt10-raging-clash-of-the-blade-fangs', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT11 Demonic Advent', 'cfv-g-bt11-demonic-advent', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT12 Dragon King''s Awakening', 'cfv-g-bt12-dragon-king-s-awakening', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT13 Ultimate Stride', 'cfv-g-bt13-ultimate-stride', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-BT14 Divine Dragon Apocalypse', 'cfv-g-bt14-divine-dragon-apocalypse', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-EB01 Cosmic Roar', 'cfv-g-eb01-cosmic-roar', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-EB02 The AWAKENING ZOO', 'cfv-g-eb02-the-awakening-zoo', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-EB03 The GALAXY STAR GATE', 'cfv-g-eb03-the-galaxy-star-gate', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CB01 Academy of Divas', 'cfv-g-cb01-academy-of-divas', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CB02 Commander of the Incessant Waves', 'cfv-g-cb02-commander-of-the-incessant-waves', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CB03 Blessing of Divas', 'cfv-g-cb03-blessing-of-divas', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CB04 Gear of Fate', 'cfv-g-cb04-gear-of-fate', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CB05 Prismatic Divas', 'cfv-g-cb05-prismatic-divas', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CB06 Rondeau of Chaos & Salvation', 'cfv-g-cb06-rondeau-of-chaos-and-salvation', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CB07 Divas'' Festa', 'cfv-g-cb07-divas-festa', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CHB01 TRY3 NEXT', 'cfv-g-chb01-try3-next', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CHB02 We Are!!! Trinity Dragon', 'cfv-g-chb02-we-are-trinity-dragon', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-CHB03 Rummy Labyrinth Under the Moonlight', 'cfv-g-chb03-rummy-labyrinth-under-the-moonlight', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-FC01 Fighter''s Collection 2015', 'cfv-g-fc01-fighter-s-collection-2015', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-FC02 Fighter''s Collection 2015 Winter', 'cfv-g-fc02-fighter-s-collection-2015-winter', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-FC03 Fighter''s Collection 2016', 'cfv-g-fc03-fighter-s-collection-2016', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('G-FC04 Fighter''s Collection 2017', 'cfv-g-fc04-fighter-s-collection-2017', 'G', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT01 UNITE! TEAM Q4', 'cfv-v-bt01-unite-team-q4', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT02 Strongest! Team AL4', 'cfv-v-bt02-strongest-team-al4', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT03 Miyaji Academy CF Club', 'cfv-v-bt03-miyaji-academy-cf-club', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT04 Vilest! Deletor', 'cfv-v-bt04-vilest-deletor', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT05 Aerial Steed Liberation', 'cfv-v-bt05-aerial-steed-liberation', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT06 Phantasmal Steed Restoration', 'cfv-v-bt06-phantasmal-steed-restoration', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT07 Infinideity Cradle', 'cfv-v-bt07-infinideity-cradle', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT08 Silverdust Blaze', 'cfv-v-bt08-silverdust-blaze', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT09 Butterfly d''Moonlight', 'cfv-v-bt09-butterfly-d-moonlight', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT10 Phantom Dragon Aeon', 'cfv-v-bt10-phantom-dragon-aeon', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT11 Storm of the Blue Cavalry', 'cfv-v-bt11-storm-of-the-blue-cavalry', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-BT12 Divine Lightning Radiance', 'cfv-v-bt12-divine-lightning-radiance', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB01 The Destructive Roar', 'cfv-v-eb01-the-destructive-roar', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB02 Champions of the Asia Circuit', 'cfv-v-eb02-champions-of-the-asia-circuit', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB03 ULTRARARE MIRACLE COLLECTION', 'cfv-v-eb03-ultrarare-miracle-collection', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB04 The Answer of Truth', 'cfv-v-eb04-the-answer-of-truth', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB05 Primary Melody', 'cfv-v-eb05-primary-melody', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB06 Light of Salvation, Logic of Destruction', 'cfv-v-eb06-light-of-salvation-logic-of-destruction', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB07 The Heroic Evolution', 'cfv-v-eb07-the-heroic-evolution', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB08 My Glorious Justice', 'cfv-v-eb08-my-glorious-justice', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB09 The Raging Tactics', 'cfv-v-eb09-the-raging-tactics', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB10 The Mysterious Fortune', 'cfv-v-eb10-the-mysterious-fortune', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB11 Crystal Melody', 'cfv-v-eb11-crystal-melody', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB12 Team Dragon''s Vanity!', 'cfv-v-eb12-team-dragon-s-vanity', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB13 The Astral Force', 'cfv-v-eb13-the-astral-force', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB14 The Next Stage', 'cfv-v-eb14-the-next-stage', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('V-EB15 Twinkle Melody', 'cfv-v-eb15-twinkle-melody', 'V', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT01 Genesis of the Five Greats', 'cfv-d-bt01-genesis-of-the-five-greats', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT02 A Brush with the Legends', 'cfv-d-bt02-a-brush-with-the-legends', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT03 Advance of Intertwined Stars', 'cfv-d-bt03-advance-of-intertwined-stars', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT04 Awakening of Chakrabarthi', 'cfv-d-bt04-awakening-of-chakrabarthi', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT05 Triumphant Return of the Brave Heroes', 'cfv-d-bt05-triumphant-return-of-the-brave-heroes', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT06 Blazing Dragon Reborn', 'cfv-d-bt06-blazing-dragon-reborn', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT07 Raging Flames Against Emerald Storm', 'cfv-d-bt07-raging-flames-against-emerald-storm', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT08 Minerva Rising', 'cfv-d-bt08-minerva-rising', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT09 Dragontree Invasion', 'cfv-d-bt09-dragontree-invasion', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT10 Dragon Masquerade', 'cfv-d-bt10-dragon-masquerade', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT11 Clash of the Heroes', 'cfv-d-bt11-clash-of-the-heroes', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT12 Evenfall Onslaught', 'cfv-d-bt12-evenfall-onslaught', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-BT13 Flight of Chaos', 'cfv-d-bt13-flight-of-chaos', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-VS01 V Clan Collection Vol.1', 'cfv-d-vs01-v-clan-collection-vol-1', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-VS02 V Clan Collection Vol.2', 'cfv-d-vs02-v-clan-collection-vol-2', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-VS03 V Clan Collection Vol.3', 'cfv-d-vs03-v-clan-collection-vol-3', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-VS04 V Clan Collection Vol.4', 'cfv-d-vs04-v-clan-collection-vol-4', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-VS05 V Clan Collection Vol.5', 'cfv-d-vs05-v-clan-collection-vol-5', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-VS06 V Clan Collection Vol.6', 'cfv-d-vs06-v-clan-collection-vol-6', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-LBT01 Lyrical Melody', 'cfv-d-lbt01-lyrical-melody', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-LBT02 Lyrical Monasterio: Trick or Trick!', 'cfv-d-lbt02-lyrical-monasterio-trick-or-trick', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-LBT03 Lyrical Monasterio: It''s a New Year!', 'cfv-d-lbt03-lyrical-monasterio-it-s-a-new-year', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-SS01 Festival Collection', 'cfv-d-ss01-festival-collection', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('D-SS02 Festival Collection 2022', 'cfv-d-ss02-festival-collection-2022', 'D (overDress)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('DZ-BT01 Fated Clash', 'cfv-dz-bt01-fated-clash', 'DZ (Divinez)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null),
  ('DZ-BT02 Illusionless Strife', 'cfv-dz-bt02-illusionless-strife', 'DZ (Divinez)', '51eb429f-64c8-4996-b73d-7c8f85fc040a'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '3ca9f6a7-8900-421c-b492-5cf3401f589e' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Shadowverse: Evolve ═══════════════════════════════════════════════════
update public.sets set name = 'BP01 Advent of Genesis', series = 'Booster Pack', is_active = true where id = '35a07a15-72d3-4a29-90e8-6a32b94f2065';
update public.sets set name = 'BP02 Reign of Bahamut', series = 'Booster Pack', is_active = true where id = '76b55872-8f7f-48a5-9d4a-b431eab39c50';
update public.sets set name = 'BP03 Flame of Laevateinn', series = 'Booster Pack', is_active = true where id = 'd35702ef-6339-4885-a0f0-b34729394502';
update public.sets set name = 'BP04 Cosmic Mythos', series = 'Booster Pack', is_active = true where id = 'a71f479f-04cd-48c0-82ee-a1868cc5347d';
update public.sets set name = 'BP05 Eternal Awakening', series = 'Booster Pack', is_active = true where id = '21fce54a-550f-45d3-bd6a-ba9c7b2f8608';
update public.sets set is_active = false where id = 'a7bdc348-d259-40e8-9259-82185889f5b9';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'abce80a0-ffc4-4663-bcd7-5d03eb6a2042', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('SD01 Starter Deck: Forestcraft (Aria''s Whirlwind)', 'sve-sd01-starter-deck-forestcraft-aria-s-whirlwind', 'Starter Deck', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null),
  ('SD03 Starter Deck: Runecraft', 'sve-sd03-starter-deck-runecraft', 'Starter Deck', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null),
  ('SD04 Starter Deck: Dragoncraft', 'sve-sd04-starter-deck-dragoncraft', 'Starter Deck', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null),
  ('SD05 Starter Deck: Shadowcraft', 'sve-sd05-starter-deck-shadowcraft', 'Starter Deck', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null),
  ('SD06 Starter Deck: Bloodcraft', 'sve-sd06-starter-deck-bloodcraft', 'Starter Deck', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null),
  ('SD07 Starter Deck: Havencraft', 'sve-sd07-starter-deck-havencraft', 'Starter Deck', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null),
  ('BP06 Paragons of the Colosseum', 'sve-bp06-paragons-of-the-colosseum', 'Booster Pack', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null),
  ('CP01 Collaboration Pack: Umamusume: Pretty Derby', 'sve-cp01-collaboration-pack-umamusume-pretty-derby', 'Collaboration Pack', '766a3d09-0205-4c6e-92bd-834cf232e055'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'abce80a0-ffc4-4663-bcd7-5d03eb6a2042' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Hololive OCG ═══════════════════════════════════════════════════
update public.sets set is_active = false where id = '6a5c109c-0ada-4267-8f1b-df7e6de99f7c';
update public.sets set is_active = false where id = '8f78f102-722e-4eb3-963c-4117fac3415a';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '9284a29b-5092-446f-a8e9-0834d9b3a725', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('hSD01 Start Deck: Tokino Sora & AZKi', 'hololive-hsd01-start-deck-tokino-sora-and-azki', 'Start Deck', 'be8f78d4-dfba-45ba-ba56-3fe30b7fe1e2'::uuid, '2024-09-20', null),
  ('hBP01 Blooming Radiance', 'hololive-hbp01-blooming-radiance', 'Booster Pack', 'be8f78d4-dfba-45ba-ba56-3fe30b7fe1e2'::uuid, '2024-09-20', null),
  ('hBP02 Quintet Spectrum', 'hololive-hbp02-quintet-spectrum', 'Booster Pack', 'be8f78d4-dfba-45ba-ba56-3fe30b7fe1e2'::uuid, '2024-12-20', null),
  ('hSD02 Start Deck: Hakui Koyori', 'hololive-hsd02-start-deck-hakui-koyori', 'Start Deck', 'be8f78d4-dfba-45ba-ba56-3fe30b7fe1e2'::uuid, null, null),
  ('hSD03 Start Deck: Usada Pekora', 'hololive-hsd03-start-deck-usada-pekora', 'Start Deck', 'be8f78d4-dfba-45ba-ba56-3fe30b7fe1e2'::uuid, null, null),
  ('hSD04 Start Deck: Kobo Kanaeru', 'hololive-hsd04-start-deck-kobo-kanaeru', 'Start Deck', 'be8f78d4-dfba-45ba-ba56-3fe30b7fe1e2'::uuid, null, null),
  ('hBP03 Elite Spark', 'hololive-hbp03-elite-spark', 'Booster Pack', 'be8f78d4-dfba-45ba-ba56-3fe30b7fe1e2'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '9284a29b-5092-446f-a8e9-0834d9b3a725' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Naruto Kayou ═══════════════════════════════════════════════════
update public.sets set name = 'Naruto Kayou Tier 1 (T1 series boxes)', series = 'Tier Series', is_active = true where id = '6bef6f11-5123-4167-808a-5e0c88adf9a8';
update public.sets set name = 'Naruto Kayou Tier 2 (T2 series, multiple waves)', series = 'Tier Series', is_active = true where id = 'bdae4ba2-81d7-4f95-be4a-af00e4973029';
update public.sets set name = 'Naruto Kayou Tier 3 (T3 series, multiple waves)', series = 'Tier Series', is_active = true where id = '6a53e856-9ffe-4a87-bf3d-2d05aff6a8af';
update public.sets set name = 'Naruto Kayou Tier 4 (T4 series, multiple waves)', series = 'Tier Series', is_active = true where id = '41aa7a9b-a039-4f1c-b4c4-03b87411d95f';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select 'd9b73009-60aa-4204-a692-5406abd7e4a8', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Naruto Kayou Heritage Collection', 'naruto-kayou-naruto-kayou-heritage-collection', 'Collection Series', '8529391c-3fe0-4a39-9c7b-5aca4366cc34'::uuid, null, null),
  ('Naruto Kayou Legacy Collection', 'naruto-kayou-naruto-kayou-legacy-collection', 'Collection Series', '8529391c-3fe0-4a39-9c7b-5aca4366cc34'::uuid, null, null)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = 'd9b73009-60aa-4204-a692-5406abd7e4a8' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;

-- ═══ Pokémon ═══════════════════════════════════════════════════
update public.sets set name = 'Base Set', series = 'Wizards Era', release_date = coalesce('1999-01-09', release_date), total_cards = coalesce(102, total_cards), is_active = true where id = 'ba9e1ed5-be76-4742-a83e-aaa303b96ed5';
update public.sets set name = 'Jungle', series = 'Wizards Era', release_date = coalesce('1999-06-16', release_date), total_cards = coalesce(64, total_cards), is_active = true where id = '5814532c-1614-4899-9dca-f8ae15a54786';
update public.sets set name = 'Fossil', series = 'Wizards Era', release_date = coalesce('1999-10-10', release_date), total_cards = coalesce(62, total_cards), is_active = true where id = 'b4f246d2-afee-48b1-9ec4-185549505ff1';
update public.sets set name = 'Base Set 2', series = 'Wizards Era', release_date = coalesce('2000-02-24', release_date), total_cards = coalesce(130, total_cards), is_active = true where id = 'f8ff639c-1b51-482e-8619-2d5190c3eb9e';
update public.sets set name = 'Team Rocket', series = 'Wizards Era', release_date = coalesce('2000-04-24', release_date), total_cards = coalesce(83, total_cards), is_active = true where id = '263cdad3-1bbb-4b81-a515-4ae77f7be7b8';
update public.sets set name = 'Gym Heroes', series = 'Wizards Era', release_date = coalesce('2000-08-14', release_date), total_cards = coalesce(132, total_cards), is_active = true where id = '958b6fdd-a897-4aa9-940f-8fd7165579f8';
update public.sets set name = 'Gym Challenge', series = 'Wizards Era', release_date = coalesce('2000-10-16', release_date), total_cards = coalesce(132, total_cards), is_active = true where id = '7d823859-e0a9-4e5b-8451-6d0564abdbbd';
update public.sets set name = 'Neo Genesis', series = 'Wizards Era', release_date = coalesce('2000-12-16', release_date), total_cards = coalesce(111, total_cards), is_active = true where id = '087686b3-119b-4e66-8c5b-6379a76d79eb';
update public.sets set name = 'Neo Discovery', series = 'Wizards Era', release_date = coalesce('2001-06-01', release_date), total_cards = coalesce(75, total_cards), is_active = true where id = 'f4fea31d-c6e4-4c1c-8cf6-dbdc226f96cd';
update public.sets set name = 'Neo Revelation', series = 'Wizards Era', release_date = coalesce('2001-09-21', release_date), total_cards = coalesce(66, total_cards), is_active = true where id = '2c548da6-69c7-4796-a001-0703b9a7434a';
update public.sets set name = 'Neo Destiny', series = 'Wizards Era', release_date = coalesce('2002-02-28', release_date), total_cards = coalesce(113, total_cards), is_active = true where id = '5d917f1a-1ee1-41a7-a5fe-ace7a8178498';
update public.sets set name = 'Expedition Base Set', series = 'Wizards Era', release_date = coalesce('2002-09-15', release_date), total_cards = coalesce(165, total_cards), is_active = true where id = '7cb14128-1b24-4377-965d-fc764289744b';
update public.sets set name = 'Aquapolis', series = 'Wizards Era', release_date = coalesce('2003-01-15', release_date), total_cards = coalesce(182, total_cards), is_active = true where id = '7da676cb-f8f8-4b60-b59d-95b973467df0';
update public.sets set name = 'Skyridge', series = 'Wizards Era', release_date = coalesce('2003-05-12', release_date), total_cards = coalesce(182, total_cards), is_active = true where id = 'b35d0d4a-2f90-44ae-939b-96bed745cac5';
update public.sets set name = 'EX Ruby & Sapphire', series = 'EX Series', release_date = coalesce('2003-07-18', release_date), total_cards = coalesce(109, total_cards), is_active = true where id = 'd9453958-0654-4a73-b0db-8f676c82de68';
update public.sets set name = 'EX Sandstorm', series = 'EX Series', release_date = coalesce('2003-09-18', release_date), total_cards = coalesce(100, total_cards), is_active = true where id = '3b0d4083-5772-4fcf-bdcb-807010c1dce8';
update public.sets set name = 'EX Dragon', series = 'EX Series', release_date = coalesce('2003-11-24', release_date), total_cards = coalesce(100, total_cards), is_active = true where id = '76430a90-a240-46b3-ab4f-ea45b2836b0a';
update public.sets set name = 'EX Team Magma vs Team Aqua', series = 'EX Series', release_date = coalesce('2004-03-15', release_date), total_cards = coalesce(97, total_cards), is_active = true where id = '4280cfa4-b536-42ae-bc43-ca1a117fbdfb';
update public.sets set name = 'EX Hidden Legends', series = 'EX Series', release_date = coalesce('2004-06-14', release_date), total_cards = coalesce(102, total_cards), is_active = true where id = 'f56ea31f-788f-437b-a764-2f39ee240b8a';
update public.sets set name = 'EX FireRed & LeafGreen', series = 'EX Series', release_date = coalesce('2004-08-30', release_date), total_cards = coalesce(116, total_cards), is_active = true where id = 'bd8acc25-fc5e-4709-9224-31770a836f93';
update public.sets set name = 'EX Team Rocket Returns', series = 'EX Series', release_date = coalesce('2004-11-08', release_date), total_cards = coalesce(111, total_cards), is_active = true where id = '8f3e08a4-d11a-49aa-a309-89ff6c47da3a';
update public.sets set name = 'EX Deoxys', series = 'EX Series', release_date = coalesce('2005-02-14', release_date), total_cards = coalesce(108, total_cards), is_active = true where id = 'ab937f2e-d432-4611-9a56-e04ba698a759';
update public.sets set name = 'EX Emerald', series = 'EX Series', release_date = coalesce('2005-05-09', release_date), total_cards = coalesce(107, total_cards), is_active = true where id = 'b0e94be6-4214-42dc-a480-5102b32d8b1b';
update public.sets set name = 'EX Unseen Forces', series = 'EX Series', release_date = coalesce('2005-08-22', release_date), total_cards = coalesce(145, total_cards), is_active = true where id = 'd65d4845-3668-4aad-a6cc-f79920999445';
update public.sets set name = 'EX Delta Species', series = 'EX Series', release_date = coalesce('2005-10-31', release_date), total_cards = coalesce(114, total_cards), is_active = true where id = 'd3137bc7-66d1-4dad-b38f-953a0fa4e638';
update public.sets set name = 'EX Legend Maker', series = 'EX Series', release_date = coalesce('2006-02-13', release_date), total_cards = coalesce(93, total_cards), is_active = true where id = 'c4084f58-5c4e-441a-aafc-95f61ecd51ff';
update public.sets set name = 'EX Holon Phantoms', series = 'EX Series', release_date = coalesce('2006-05-03', release_date), total_cards = coalesce(111, total_cards), is_active = true where id = 'dd597c18-b1f6-4055-af18-e0d4facdfdc0';
update public.sets set name = 'EX Crystal Guardians', series = 'EX Series', release_date = coalesce('2006-08-30', release_date), total_cards = coalesce(100, total_cards), is_active = true where id = '0e82d45c-3200-4b7a-8bb6-9cd8dd31e538';
update public.sets set name = 'EX Dragon Frontiers', series = 'EX Series', release_date = coalesce('2006-11-08', release_date), total_cards = coalesce(101, total_cards), is_active = true where id = '673a39d9-3a1e-4fe1-82a9-ee43599a3c70';
update public.sets set name = 'EX Power Keepers', series = 'EX Series', release_date = coalesce('2007-02-14', release_date), total_cards = coalesce(108, total_cards), is_active = true where id = '2662d08b-32ec-49b2-9e72-7387ced7c083';
update public.sets set name = 'Diamond & Pearl', series = 'Diamond & Pearl Series', release_date = coalesce('2007-05-23', release_date), total_cards = coalesce(130, total_cards), is_active = true where id = '5de27e6a-5218-42f5-b738-d21c5c5d1720';
update public.sets set name = 'Mysterious Treasures', series = 'Diamond & Pearl Series', release_date = coalesce('2007-08-22', release_date), total_cards = coalesce(124, total_cards), is_active = true where id = 'a6b09fba-13f2-47cb-9476-e1c7164c42fd';
update public.sets set name = 'Secret Wonders', series = 'Diamond & Pearl Series', release_date = coalesce('2007-11-07', release_date), total_cards = coalesce(132, total_cards), is_active = true where id = '55513368-90ad-4e28-8ec3-eb7d0d9bf2ff';
update public.sets set name = 'Great Encounters', series = 'Diamond & Pearl Series', release_date = coalesce('2008-02-13', release_date), total_cards = coalesce(106, total_cards), is_active = true where id = '2547f28d-47bc-4adf-a419-26e95761331d';
update public.sets set name = 'Majestic Dawn', series = 'Diamond & Pearl Series', release_date = coalesce('2008-05-21', release_date), total_cards = coalesce(100, total_cards), is_active = true where id = '0fd250a3-395e-4f46-b3b6-2b4f63851fae';
update public.sets set name = 'Legends Awakened', series = 'Diamond & Pearl Series', release_date = coalesce('2008-08-20', release_date), total_cards = coalesce(146, total_cards), is_active = true where id = '62bac602-eedf-45f9-a8e8-60a8461f19d5';
update public.sets set name = 'Stormfront', series = 'Diamond & Pearl Series', release_date = coalesce('2008-11-05', release_date), total_cards = coalesce(106, total_cards), is_active = true where id = 'e2b1c9cd-4964-42db-ae1c-5c341a73f368';
update public.sets set name = 'Platinum', series = 'Platinum Series', release_date = coalesce('2009-02-11', release_date), total_cards = coalesce(133, total_cards), is_active = true where id = 'c15db0b3-3b20-4bf6-843b-9b3bf2be1a42';
update public.sets set name = 'Rising Rivals', series = 'Platinum Series', release_date = coalesce('2009-05-16', release_date), total_cards = coalesce(120, total_cards), is_active = true where id = 'b66a6fcf-9e3b-484a-a561-af7e3ea749aa';
update public.sets set name = 'Supreme Victors', series = 'Platinum Series', release_date = coalesce('2009-08-19', release_date), total_cards = coalesce(153, total_cards), is_active = true where id = 'c94096a9-7a35-43d0-a029-1eb23dd82c20';
update public.sets set name = 'Arceus', series = 'Platinum Series', release_date = coalesce('2009-11-04', release_date), total_cards = coalesce(111, total_cards), is_active = true where id = 'bb10f5c7-244d-4884-8004-a52416909562';
update public.sets set name = 'HeartGold & SoulSilver', series = 'HeartGold & SoulSilver Series', release_date = coalesce('2010-02-10', release_date), total_cards = coalesce(124, total_cards), is_active = true where id = 'bc70c036-4110-4211-be77-d837bfe8470e';
update public.sets set name = 'Unleashed', series = 'HeartGold & SoulSilver Series', release_date = coalesce('2010-05-12', release_date), total_cards = coalesce(96, total_cards), is_active = true where id = 'e0840e7c-3f9d-480f-97a5-de1e4b4e4ca5';
update public.sets set name = 'Undaunted', series = 'HeartGold & SoulSilver Series', release_date = coalesce('2010-08-18', release_date), total_cards = coalesce(91, total_cards), is_active = true where id = '2a746425-8623-4121-8810-797535eb91e2';
update public.sets set name = 'Triumphant', series = 'HeartGold & SoulSilver Series', release_date = coalesce('2010-11-03', release_date), total_cards = coalesce(103, total_cards), is_active = true where id = 'f1e0ae71-821d-4769-8766-51e3f4aac944';
update public.sets set name = 'Call of Legends', series = 'HeartGold & SoulSilver Series', release_date = coalesce('2011-02-09', release_date), total_cards = coalesce(106, total_cards), is_active = true where id = 'b52df2f1-6c44-4c3e-9fb0-6918c15c8c3f';
update public.sets set name = 'Black & White', series = 'Black & White Series', release_date = coalesce('2011-04-25', release_date), total_cards = coalesce(115, total_cards), is_active = true where id = 'e9e4556a-53b4-4d25-b903-58dfc69125d3';
update public.sets set name = 'Emerging Powers', series = 'Black & White Series', release_date = coalesce('2011-08-31', release_date), total_cards = coalesce(98, total_cards), is_active = true where id = '762c82e3-7587-4ecd-9df7-d57c050ca10c';
update public.sets set name = 'Noble Victories', series = 'Black & White Series', release_date = coalesce('2011-11-16', release_date), total_cards = coalesce(102, total_cards), is_active = true where id = '298d83e5-390d-4700-93d3-a90a04d22ca7';
update public.sets set name = 'Next Destinies', series = 'Black & White Series', release_date = coalesce('2012-02-08', release_date), total_cards = coalesce(103, total_cards), is_active = true where id = '25e7d60a-88d8-4d70-b7a2-3fde8f387243';
update public.sets set name = 'Dark Explorers', series = 'Black & White Series', release_date = coalesce('2012-05-09', release_date), total_cards = coalesce(111, total_cards), is_active = true where id = 'a0d01a41-cfb1-4a07-be3a-fccbfd3fe502';
update public.sets set name = 'Dragons Exalted', series = 'Black & White Series', release_date = coalesce('2012-08-15', release_date), total_cards = coalesce(128, total_cards), is_active = true where id = '2c8e444f-7560-4b68-9a6b-5cee982cabd9';
update public.sets set name = 'Boundaries Crossed', series = 'Black & White Series', release_date = coalesce('2012-11-07', release_date), total_cards = coalesce(153, total_cards), is_active = true where id = '9dc686f2-8c29-4eb9-a567-d82cced3115e';
update public.sets set name = 'Plasma Storm', series = 'Black & White Series', release_date = coalesce('2013-02-06', release_date), total_cards = coalesce(138, total_cards), is_active = true where id = 'd328b77f-8d4e-434b-9f94-577060eb9d95';
update public.sets set name = 'Plasma Freeze', series = 'Black & White Series', release_date = coalesce('2013-05-08', release_date), total_cards = coalesce(122, total_cards), is_active = true where id = 'd954a273-c2bc-43e8-98d3-6b371a52338a';
update public.sets set name = 'Plasma Blast', series = 'Black & White Series', release_date = coalesce('2013-08-14', release_date), total_cards = coalesce(105, total_cards), is_active = true where id = '627fc5d8-42de-4e38-b3eb-32fa028fda0b';
update public.sets set name = 'Legendary Treasures', series = 'Black & White Series', release_date = coalesce('2013-11-06', release_date), total_cards = coalesce(140, total_cards), is_active = true where id = 'c045a3f8-0e14-4143-8a33-8cb2e34d4959';
update public.sets set name = 'XY', series = 'XY Series', release_date = coalesce('2014-02-05', release_date), total_cards = coalesce(146, total_cards), is_active = true where id = '7b4e1dc6-b0bd-4f52-9914-797b79e7f08d';
update public.sets set name = 'Flashfire', series = 'XY Series', release_date = coalesce('2014-05-07', release_date), total_cards = coalesce(109, total_cards), is_active = true where id = '3a3e2112-d343-4e2c-a065-7e1d6645cfb0';
update public.sets set name = 'Furious Fists', series = 'XY Series', release_date = coalesce('2014-08-13', release_date), total_cards = coalesce(113, total_cards), is_active = true where id = '113ad549-f2b8-464b-923f-464262dbc7ce';
update public.sets set name = 'Phantom Forces', series = 'XY Series', release_date = coalesce('2014-11-05', release_date), total_cards = coalesce(122, total_cards), is_active = true where id = '4a5c4555-517a-4bcd-9764-29cd7191e096';
update public.sets set name = 'Primal Clash', series = 'XY Series', release_date = coalesce('2015-02-04', release_date), total_cards = coalesce(164, total_cards), is_active = true where id = '58dde1e2-3498-49a3-a836-abb544619dbd';
update public.sets set name = 'Roaring Skies', series = 'XY Series', release_date = coalesce('2015-05-06', release_date), total_cards = coalesce(110, total_cards), is_active = true where id = '74cccbec-61fc-43b6-a165-1bd3a20577f5';
update public.sets set name = 'Ancient Origins', series = 'XY Series', release_date = coalesce('2015-08-12', release_date), total_cards = coalesce(100, total_cards), is_active = true where id = '777783b4-1df7-49fc-b680-1db6e00ef2f4';
update public.sets set name = 'BREAKthrough', series = 'XY Series', release_date = coalesce('2015-11-04', release_date), total_cards = coalesce(164, total_cards), is_active = true where id = 'a780829d-e021-4ec9-b211-038d334364f5';
update public.sets set name = 'BREAKpoint', series = 'XY Series', release_date = coalesce('2016-02-03', release_date), total_cards = coalesce(123, total_cards), is_active = true where id = '82b467a6-2633-4db4-84b8-c17e97d69cee';
update public.sets set name = 'Fates Collide', series = 'XY Series', release_date = coalesce('2016-05-02', release_date), total_cards = coalesce(125, total_cards), is_active = true where id = 'c57c5578-6914-4b20-b195-ed6c9dde4989';
update public.sets set name = 'Steam Siege', series = 'XY Series', release_date = coalesce('2016-08-03', release_date), total_cards = coalesce(116, total_cards), is_active = true where id = '5586fd9d-9070-45ee-86d6-9db5dba982e7';
update public.sets set name = 'Evolutions', series = 'XY Series', release_date = coalesce('2016-11-02', release_date), total_cards = coalesce(113, total_cards), is_active = true where id = '42a45aa5-354c-4f1b-8fb9-7686b2e31891';
update public.sets set name = 'Sun & Moon', series = 'Sun & Moon Series', release_date = coalesce('2017-02-03', release_date), total_cards = coalesce(163, total_cards), is_active = true where id = '7a50234e-6a51-4286-a9c6-f4f986688a93';
update public.sets set name = 'Guardians Rising', series = 'Sun & Moon Series', release_date = coalesce('2017-05-05', release_date), total_cards = coalesce(169, total_cards), is_active = true where id = 'ac7f67ca-3c6a-4484-befe-df886fd4ce37';
update public.sets set name = 'Burning Shadows', series = 'Sun & Moon Series', release_date = coalesce('2017-08-04', release_date), total_cards = coalesce(169, total_cards), is_active = true where id = '3bde23e2-f1af-4aa3-81b2-a3595294387c';
update public.sets set name = 'Shining Legends', series = 'Sun & Moon Series', release_date = coalesce('2017-10-06', release_date), total_cards = coalesce(81, total_cards), is_active = true where id = 'fb590359-bf3d-4f1a-8617-a90bfb46428c';
update public.sets set name = 'Crimson Invasion', series = 'Sun & Moon Series', release_date = coalesce('2017-11-03', release_date), total_cards = coalesce(124, total_cards), is_active = true where id = '2257d6fa-fa33-40d7-8cae-177ccc10943d';
update public.sets set name = 'Ultra Prism', series = 'Sun & Moon Series', release_date = coalesce('2018-02-02', release_date), total_cards = coalesce(173, total_cards), is_active = true where id = '55970172-530b-48b0-a304-cb1cf1007540';
update public.sets set name = 'Forbidden Light', series = 'Sun & Moon Series', release_date = coalesce('2018-05-04', release_date), total_cards = coalesce(146, total_cards), is_active = true where id = '9d991d1b-0eb2-4e68-9217-89cfa531e70d';
update public.sets set name = 'Celestial Storm', series = 'Sun & Moon Series', release_date = coalesce('2018-08-03', release_date), total_cards = coalesce(183, total_cards), is_active = true where id = 'd469689c-ef65-4b53-a55b-df841e5d9379';
update public.sets set name = 'Dragon Majesty', series = 'Sun & Moon Series', release_date = coalesce('2018-09-07', release_date), total_cards = coalesce(80, total_cards), is_active = true where id = 'b9a6bc0f-d80e-4071-b3d9-567b00fd1978';
update public.sets set name = 'Lost Thunder', series = 'Sun & Moon Series', release_date = coalesce('2018-11-02', release_date), total_cards = coalesce(236, total_cards), is_active = true where id = '8507dbea-4378-4a6c-84c8-b1b640bb97fd';
update public.sets set name = 'Team Up', series = 'Sun & Moon Series', release_date = coalesce('2019-02-01', release_date), total_cards = coalesce(196, total_cards), is_active = true where id = '1f635757-6303-420d-8285-56ff1b2e07fd';
update public.sets set name = 'Detective Pikachu', series = 'Sun & Moon Series', release_date = coalesce('2019-03-29', release_date), total_cards = coalesce(18, total_cards), is_active = true where id = 'c97ef0e7-ef2a-48c2-b61e-81dc85efedc5';
update public.sets set name = 'Unbroken Bonds', series = 'Sun & Moon Series', release_date = coalesce('2019-05-03', release_date), total_cards = coalesce(234, total_cards), is_active = true where id = 'ef3ce691-b081-4056-85fc-15301394f991';
update public.sets set name = 'Unified Minds', series = 'Sun & Moon Series', release_date = coalesce('2019-08-02', release_date), total_cards = coalesce(258, total_cards), is_active = true where id = '357d3747-c426-455d-b4d8-118a3eaf6eed';
update public.sets set name = 'Hidden Fates', series = 'Sun & Moon Series', release_date = coalesce('2019-08-23', release_date), total_cards = coalesce(163, total_cards), is_active = true where id = 'eedc3c86-3a07-47bf-975d-4ff1835e1f75';
update public.sets set name = 'Cosmic Eclipse', series = 'Sun & Moon Series', release_date = coalesce('2019-11-01', release_date), total_cards = coalesce(271, total_cards), is_active = true where id = 'ac067463-1f83-4df7-8dfe-29b1d4444fe6';
update public.sets set name = 'Sword & Shield', series = 'Sword & Shield Series', release_date = coalesce('2020-02-07', release_date), total_cards = coalesce(216, total_cards), is_active = true where id = 'cb23d3bb-7b82-44cd-ae56-a3a5c8a43fe4';
update public.sets set name = 'Rebel Clash', series = 'Sword & Shield Series', release_date = coalesce('2020-05-01', release_date), total_cards = coalesce(209, total_cards), is_active = true where id = 'a7b078d7-cc19-4e45-93ce-aa956f48c56d';
update public.sets set name = 'Darkness Ablaze', series = 'Sword & Shield Series', release_date = coalesce('2020-08-14', release_date), total_cards = coalesce(201, total_cards), is_active = true where id = 'f48c752f-e0e6-436c-9dea-4473eb3b4516';
update public.sets set name = 'Champion''s Path', series = 'Sword & Shield Series', release_date = coalesce('2020-09-25', release_date), total_cards = coalesce(80, total_cards), is_active = true where id = 'c03b3b92-2430-47a0-9430-677852f1816f';
update public.sets set name = 'Vivid Voltage', series = 'Sword & Shield Series', release_date = coalesce('2020-11-13', release_date), total_cards = coalesce(203, total_cards), is_active = true where id = 'da12db4b-a2b4-48d1-963a-df40731ccc2f';
update public.sets set name = 'Shining Fates', series = 'Sword & Shield Series', release_date = coalesce('2021-02-19', release_date), total_cards = coalesce(195, total_cards), is_active = true where id = 'b7aad9fb-6257-41b9-b1ca-12cb32eed0fa';
update public.sets set name = 'Battle Styles', series = 'Sword & Shield Series', release_date = coalesce('2021-03-19', release_date), total_cards = coalesce(183, total_cards), is_active = true where id = '07c67ac3-d932-4cdc-9233-6e476db1632a';
update public.sets set name = 'Chilling Reign', series = 'Sword & Shield Series', release_date = coalesce('2021-06-18', release_date), total_cards = coalesce(233, total_cards), is_active = true where id = 'cfee495e-b7bd-4022-ae38-d69cc9e3b05a';
update public.sets set name = 'Evolving Skies', series = 'Sword & Shield Series', release_date = coalesce('2021-08-27', release_date), total_cards = coalesce(237, total_cards), is_active = true where id = '851358ad-563f-4652-a5bf-4a8dcb7b88f3';
update public.sets set name = 'Celebrations', series = 'Sword & Shield Series', release_date = coalesce('2021-10-08', release_date), total_cards = coalesce(50, total_cards), is_active = true where id = '95aa9b90-32d8-43d2-84bf-e9794f5785f7';
update public.sets set name = 'Fusion Strike', series = 'Sword & Shield Series', release_date = coalesce('2021-11-12', release_date), total_cards = coalesce(284, total_cards), is_active = true where id = 'fe8fa647-6ab9-4ea0-aa7b-d66132912876';
update public.sets set name = 'Brilliant Stars', series = 'Sword & Shield Series', release_date = coalesce('2022-02-25', release_date), total_cards = coalesce(216, total_cards), is_active = true where id = '33f77da5-c590-45c6-b780-9a4ea571e25b';
update public.sets set name = 'Astral Radiance', series = 'Sword & Shield Series', release_date = coalesce('2022-05-27', release_date), total_cards = coalesce(246, total_cards), is_active = true where id = '21ff90c1-b18c-43ec-918c-52d03903cf0f';
update public.sets set name = 'Pokémon GO', series = 'Sword & Shield Series', release_date = coalesce('2022-07-01', release_date), total_cards = coalesce(88, total_cards), is_active = true where id = '7f13b3a8-a5a6-4ccd-9124-b2f26ac0eee0';
update public.sets set name = 'Lost Origin', series = 'Sword & Shield Series', release_date = coalesce('2022-09-09', release_date), total_cards = coalesce(247, total_cards), is_active = true where id = '660e283a-ce27-41ed-8fe6-42e26b48e0eb';
update public.sets set name = 'Silver Tempest', series = 'Sword & Shield Series', release_date = coalesce('2022-11-11', release_date), total_cards = coalesce(245, total_cards), is_active = true where id = 'd583121c-cb68-45f0-83d8-6f4873f37a1c';
update public.sets set name = 'Crown Zenith', series = 'Sword & Shield Series', release_date = coalesce('2023-01-20', release_date), total_cards = coalesce(230, total_cards), is_active = true where id = '5d5c897b-1cf4-4b8d-8c5e-ac080de82a29';
update public.sets set name = 'Scarlet & Violet', series = 'Scarlet & Violet Series', release_date = coalesce('2023-03-31', release_date), total_cards = coalesce(258, total_cards), is_active = true where id = '3e92b591-42ff-46d6-ad11-7443c2b77855';
update public.sets set name = 'Paldea Evolved', series = 'Scarlet & Violet Series', release_date = coalesce('2023-06-09', release_date), total_cards = coalesce(279, total_cards), is_active = true where id = 'c5b6eb5a-f8fe-462e-94a6-993e8b0c9f87';
update public.sets set name = 'Obsidian Flames', series = 'Scarlet & Violet Series', release_date = coalesce('2023-08-11', release_date), total_cards = coalesce(230, total_cards), is_active = true where id = 'bd59ee08-61fe-4779-aa56-91b4e5d4a1f8';
update public.sets set name = '151', series = 'Scarlet & Violet Series', release_date = coalesce('2023-09-22', release_date), total_cards = coalesce(207, total_cards), is_active = true where id = '1f603a46-fa61-49a1-b364-e41ea52f0c68';
update public.sets set name = 'Paradox Rift', series = 'Scarlet & Violet Series', release_date = coalesce('2023-11-03', release_date), total_cards = coalesce(266, total_cards), is_active = true where id = '80e6bb0d-0dea-42bb-9216-36d68a214a5f';
update public.sets set name = 'Paldean Fates', series = 'Scarlet & Violet Series', release_date = coalesce('2024-01-26', release_date), total_cards = coalesce(245, total_cards), is_active = true where id = '5c38d7c0-f9e1-498f-9d2a-d65bb2d46d4a';
update public.sets set name = 'Temporal Forces', series = 'Scarlet & Violet Series', release_date = coalesce('2024-03-22', release_date), total_cards = coalesce(218, total_cards), is_active = true where id = 'ec5f1da1-1afe-42d0-b045-f643cbd4be71';
update public.sets set name = 'Twilight Masquerade', series = 'Scarlet & Violet Series', release_date = coalesce('2024-05-24', release_date), total_cards = coalesce(226, total_cards), is_active = true where id = 'f50c5b86-b939-49d7-b8e8-9f03dd53f6c2';
update public.sets set name = 'Shrouded Fable', series = 'Scarlet & Violet Series', release_date = coalesce('2024-08-02', release_date), total_cards = coalesce(99, total_cards), is_active = true where id = '78a84287-bcfa-417e-a714-0dce45f5a8f9';
update public.sets set name = 'Stellar Crown', series = 'Scarlet & Violet Series', release_date = coalesce('2024-09-13', release_date), total_cards = coalesce(175, total_cards), is_active = true where id = 'fc568564-2e11-44dd-8a0f-7fe99cbd5638';
update public.sets set name = 'Surging Sparks', series = 'Scarlet & Violet Series', release_date = coalesce('2024-11-08', release_date), total_cards = coalesce(252, total_cards), is_active = true where id = '69da9ee3-6d58-4193-be36-8880e5fbd88d';
update public.sets set name = 'Prismatic Evolutions', series = 'Scarlet & Violet Series', release_date = coalesce('2025-01-17', release_date), total_cards = coalesce(180, total_cards), is_active = true where id = '1c1074fb-e0ba-4b14-b5ae-c8157f72722f';
update public.sets set name = 'Journey Together', series = 'Scarlet & Violet Series', release_date = coalesce('2025-03-28', release_date), total_cards = coalesce(190, total_cards), is_active = true where id = 'bafda15c-d232-464b-bc16-3a8e12506ce7';
update public.sets set name = 'Destined Rivals', series = 'Scarlet & Violet Series', release_date = coalesce('2025-05-30', release_date), total_cards = coalesce(244, total_cards), is_active = true where id = '786525ac-a288-4972-9b9b-a7087c1e2087';
update public.sets set name = 'Black Bolt', series = 'Scarlet & Violet Series', release_date = coalesce('2025-07-18', release_date), total_cards = coalesce(172, total_cards), is_active = true where id = '7a345a84-85fc-4c1c-a647-7b9f98a142ea';
update public.sets set name = 'White Flare', series = 'Scarlet & Violet Series', release_date = coalesce('2025-07-18', release_date), total_cards = coalesce(173, total_cards), is_active = true where id = '0e359d69-ed38-456f-bf56-755a48c4fdd0';
update public.sets set name = 'Wizards Black Star Promos', series = 'Black Star Promos', release_date = coalesce('1999-07-01', release_date), total_cards = coalesce(53, total_cards), is_active = true where id = '31b12d48-fdf9-4d7d-98de-d2556fea49d2';
update public.sets set name = 'Nintendo Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2003-10-01', release_date), total_cards = coalesce(40, total_cards), is_active = true where id = '265e5d0b-0951-4527-a64f-aaeb0899589e';
update public.sets set name = 'DP Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2007-05-01', release_date), total_cards = coalesce(56, total_cards), is_active = true where id = 'f2972ee7-8c4e-4bdc-828e-75ac24ca93e5';
update public.sets set name = 'HGSS Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2010-02-01', release_date), total_cards = coalesce(25, total_cards), is_active = true where id = '62e28ca3-ed52-4599-bd75-223ee3c6238b';
update public.sets set name = 'BW Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2011-03-01', release_date), total_cards = coalesce(101, total_cards), is_active = true where id = 'e5227dd0-b6aa-4263-a010-7c62c25b4450';
update public.sets set name = 'XY Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2013-10-12', release_date), total_cards = coalesce(211, total_cards), is_active = true where id = '8b0c4ebf-52c9-45b5-b1d2-558e291619ab';
update public.sets set name = 'SM Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2016-11-18', release_date), total_cards = coalesce(248, total_cards), is_active = true where id = '1317d1ec-6418-4a30-8dbc-52eb615ce5e2';
update public.sets set name = 'SWSH Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2019-11-15', release_date), total_cards = coalesce(307, total_cards), is_active = true where id = '792ea589-af63-4aba-9651-b489a23a73c6';
update public.sets set name = 'SVP Black Star Promos', series = 'Black Star Promos', release_date = coalesce('2023-01-01', release_date), total_cards = coalesce(226, total_cards), is_active = true where id = 'dae915d7-8e93-4926-b144-d4595431d9f3';
update public.sets set name = 'McDonald''s Collection 2011', series = 'McDonald''s', release_date = coalesce('2011-06-17', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = 'fca7affc-195e-4b19-b94a-b400b7511f23';
update public.sets set name = 'McDonald''s Collection 2012', series = 'McDonald''s', release_date = coalesce('2012-06-15', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = '79e52d8f-d390-4774-8614-de54d50cc20b';
update public.sets set name = 'McDonald''s Collection 2014', series = 'McDonald''s', release_date = coalesce('2014-05-23', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = '3d03711d-ae92-485f-aec3-b15a1f880961';
update public.sets set name = 'McDonald''s Collection 2015', series = 'McDonald''s', release_date = coalesce('2015-11-27', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = '611e423d-f574-49cc-8d38-dd4a1bd9a898';
update public.sets set name = 'McDonald''s Collection 2016', series = 'McDonald''s', release_date = coalesce('2016-08-20', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = '030d09eb-f42a-4bec-a663-c7a21b5ac56f';
update public.sets set name = 'McDonald''s Collection 2017', series = 'McDonald''s', release_date = coalesce('2017-08-03', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = 'b45f7242-c937-42d4-a40d-a2440bd6a248';
update public.sets set name = 'McDonald''s Collection 2018', series = 'McDonald''s', release_date = coalesce('2018-10-16', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = 'bad04cdf-c932-4ebc-ac38-09091c78f786';
update public.sets set name = 'McDonald''s Collection 2019', series = 'McDonald''s', release_date = coalesce('2019-10-15', release_date), total_cards = coalesce(12, total_cards), is_active = true where id = 'bd8a647e-24ee-4536-a527-20d4c60a1115';
update public.sets set name = 'McDonald''s Collection 2021', series = 'McDonald''s', release_date = coalesce('2021-02-09', release_date), total_cards = coalesce(25, total_cards), is_active = true where id = '3dd4bca2-85aa-4a04-bf5d-253d3d80d9a5';
update public.sets set name = 'McDonald''s Collection 2022', series = 'McDonald''s', release_date = coalesce('2022-08-03', release_date), total_cards = coalesce(15, total_cards), is_active = true where id = '412e9b10-fd4e-4cea-b96d-35e6c76848b5';
update public.sets set name = 'McDonald''s Collection 2023', series = 'McDonald''s', release_date = coalesce('2023-07-27', release_date), total_cards = coalesce(15, total_cards), is_active = true where id = 'a207a851-c0d5-4b89-9104-127056103883';
update public.sets set name = 'McDonald''s Collection 2024', series = 'McDonald''s', release_date = coalesce('2024-12-04', release_date), total_cards = coalesce(15, total_cards), is_active = true where id = 'b4b4268e-d1bb-4b84-983d-0b56082e9537';
update public.sets set name = 'POP Series 1', series = 'POP Series', release_date = coalesce('2004-09-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = '8777dd9b-9269-49af-a779-1df3353b9796';
update public.sets set name = 'POP Series 2', series = 'POP Series', release_date = coalesce('2005-08-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = 'ab566534-7156-4ad2-8d21-24498a7468c6';
update public.sets set name = 'POP Series 3', series = 'POP Series', release_date = coalesce('2006-04-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = '4d941fde-6658-4d6f-8da2-6738f64b36c2';
update public.sets set name = 'POP Series 4', series = 'POP Series', release_date = coalesce('2006-08-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = 'c5af1103-5890-4884-81b9-dab2349aece8';
update public.sets set name = 'POP Series 5', series = 'POP Series', release_date = coalesce('2007-03-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = 'd02dafbd-6d38-463b-948e-148f136811f6';
update public.sets set name = 'POP Series 6', series = 'POP Series', release_date = coalesce('2007-09-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = 'b73f22e4-41c7-4704-84ad-d954a7f5c939';
update public.sets set name = 'POP Series 7', series = 'POP Series', release_date = coalesce('2008-03-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = 'e4e96bbf-3991-4ae7-8fbd-d30e989bf0a5';
update public.sets set name = 'POP Series 8', series = 'POP Series', release_date = coalesce('2008-09-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = '96a9fec7-f8f9-494e-a0a0-8f222f6e0e63';
update public.sets set name = 'POP Series 9', series = 'POP Series', release_date = coalesce('2009-03-01', release_date), total_cards = coalesce(17, total_cards), is_active = true where id = '0de3122c-77f3-425e-a151-2a77088db800';
update public.sets set name = 'EX Trainer Kit: Latias & Latios', series = 'Trainer Kits', release_date = coalesce('2004-06-01', release_date), total_cards = coalesce(20, total_cards), is_active = true where id = 'ae80bb99-fe79-48e3-abac-1b85459029c2';
update public.sets set name = 'XY Trainer Kit: Sylveon & Noivern', series = 'Trainer Kits', release_date = coalesce('2014-03-01', release_date), total_cards = coalesce(60, total_cards), is_active = true where id = '042ee78c-f2e7-46e4-ae38-5d3a0fc0af1b';
update public.sets set name = 'SM Trainer Kit: Lycanroc & Alolan Raichu', series = 'Trainer Kits', release_date = coalesce('2017-04-01', release_date), total_cards = coalesce(60, total_cards), is_active = true where id = 'f80462fb-806c-411f-8e68-d3021c91ca3c';
update public.sets set name = 'Prize Pack Series One', series = 'Prize Pack Series', release_date = coalesce('2022-11-09', release_date), total_cards = coalesce(170, total_cards), is_active = true where id = 'a4394880-b286-466f-a0fc-93e3ab994e2c';
update public.sets set name = 'Prize Pack Series Two', series = 'Prize Pack Series', release_date = coalesce('2023-02-14', release_date), total_cards = coalesce(154, total_cards), is_active = true where id = '488cd7cf-70a9-4336-9bb9-bd271317e2a6';
update public.sets set name = 'Prize Pack Series Three', series = 'Prize Pack Series', release_date = coalesce('2023-08-14', release_date), total_cards = coalesce(163, total_cards), is_active = true where id = 'a7325c24-7788-4678-b02f-16445c30fae5';
update public.sets set name = 'World Championship Decks 2018', series = 'World Championship', release_date = coalesce('2018-11-14', release_date), is_active = true where id = 'a054fb9e-1f9d-4030-b310-71b63aa2916e';
update public.sets set name = 'World Championship Decks 2004', series = 'World Championship', is_active = true where id = 'a3e94092-c7ea-49c9-bfb8-140d0d7e37a2';
update public.sets set name = 'World Championship Decks 2005', series = 'World Championship', is_active = true where id = '18ed8cd3-3c22-4100-ae53-e3991e29a1e5';
update public.sets set name = 'World Championship Decks 2006', series = 'World Championship', is_active = true where id = 'a5102d6c-b99f-47dc-b069-3ef2d0c36d0c';
update public.sets set name = 'World Championship Decks 2007', series = 'World Championship', is_active = true where id = 'db52b268-3b40-4184-8707-a980cc194fcf';
update public.sets set name = 'World Championship Decks 2008', series = 'World Championship', is_active = true where id = 'f68396dd-79fa-48c4-9042-b5e54ef27b80';
update public.sets set name = 'World Championship Decks 2009', series = 'World Championship', is_active = true where id = '29ff8fc2-793d-4420-809b-98be9f6f5495';
update public.sets set name = 'World Championship Decks 2010', series = 'World Championship', is_active = true where id = '6251a553-e385-449c-8862-858f0144ab4b';
update public.sets set name = 'World Championship Decks 2011', series = 'World Championship', is_active = true where id = 'e5e9ca38-bd09-4803-a16a-69a517defda3';
update public.sets set name = 'World Championship Decks 2012', series = 'World Championship', is_active = true where id = 'f5b2a370-3b41-4f66-a200-04396bb8b73f';
update public.sets set name = 'World Championship Decks 2013', series = 'World Championship', is_active = true where id = '69596942-ffb9-4585-bdb5-8660f610b65f';
update public.sets set name = 'World Championship Decks 2014', series = 'World Championship', is_active = true where id = '1306a02e-90c6-4fef-a7e3-13f2b25c8e5e';
update public.sets set name = 'World Championship Decks 2015', series = 'World Championship', is_active = true where id = '243c1065-d6a6-4903-bf80-d5dc7d957deb';
update public.sets set name = 'World Championship Decks 2016', series = 'World Championship', is_active = true where id = '4e4dc316-a2ee-45d4-aa0e-7fc49e7f6d1f';
update public.sets set name = 'World Championship Decks 2017', series = 'World Championship', is_active = true where id = '691e0a8d-4766-484f-bd7c-d9c1e07ff00f';
update public.sets set name = 'World Championship Decks 2019', series = 'World Championship', is_active = true where id = '74543bcb-e3b7-440e-bc92-f8c03daaff92';
update public.sets set name = 'World Championship Decks 2022', series = 'World Championship', is_active = true where id = '5870f66e-6f8a-4423-8341-0183fde71044';
update public.sets set name = 'World Championship Decks 2023', series = 'World Championship', is_active = true where id = 'c5f605cd-3b5a-4241-818a-15a5be26163b';
update public.sets set name = 'World Championship Decks 2024', series = 'World Championship', is_active = true where id = 'e2b7bdf3-1f6a-4712-8a2f-4b511e5c34dc';
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '15fb92ea-ef40-41c4-bf01-86c602a6a26e', v.name, v.slug, v.series, v.manufacturer_id::uuid, v.release_date::date, v.total_cards::int, true
from (values
  ('Legendary Collection', 'pokemon-legendary-collection', 'Wizards Era', '610cd6b9-1773-4fae-8962-4fda304868d0'::uuid, '2002-05-24', 110),
  ('Dragon Vault', 'pokemon-dragon-vault', 'Black & White Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2012-10-05', 21),
  ('Kalos Starter Set', 'pokemon-kalos-starter-set', 'XY Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2013-11-08', 39),
  ('Double Crisis', 'pokemon-double-crisis', 'XY Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2015-03-25', 34),
  ('Generations', 'pokemon-generations', 'XY Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2016-02-22', 115),
  ('Scarlet & Violet Energies', 'pokemon-scarlet-and-violet-energies', 'Scarlet & Violet Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2023-03-31', 8),
  ('Mega Evolution', 'pokemon-mega-evolution', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2025-09-26', 188),
  ('Phantasmal Flames', 'pokemon-phantasmal-flames', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2025-11-14', 130),
  ('Ascended Heroes', 'pokemon-ascended-heroes', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-01-30', 295),
  ('Perfect Order', 'pokemon-perfect-order', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-03-27', 124),
  ('Chaos Rising', 'pokemon-chaos-rising', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-05-22', 122),
  ('Pitch Black', 'pokemon-pitch-black', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-07-17', 120),
  ('30th Celebration', 'pokemon-30th-celebration', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-09-16', null),
  ('Delta Reign', 'pokemon-delta-reign', 'Mega Evolution Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-11-06', 140),
  ('MEP Black Star Promos', 'pokemon-mep-black-star-promos', 'Black Star Promos', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2025-09-01', null),
  ('EX Trainer Kit 2: Plusle & Minun', 'pokemon-ex-trainer-kit-2-plusle-and-minun', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2006-03-01', 24),
  ('DP Trainer Kit: Manaphy & Lucario', 'pokemon-dp-trainer-kit-manaphy-and-lucario', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2007-09-01', 23),
  ('HS Trainer Kit: Gyarados & Raichu', 'pokemon-hs-trainer-kit-gyarados-and-raichu', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2010-05-01', 60),
  ('BW Trainer Kit: Excadrill & Zoroark', 'pokemon-bw-trainer-kit-excadrill-and-zoroark', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2011-09-01', 60),
  ('XY Trainer Kit: Bisharp & Wigglytuff', 'pokemon-xy-trainer-kit-bisharp-and-wigglytuff', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2014-11-01', 60),
  ('XY Trainer Kit: Latias & Latios', 'pokemon-xy-trainer-kit-latias-and-latios', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2015-04-29', 60),
  ('XY Trainer Kit: Pikachu Libre & Suicune', 'pokemon-xy-trainer-kit-pikachu-libre-and-suicune', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2016-04-01', 60),
  ('SM Trainer Kit: Alolan Sandslash & Alolan Ninetales', 'pokemon-sm-trainer-kit-alolan-sandslash-and-alolan-ninetales', 'Trainer Kits', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2018-06-01', 60),
  ('Prize Pack Series Four', 'pokemon-prize-pack-series-four', 'Prize Pack Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2024-02-14', 86),
  ('Prize Pack Series Five', 'pokemon-prize-pack-series-five', 'Prize Pack Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2024-08-14', 86),
  ('Prize Pack Series Six', 'pokemon-prize-pack-series-six', 'Prize Pack Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2025-02-14', 94),
  ('Prize Pack Series Seven', 'pokemon-prize-pack-series-seven', 'Prize Pack Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2025-08-14', 96),
  ('Prize Pack Series Eight', 'pokemon-prize-pack-series-eight', 'Prize Pack Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-01-01', 90),
  ('Prize Pack Series Nine', 'pokemon-prize-pack-series-nine', 'Prize Pack Series', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2026-07-01', 80),
  ('World Championship Decks 2025', 'pokemon-world-championship-decks-2025', 'World Championship', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, null, null),
  ('Southern Islands', 'pokemon-southern-islands', 'Other', '610cd6b9-1773-4fae-8962-4fda304868d0'::uuid, '2001-07-31', 18),
  ('Pokémon Rumble', 'pokemon-pokemon-rumble', 'Other', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2009-12-02', 16),
  ('Pokémon Futsal Collection', 'pokemon-pokemon-futsal-collection', 'Other', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2020-09-01', 5),
  ('Trick or Trade BOOster Bundle 2022', 'pokemon-trick-or-trade-booster-bundle-2022', 'Other', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2022-09-01', 30),
  ('Trick or Trade BOOster Bundle 2023', 'pokemon-trick-or-trade-booster-bundle-2023', 'Other', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2023-09-01', 30),
  ('Trick or Trade BOOster Bundle 2024', 'pokemon-trick-or-trade-booster-bundle-2024', 'Other', 'cc7878ae-ab51-4c98-b927-f12d29290961'::uuid, '2024-09-01', 30),
  ('Best of Game', 'pokemon-best-of-game', 'Other', '610cd6b9-1773-4fae-8962-4fda304868d0'::uuid, null, 9)
) as v(name, slug, series, manufacturer_id, release_date, total_cards)
where not exists (
  select 1 from public.sets x where x.category_id = '15fb92ea-ef40-41c4-bf01-86c602a6a26e' and lower(x.name) = lower(v.name)
)
on conflict (slug) do nothing;
