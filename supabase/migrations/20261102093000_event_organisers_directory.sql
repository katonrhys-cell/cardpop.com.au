-- Event organisers directory: a saved list of organisers (name + logo) an admin
-- or submitter picks from on the event form's Organiser tab, instead of typing
-- the name and re-uploading the logo for every event.
--
-- The event keeps its own denormalised copy (events.organizer_name /
-- organizer_logo_url) — picking an organiser just fills those fields — so the
-- event page, events_public, the prerender and the JSON-LD are unchanged.
--
-- Public read: an organiser's name and logo are already public on every event
-- page. Contact email / phone are deliberately NOT stored here (events_public
-- doesn't expose them). Writes are admin-only.

create table if not exists public.event_organisers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  logo_url   text check (logo_url is null or logo_url ~* '^https?://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per organiser, ignoring case and stray spaces.
create unique index if not exists event_organisers_name_key
  on public.event_organisers (lower(btrim(name)));

comment on table public.event_organisers is
  'Saved event organisers (name + logo) selectable on the event form. Events keep a denormalised copy of the name/logo — see utils/eventOrganisers.js.';

alter table public.event_organisers enable row level security;

drop policy if exists "Event organisers are public" on public.event_organisers;
create policy "Event organisers are public"
  on public.event_organisers for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage event organisers" on public.event_organisers;
create policy "Admins manage event organisers"
  on public.event_organisers for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

grant select on public.event_organisers to anon, authenticated;
grant insert, update, delete on public.event_organisers to authenticated;

create or replace function public.event_organisers_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.logo_url := nullif(btrim(new.logo_url), '');
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_event_organisers_before_write on public.event_organisers;
create trigger trg_event_organisers_before_write
  before insert or update on public.event_organisers
  for each row execute function public.event_organisers_before_write();

-- ── Backfill: every organiser already named on an event ──────────────────────
-- One row per case-insensitive name, spelled the way most events spell it
-- (ties → the newest), carrying the most recent logo any of its events has.
insert into public.event_organisers (name, logo_url)
select
  s.n,
  (
    select e2.organizer_logo_url
    from public.events e2
    where lower(btrim(e2.organizer_name)) = lower(s.n)
      and e2.organizer_logo_url ~* '^https?://[^[:space:]]+$'
    order by e2.created_at desc
    limit 1
  )
from (
  select distinct on (lower(btrim(organizer_name)))
    btrim(organizer_name) as n
  from (
    select organizer_name, created_at,
           count(*) over (partition by btrim(organizer_name)) as uses
    from public.events
    where nullif(btrim(organizer_name), '') is not null
  ) x
  order by lower(btrim(organizer_name)), uses desc, created_at desc
) s
on conflict do nothing;

-- ── Organisers asked for by name (logos are added from the event form) ───────
insert into public.event_organisers (name) values
  ('Fast Break Trading Cards Pty Ltd'),
  ('Sports Addicts Australia')
on conflict do nothing;
