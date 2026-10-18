-- Players: full date of birth, and LeBron James moves to the Philadelphia 76ers.
--
-- `players.born_year` was the only birth fact the page carried. `born_on` is the
-- full date (shown as "30 December 1984" on the page and emitted as
-- schema.org `birthDate`); `born_year` stays for rows where only the year is
-- known and is kept in step with `born_on` by trigger, so nothing that reads
-- the year has to change.
--
-- LeBron James signed a two-year deal with the Philadelphia 76ers in July 2026
-- (his fourth franchise), so his seeded row is updated: team, date of birth and
-- one sentence in the bio. Idempotent: safe to re-run.

alter table public.players
  add column if not exists born_on date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'players_born_on_range' and conrelid = 'public.players'::regclass
  ) then
    alter table public.players
      add constraint players_born_on_range
      check (born_on is null or born_on between date '1850-01-01' and date '2100-12-31');
  end if;
end $$;

comment on column public.players.born_on is
  'Full date of birth. born_year is derived from it when set.';

-- Keep born_year equal to the year of born_on whenever a full date is known.
create or replace function public.players_sync_born_year()
returns trigger
language plpgsql
as $$
begin
  if new.born_on is not null then
    new.born_year := extract(year from new.born_on)::integer;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_players_sync_born_year on public.players;
create trigger trg_players_sync_born_year
  before insert or update of born_on, born_year on public.players
  for each row execute function public.players_sync_born_year();

update public.players
set
  born_on = date '1984-12-30',
  team = 'Philadelphia 76ers',
  bio = E'LeBron James went straight from high school in Akron, Ohio to the first pick of the 2003 draft. He has won four championships with three franchises (Miami 2012 and 2013, Cleveland 2016, the Lakers 2020), four MVP awards and four Finals MVPs, and in February 2023 passed Kareem Abdul-Jabbar as the league''s all-time leading scorer.\n\nIn July 2026 he left the Lakers for the Philadelphia 76ers, his fourth franchise, chasing a fifth ring. More than two decades after his debut he is still an All-Star, which is why his rookie cards have held their place at the top of the modern market for so long.'
where slug = 'lebron-james';
