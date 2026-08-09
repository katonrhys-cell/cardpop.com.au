-- Expand the NBA Parallel / Variation options.
--
-- The existing list covered a handful of Prizm, Topps Chrome refractor, Optic
-- and Select parallels. This widens it with the well-known parallels sellers
-- actually hold, keeping the dropdown's family grouping (sort_order blocks):
-- Prizm → Refractor → Optic → Select → Mosaic → other.
--
-- Print runs are recorded only where the run is the industry-standard one for
-- that parallel (matching the in-app refractor guide: Green /99, Blue /150,
-- Teal /199, Gold /50, Orange /25, Black /10, Red /5; White Mosaic /25,
-- Tie-Dye Select /25, Gold Select /10). Pattern parallels and colours whose
-- run varies by year are left unnumbered — the seller's serial records the
-- exact figure, and matchParallel treats a missing run as "don't guess".
--
-- Idempotent: sort orders are widened once (guarded), inserts are keyed on
-- (franchise_id, slug) via NOT EXISTS.

do $$
declare
  nba uuid;
begin
  select id into nba
    from public.categories
   where lower(name) = 'nba' and parent_id is not null
   limit 1;
  if nba is null then
    return; -- nothing to expand against
  end if;

  -- Widen the family blocks (1..99 → 10..990) so new rows fit inside them.
  -- Runs once: after widening, every sort_order is >= 100.
  if not exists (
    select 1 from public.parallels
     where franchise_id = nba and coalesce(sort_order, 0) >= 100
  ) then
    update public.parallels
       set sort_order = coalesce(sort_order, 99) * 10
     where franchise_id = nba;
  end if;

  -- The Teal Refractor seeded by 20260809025633 lands at the end of the list;
  -- move it into the refractor block, between Refractor and Blue /150.
  update public.parallels
     set sort_order = 605
   where franchise_id = nba and slug = 'teal-refractor-199';

  insert into public.parallels (name, slug, franchise_id, color, print_run, sort_order, is_active)
  select v.name, v.slug, nba, v.color, v.print_run, v.sort_order, true
    from (values
      -- ── Prizm patterns & colours (after Tiger Stripe, 550) ────────────────
      ('White Sparkle Prizm',        'white-sparkle-prizm',   null::text, null::int, 560),
      ('Red White and Blue Prizm',   'red-white-blue-prizm',  null,       null,      561),
      ('Fast Break Prizm',           'fast-break-prizm',      null,       null,      562),
      ('Green Ice Prizm',            'green-ice-prizm',       'Green',    null,      563),
      ('Red Ice Prizm',              'red-ice-prizm',         'Red',      null,      564),
      ('Purple Ice Prizm',           'purple-ice-prizm',      'Purple',   null,      565),
      ('Ruby Wave Prizm',            'ruby-wave-prizm',       'Red',      null,      566),
      ('Blue Wave Prizm',            'blue-wave-prizm',       'Blue',     null,      567),
      ('Purple Wave Prizm',          'purple-wave-prizm',     'Purple',   null,      568),
      ('Snakeskin Prizm',            'snakeskin-prizm',       null,       null,      569),
      -- ── Topps Chrome refractor patterns (right after base Refractor, 600) ─
      ('X-Fractor',                  'x-fractor',             null,       null,      601),
      ('Atomic Refractor',           'atomic-refractor',      null,       null,      602),
      ('Prism Refractor',            'prism-refractor',       null,       null,      603),
      ('Pulsar Refractor',           'pulsar-refractor',      null,       null,      604),
      -- Teal Refractor /199 sits at 605 (seeded by the previous migration)
      ('Wave Refractor',             'wave-refractor',        null,       null,      606),
      ('RayWave Refractor',          'raywave-refractor',     null,       null,      607),
      ('Speckle Refractor',          'speckle-refractor',     null,       null,      608),
      ('Sepia Refractor',            'sepia-refractor',       null,       null,      609),
      -- ── Refractor colours (scarcity order within the 610-660 block) ───────
      ('Negative Refractor',         'negative-refractor',    'Black',    null,      611),
      ('Aqua Refractor',             'aqua-refractor',        'Aqua',     null,      612),
      ('Pink Refractor',             'pink-refractor',        'Pink',     null,      613),
      ('Purple Refractor',           'purple-refractor',      'Purple',   null,      614),
      ('Black Refractor /10',        'black-refractor-10',    'Black',    10,        645),
      -- ── Donruss Optic (block 700-730) ─────────────────────────────────────
      ('Optic Holo',                 'optic-holo',            null,       null,      701),
      ('Optic Shock',                'optic-shock',           null,       null,      702),
      ('Optic Checkerboard',         'optic-checkerboard',    null,       null,      703),
      ('Optic Purple',               'optic-purple',          'Purple',   null,      704),
      ('Optic Pink',                 'optic-pink',            'Pink',     null,      705),
      ('Optic Lime Green',           'optic-lime-green',      'Green',    null,      706),
      -- ── Select (block 750-770) ────────────────────────────────────────────
      ('Tri-Color Select',           'tri-color-select',      null,       null,      771),
      ('Zebra Select',               'zebra-select',          null,       null,      772),
      ('Tie-Dye Select /25',         'tie-dye-select-25',     null,       25,        773),
      ('Gold Select /10',            'gold-select-10',        'Gold',     10,        774),
      ('Black Select /1',            'black-select-1',        'Black',    1,         775),
      -- ── Mosaic (new block, 780s) ──────────────────────────────────────────
      ('Silver Mosaic',              'silver-mosaic',         'Silver',   null,      780),
      ('Green Mosaic',               'green-mosaic',          'Green',    null,      781),
      ('Reactive Blue Mosaic',       'reactive-blue-mosaic',  'Blue',     null,      782),
      ('Reactive Yellow Mosaic',     'reactive-yellow-mosaic','Yellow',   null,      783),
      ('Genesis Mosaic',             'genesis-mosaic',        null,       null,      784),
      ('White Mosaic /25',           'white-mosaic-25',       'White',    25,        785),
      -- ── Historic chase (after SP Authentic, 800) ──────────────────────────
      ('Precious Metal Gems (PMG)',  'pmg',                   null,       null,      810)
    ) as v(name, slug, color, print_run, sort_order)
   where not exists (
     select 1 from public.parallels p
      where p.franchise_id = nba and p.slug = v.slug
   );
end $$;
