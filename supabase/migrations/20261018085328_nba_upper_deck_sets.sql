-- NBA → Upper Deck: complete the set picker and tidy its groupings.
--
-- A seller trying to list a 2003-04 Upper Deck LeBron James Freshman Season
-- Collection card found no set for it: the NBA → Upper Deck list stopped at
-- the flagship, Collector's Choice, UD3, MVP, Victory, the SP lines and a few
-- premium brands, and was missing most of what Upper Deck actually released
-- while it held the NBA licence (1991-92 to 2009-10): every Series 2, SP /
-- SP Championship, SE, Encore, Ionix, Ovation, Hardcourt, HoloGrFX, Gold
-- Reserve, Retro, Ultimate Victory, Pros & Prospects, Slam, Flight Team,
-- Honor Roll, Inspirations, Sweet Shot, Playmakers, Championship Drive,
-- Finite, Generations, Glass, Legends, Rookie Exclusives, Standing O, Triple
-- Dimensions, Top Prospects, the three 2003-04 LeBron James sets, All-Star
-- Lineup, Pro Sigs, R-Class, Trilogy, ESPN, Reflections, Rookie Debut,
-- Chronology, First Edition, Premier, SP Rookie Edition / Rookie Threads,
-- Lineage, Radiance, Draft Edition, Greats of the Game and the 2009-10
-- products. Compiled 2026-10-18 from Beckett, TCDB and Upper Deck's product
-- archive; card counts and release dates are filled in only where a source
-- gave them.
--
-- Also:
--   * `series` is what the Set picker groups by (CardHierarchySelector), and
--     the Upper Deck rows carried price-tier labels ("Upper Deck Budget",
--     "Upper Deck Premium", "Upper Deck Chrome" for UD3 …) rather than product
--     lines. Every row is relabelled with its product line so the groups read
--     as Collector's Choice / UD3 / SP Authentic / SPx / … The Fleer Tradition
--     and Ultra rows filed under Upper Deck keep their ids and get a "Fleer"
--     group (Fleer was independent until Upper Deck bought it in 2005).
--   * 2003-04 to 2008-09 the flagship was a single series (342 / 230 / … / 266
--     cards), so those "Upper Deck Series 1" rows are renamed "Upper Deck
--     Basketball". Ids are untouched, so vault_items.set_id stays valid.
--
-- Rows are plain data — update by slug, insert ON CONFLICT (slug) DO NOTHING
-- behind a same-name guard — so the file is idempotent.

-- ── 1. Group labels: product line, not price tier ───────────────────────────
update public.sets set series = 'Upper Deck'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f'
   and series in ('Upper Deck Flagship', 'Series 1');
update public.sets set series = 'Collector''s Choice'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Budget';
update public.sets set series = 'UD3'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Chrome';
update public.sets set series = 'MVP'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Mid-Range' and name like '% MVP %';
update public.sets set series = 'Victory'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Mid-Range' and name like '% Victory %';
update public.sets set series = 'Fleer'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Mid-Range' and name like '%Fleer%';
update public.sets set series = 'SP Authentic'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Premium' and name like '% SP Authentic %';
update public.sets set series = 'SPx'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Premium' and name like '% SPx %';
update public.sets set series = 'SP Game Used'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Premium' and name like '% SP Game Used %';
update public.sets set series = 'UD Black'
 where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f' and series = 'Upper Deck Premium' and name like '% UD Black %';

-- ── 2. Single-series flagship years ─────────────────────────────────────────
update public.sets s
   set name = replace(s.name, 'Upper Deck Series 1 Basketball', 'Upper Deck Basketball')
 where s.category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and s.manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f'
   and s.slug in ('2003-04-ud-series-1-basketball', '2004-05-ud-series-1-basketball', '2005-06-ud-series-1-basketball',
                  '2006-07-ud-series-1-basketball', '2007-08-ud-series-1-basketball', '2008-09-ud-series-1-basketball')
   and s.name like '% Upper Deck Series 1 Basketball'
   and not exists (select 1 from public.sets x where x.category_id = s.category_id
                     and x.name = replace(s.name, 'Upper Deck Series 1 Basketball', 'Upper Deck Basketball'));

