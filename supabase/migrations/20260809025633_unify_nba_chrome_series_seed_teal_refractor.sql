-- Two data fixes surfaced by a real Topps Chrome basketball scan:
--
-- 1. The NBA Topps Chrome product line was split across two series labels:
--    1996-2009 seasons under series 'Topps Chrome' and 2019-2026 seasons under
--    series 'Chrome'. The Set dropdown groups by series, so the same product
--    appeared as two near-identical groups ("duplicate" set options). Unify on
--    'Topps Chrome' — the label the majority of rows already carry and the name
--    printed on the cards. Only NBA ever used the bare 'Chrome' label, but the
--    update is written to be safe to re-run anywhere.
update public.sets
   set series = 'Topps Chrome'
 where series = 'Chrome';

-- 2. NBA parallels had no Teal Refractor row, so a scanned Topps Chrome teal
--    refractor /199 (the product's standard /199 colour parallel) had nothing
--    to auto-select in Parallel / Variation. Idempotent: skipped if an NBA
--    Teal Refractor already exists.
insert into public.parallels (name, slug, franchise_id, color, print_run, sort_order, is_active)
select 'Teal Refractor /199',
       'teal-refractor-199',
       c.id,
       'teal',
       199,
       coalesce((select max(p.sort_order) from public.parallels p where p.franchise_id = c.id), 0) + 1,
       true
  from public.categories c
 where lower(c.name) = 'nba'
   and c.parent_id is not null
   and not exists (
     select 1 from public.parallels p
      where p.franchise_id = c.id
        and lower(p.name) like 'teal refractor%'
   );
