-- Behavioural checks for 20261018085328_nba_upper_deck_sets.sql. Each block
-- raises on failure, so a clean run prints nothing but NOTICEs.
\set ON_ERROR_STOP on

do $$
declare n int; r record;
begin
  -- 120 live Upper Deck rows + 118 new + the Fleer-manufacturer control row.
  select count(*) into n from public.sets where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f';
  if n <> 239 then raise exception 'expected 239 NBA sets after the migration, got %', n; end if;

  -- The card that started this: the Freshman Season Collection is pickable.
  select * into r from public.sets where slug = 'ud-2003-04-upper-deck-lebron-james-freshman-season-collection';
  if r is null then raise exception 'Freshman Season Collection missing'; end if;
  if r.name <> '2003-04 Upper Deck LeBron James Freshman Season Collection' or r.series <> 'LeBron James Sets'
     or r.total_cards <> 90 or r.manufacturer_id <> '82c275d0-9291-4eb4-923d-4941212b243f' or not r.is_active then
    raise exception 'Freshman Season Collection row wrong: %', r;
  end if;

  -- No price-tier group labels survive.
  if exists (select 1 from public.sets where manufacturer_id = '82c275d0-9291-4eb4-923d-4941212b243f'
             and series in ('Upper Deck Flagship', 'Series 1', 'Upper Deck Budget', 'Upper Deck Chrome', 'Upper Deck Mid-Range', 'Upper Deck Premium')) then
    raise exception 'old series labels still present';
  end if;
  if (select series from public.sets where slug = 'ud-collectors-choice-1996-97') <> 'Collector''s Choice' then raise exception 'Collector''s Choice relabel'; end if;
  if (select series from public.sets where slug = 'ud3-1996-97') <> 'UD3' then raise exception 'UD3 relabel'; end if;
  if (select series from public.sets where slug = 'spx-2003-04') <> 'SPx' then raise exception 'SPx relabel'; end if;
  if (select series from public.sets where slug = 'ud-black-2007-08') <> 'UD Black' then raise exception 'UD Black relabel'; end if;
  if (select series from public.sets where slug = 'fleer-tradition-ud-2003-04') <> 'Fleer' then raise exception 'UD-filed Fleer relabel'; end if;
  if (select series from public.sets where slug = 'ud-series1-1991-92') <> 'Upper Deck' then raise exception 'flagship relabel'; end if;

  -- Single-series years renamed in place (same slug/id), two-series years kept.
  if (select name from public.sets where slug = '2003-04-ud-series-1-basketball') <> '2003-04 Upper Deck Basketball' then raise exception '2003-04 flagship rename'; end if;
  if (select name from public.sets where slug = 'ud-series1-2002-03') <> '2002-03 Upper Deck Series 1 Basketball' then raise exception '2002-03 Series 1 must keep its name'; end if;
  if not exists (select 1 from public.sets where slug = 'ud-2002-03-upper-deck-series-2' and total_cards = 220) then raise exception '2002-03 Series 2 missing'; end if;

  -- The Fleer-manufacturer control row is untouched.
  if (select series from public.sets where slug = 'fleer-tradition-2003-04-test') <> 'Tradition' then raise exception 'touched a non-Upper-Deck row'; end if;

  -- No duplicate names within NBA.
  select count(*) into n from (select lower(name) from public.sets where category_id = '1def0f95-d395-4443-b8da-8e895ed4d05f' group by 1 having count(*) > 1) d;
  if n <> 1 then raise exception 'expected only the deliberate Fleer Tradition duplicate, got % duplicate names', n; end if;

  raise notice 'ok: nba upper deck sets';
end $$;