-- ── 3. Missing sets ─────────────────────────────────────────────────────────
insert into public.sets (category_id, name, slug, series, manufacturer_id, release_date, total_cards, is_active)
select '1def0f95-d395-4443-b8da-8e895ed4d05f', v.name, v.slug, v.series, '82c275d0-9291-4eb4-923d-4941212b243f', v.release_date::date, v.total_cards::int, true
from (values
  ('1991-92 Upper Deck Series 2 Basketball', 'ud-1991-92-upper-deck-series-2', 'Upper Deck', null, 100),
  ('1992-93 Upper Deck Series 2 Basketball', 'ud-1992-93-upper-deck-series-2', 'Upper Deck', null, null),
  ('1993-94 Upper Deck Series 2 Basketball', 'ud-1993-94-upper-deck-series-2', 'Upper Deck', null, null),
  ('1994-95 Upper Deck Series 2 Basketball', 'ud-1994-95-upper-deck-series-2', 'Upper Deck', null, null),
  ('1995-96 Upper Deck Series 2 Basketball', 'ud-1995-96-upper-deck-series-2', 'Upper Deck', null, null),
  ('1996-97 Upper Deck Series 2 Basketball', 'ud-1996-97-upper-deck-series-2', 'Upper Deck', null, null),
  ('1997-98 Upper Deck Series 2 Basketball', 'ud-1997-98-upper-deck-series-2', 'Upper Deck', null, null),
  ('1998-99 Upper Deck Series 2 Basketball', 'ud-1998-99-upper-deck-series-2', 'Upper Deck', null, null),
  ('1999-00 Upper Deck Series 2 Basketball', 'ud-1999-00-upper-deck-series-2', 'Upper Deck', null, null),
  ('2000-01 Upper Deck Series 2 Basketball', 'ud-2000-01-upper-deck-series-2', 'Upper Deck', null, null),
  ('2001-02 Upper Deck Series 2 Basketball', 'ud-2001-02-upper-deck-series-2', 'Upper Deck', null, null),
  ('2002-03 Upper Deck Series 2 Basketball', 'ud-2002-03-upper-deck-series-2', 'Upper Deck', null, 220),
  ('2009-10 Upper Deck Basketball', 'ud-2009-10-upper-deck', 'Upper Deck', null, null),
  ('2007-08 Upper Deck First Edition Basketball', 'ud-2007-08-upper-deck-first-edition', 'First Edition', '2007-10-19', 230),
  ('2008-09 Upper Deck First Edition Basketball', 'ud-2008-09-upper-deck-first-edition', 'First Edition', '2008-09-29', 266),
  ('2009-10 Upper Deck First Edition Basketball', 'ud-2009-10-upper-deck-first-edition', 'First Edition', null, null),
  ('2009-10 Upper Deck Draft Edition Basketball', 'ud-2009-10-upper-deck-draft-edition', 'Draft Edition', null, null),
  ('2009-10 Upper Deck Greats of the Game Basketball', 'ud-2009-10-upper-deck-greats-of-the-game', 'Greats of the Game', null, null),
  ('1993-94 SP Basketball', 'ud-1993-94-sp', 'SP', null, null),
  ('1994-95 SP Basketball', 'ud-1994-95-sp', 'SP', null, 165),
  ('1995-96 SP Basketball', 'ud-1995-96-sp', 'SP', null, null),
  ('1996-97 SP Basketball', 'ud-1996-97-sp', 'SP', null, null),
  ('1994-95 SP Championship Basketball', 'ud-1994-95-sp-championship', 'SP Championship', null, 135),
  ('1995-96 SP Championship Basketball', 'ud-1995-96-sp-championship', 'SP Championship', null, null),
  ('2004-05 SP Signature Edition Basketball', 'ud-2004-05-sp-signature-edition', 'SP Signature Edition', null, 242),
  ('2005-06 SP Signature Edition Basketball', 'ud-2005-06-sp-signature-edition', 'SP Signature Edition', null, null),
  ('2006-07 SP Signature Edition Basketball', 'ud-2006-07-sp-signature-edition', 'SP Signature Edition', null, null),
  ('2009-10 SP Signature Edition Basketball', 'ud-2009-10-sp-signature-edition', 'SP Signature Edition', '2009-09-15', null),
  ('2007-08 SP Rookie Edition Basketball', 'ud-2007-08-sp-rookie-edition', 'SP Rookie Edition', null, null),
  ('2008-09 SP Rookie Threads Basketball', 'ud-2008-09-sp-rookie-threads', 'SP Rookie Threads', null, null),
  ('2009-10 SP Game Used Basketball', 'ud-2009-10-sp-game-used', 'SP Game Used', '2009-08-28', null),
  ('2009-10 Exquisite Basketball', 'ud-2009-10-exquisite', 'Exquisite', '2009-09-30', null),
  ('1993-94 Upper Deck SE Basketball', 'ud-1993-94-upper-deck-se', 'SE', null, null),
  ('1994-95 Upper Deck SE Basketball', 'ud-1994-95-upper-deck-se', 'SE', null, null),
  ('1998-99 Black Diamond Basketball', 'ud-1998-99-black-diamond', 'Black Diamond', null, null),
  ('1999-00 Black Diamond Basketball', 'ud-1999-00-black-diamond', 'Black Diamond', null, null),
  ('2000-01 Black Diamond Basketball', 'ud-2000-01-black-diamond', 'Black Diamond', null, null),
  ('2003-04 Black Diamond Basketball', 'ud-2003-04-black-diamond', 'Black Diamond', null, null),
  ('2004-05 Black Diamond Basketball', 'ud-2004-05-black-diamond', 'Black Diamond', null, null),
  ('1998-99 Upper Deck Encore Basketball', 'ud-1998-99-upper-deck-encore', 'Encore', null, 80),
  ('1999-00 Upper Deck Encore Basketball', 'ud-1999-00-upper-deck-encore', 'Encore', null, null),
  ('2000-01 Upper Deck Encore Basketball', 'ud-2000-01-upper-deck-encore', 'Encore', null, null),
  ('1998-99 Upper Deck Hardcourt Basketball', 'ud-1998-99-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('1999-00 Upper Deck Hardcourt Basketball', 'ud-1999-00-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('2000-01 Upper Deck Hardcourt Basketball', 'ud-2000-01-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('2001-02 Upper Deck Hardcourt Basketball', 'ud-2001-02-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('2002-03 Upper Deck Hardcourt Basketball', 'ud-2002-03-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('2003-04 Upper Deck Hardcourt Basketball', 'ud-2003-04-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('2004-05 Upper Deck Hardcourt Basketball', 'ud-2004-05-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('2005-06 Upper Deck Hardcourt Basketball', 'ud-2005-06-upper-deck-hardcourt', 'Hardcourt', null, null),
  ('2006-07 Upper Deck Hardcourt Basketball', 'ud-2006-07-upper-deck-hardcourt', 'Hardcourt', '2006-10-18', 150),
  ('1998-99 Upper Deck Ionix Basketball', 'ud-1998-99-upper-deck-ionix', 'Ionix', null, 80),
  ('1999-00 Upper Deck Ionix Basketball', 'ud-1999-00-upper-deck-ionix', 'Ionix', null, null),
  ('2000-01 Upper Deck Ionix Basketball', 'ud-2000-01-upper-deck-ionix', 'Ionix', null, null),
  ('1998-99 Upper Deck Ovation Basketball', 'ud-1998-99-upper-deck-ovation', 'Ovation', null, 80),
  ('1999-00 Upper Deck Ovation Basketball', 'ud-1999-00-upper-deck-ovation', 'Ovation', null, null),
  ('2000-01 Upper Deck Ovation Basketball', 'ud-2000-01-upper-deck-ovation', 'Ovation', null, null),
  ('2001-02 Upper Deck Ovation Basketball', 'ud-2001-02-upper-deck-ovation', 'Ovation', null, null),
  ('2002-03 Upper Deck Ovation Basketball', 'ud-2002-03-upper-deck-ovation', 'Ovation', null, null),
  ('1999-00 Upper Deck HoloGrFX Basketball', 'ud-1999-00-upper-deck-hologrfx', 'HoloGrFX', null, 90),
  ('1999-00 Upper Deck Gold Reserve Basketball', 'ud-1999-00-upper-deck-gold-reserve', 'Gold Reserve', null, null),
  ('2000-01 Upper Deck Gold Reserve Basketball', 'ud-2000-01-upper-deck-gold-reserve', 'Gold Reserve', null, null),
  ('1999-00 Upper Deck Retro Basketball', 'ud-1999-00-upper-deck-retro', 'Retro', null, null),
  ('1999-00 Upper Deck Ultimate Victory Basketball', 'ud-1999-00-upper-deck-ultimate-victory', 'Victory', null, null),
  ('2000-01 Upper Deck Ultimate Victory Basketball', 'ud-2000-01-upper-deck-ultimate-victory', 'Victory', null, null),
  ('1999-00 Upper Deck Victory Basketball', 'ud-1999-00-upper-deck-victory', 'Victory', null, null),
  ('2000-01 Upper Deck Pros & Prospects Basketball', 'ud-2000-01-upper-deck-pros-and-prospects', 'Pros & Prospects', null, null),
  ('2000-01 Upper Deck Slam Basketball', 'ud-2000-01-upper-deck-slam', 'Slam', null, null),
  ('2005-06 Upper Deck Slam Basketball', 'ud-2005-06-upper-deck-slam', 'Slam', null, null),
  ('2001-02 Upper Deck Flight Team Basketball', 'ud-2001-02-upper-deck-flight-team', 'Flight Team', null, null),
  ('2003-04 Upper Deck Flight Team Basketball', 'ud-2003-04-upper-deck-flight-team', 'Flight Team', null, null),
  ('2001-02 Upper Deck Honor Roll Basketball', 'ud-2001-02-upper-deck-honor-roll', 'Honor Roll', null, null),
  ('2002-03 Upper Deck Honor Roll Basketball', 'ud-2002-03-upper-deck-honor-roll', 'Honor Roll', null, null),
  ('2003-04 Upper Deck Honor Roll Basketball', 'ud-2003-04-upper-deck-honor-roll', 'Honor Roll', null, null),
  ('2001-02 Upper Deck Inspirations Basketball', 'ud-2001-02-upper-deck-inspirations', 'Inspirations', null, null),
  ('2002-03 Upper Deck Inspirations Basketball', 'ud-2002-03-upper-deck-inspirations', 'Inspirations', null, null),
  ('2001-02 Upper Deck Sweet Shot Basketball', 'ud-2001-02-upper-deck-sweet-shot', 'Sweet Shot', null, null),
  ('2002-03 Upper Deck Sweet Shot Basketball', 'ud-2002-03-upper-deck-sweet-shot', 'Sweet Shot', null, null),
  ('2003-04 Upper Deck Sweet Shot Basketball', 'ud-2003-04-upper-deck-sweet-shot', 'Sweet Shot', null, null),
  ('2004-05 Upper Deck Sweet Shot Basketball', 'ud-2004-05-upper-deck-sweet-shot', 'Sweet Shot', null, 136),
  ('2005-06 Upper Deck Sweet Shot Basketball', 'ud-2005-06-upper-deck-sweet-shot', 'Sweet Shot', '2005-12-13', 150),
  ('2006-07 Upper Deck Sweet Shot Basketball', 'ud-2006-07-upper-deck-sweet-shot', 'Sweet Shot', '2006-11-29', 135),
  ('2007-08 Upper Deck Sweet Shot Basketball', 'ud-2007-08-upper-deck-sweet-shot', 'Sweet Shot', '2007-12-11', 132),
  ('2001-02 Ultimate Collection Basketball', 'ud-2001-02-ultimate-collection', 'Ultimate Collection', null, null),
  ('2002-03 Ultimate Collection Basketball', 'ud-2002-03-ultimate-collection', 'Ultimate Collection', null, null),
  ('2003-04 Ultimate Collection Basketball', 'ud-2003-04-ultimate-collection', 'Ultimate Collection', null, null),
  ('2004-05 Ultimate Collection Basketball', 'ud-2004-05-ultimate-collection', 'Ultimate Collection', null, null),
  ('2001-02 UD Playmakers Limited Basketball', 'ud-2001-02-ud-playmakers-limited', 'Playmakers', null, null),
  ('2002-03 Upper Deck Championship Drive Basketball', 'ud-2002-03-upper-deck-championship-drive', 'Championship Drive', null, null),
  ('2002-03 Upper Deck Finite Basketball', 'ud-2002-03-upper-deck-finite', 'Finite', null, null),
  ('2003-04 Upper Deck Finite Basketball', 'ud-2003-04-upper-deck-finite', 'Finite', null, 342),
  ('2002-03 Upper Deck Generations Basketball', 'ud-2002-03-upper-deck-generations', 'Generations', null, null),
  ('2002-03 Upper Deck Glass Basketball', 'ud-2002-03-upper-deck-glass', 'Glass', null, null),
  ('2003-04 Upper Deck Glass Basketball', 'ud-2003-04-upper-deck-glass', 'Glass', null, null),
  ('2003-04 Upper Deck Legends Basketball', 'ud-2003-04-upper-deck-legends', 'Legends', null, null),
  ('2003-04 Upper Deck Rookie Exclusives Basketball', 'ud-2003-04-upper-deck-rookie-exclusives', 'Rookie Exclusives', null, 60),
  ('2003-04 Upper Deck Standing O Basketball', 'ud-2003-04-upper-deck-standing-o', 'Standing O', null, null),
  ('2003-04 Upper Deck Triple Dimensions Basketball', 'ud-2003-04-upper-deck-triple-dimensions', 'Triple Dimensions', null, 132),
  ('2003-04 Upper Deck Top Prospects Basketball', 'ud-2003-04-upper-deck-top-prospects', 'Top Prospects', null, null),
  ('2003-04 Upper Deck LeBron James Freshman Season Collection', 'ud-2003-04-upper-deck-lebron-james-freshman-season-collection', 'LeBron James Sets', null, 90),
  ('2003-04 Upper Deck LeBron James Box Set', 'ud-2003-04-upper-deck-lebron-james-box-set', 'LeBron James Sets', null, null),
  ('2003-04 Upper Deck Phenomenal Beginning LeBron James', 'ud-2003-04-upper-deck-phenomenal-beginning-lebron-james', 'LeBron James Sets', '2003-11-01', 20),
  ('2004-05 Upper Deck All-Star Lineup Basketball', 'ud-2004-05-upper-deck-all-star-lineup', 'All-Star Lineup', null, null),
  ('2004-05 Upper Deck Pro Sigs Basketball', 'ud-2004-05-upper-deck-pro-sigs', 'Pro Sigs', null, 120),
  ('2004-05 Upper Deck R-Class Basketball', 'ud-2004-05-upper-deck-r-class', 'R-Class', null, 132),
  ('2004-05 Upper Deck Trilogy Basketball', 'ud-2004-05-upper-deck-trilogy', 'Trilogy', null, 150),
  ('2005-06 Upper Deck Trilogy Basketball', 'ud-2005-06-upper-deck-trilogy', 'Trilogy', '2006-05-02', 140),
  ('2006-07 Upper Deck Trilogy Basketball', 'ud-2006-07-upper-deck-trilogy', 'Trilogy', '2007-05-22', 140),
  ('2005-06 Upper Deck ESPN Basketball', 'ud-2005-06-upper-deck-espn', 'ESPN', null, null),
  ('2005-06 Upper Deck Reflections Basketball', 'ud-2005-06-upper-deck-reflections', 'Reflections', '2005-11-17', 150),
  ('2006-07 Upper Deck Reflections Basketball', 'ud-2006-07-upper-deck-reflections', 'Reflections', '2006-10-07', 149),
  ('2005-06 Upper Deck Rookie Debut Basketball', 'ud-2005-06-upper-deck-rookie-debut', 'Rookie Debut', null, null),
  ('2006-07 Upper Deck Rookie Debut Basketball', 'ud-2006-07-upper-deck-rookie-debut', 'Rookie Debut', '2006-08-23', 146),
  ('2006-07 Upper Deck Chronology Basketball', 'ud-2006-07-upper-deck-chronology', 'Chronology', null, null),
  ('2007-08 Upper Deck Premier Basketball', 'ud-2007-08-upper-deck-premier', 'Premier', '2008-04-15', 135),
  ('2008-09 Upper Deck Premier Basketball', 'ud-2008-09-upper-deck-premier', 'Premier', null, null),
  ('2008-09 Upper Deck Lineage Basketball', 'ud-2008-09-upper-deck-lineage', 'Lineage', null, null),
  ('2008-09 Upper Deck Radiance Basketball', 'ud-2008-09-upper-deck-radiance', 'Radiance', '2009-04-28', 120)
) as v(name, slug, series, release_date, total_cards)
where not exists (select 1 from public.sets s where s.category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' and lower(s.name) = lower(v.name))
on conflict (slug) do nothing;
