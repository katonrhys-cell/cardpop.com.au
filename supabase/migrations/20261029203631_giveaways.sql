-- Giveaways: a promotion run from Instagram whose entries and draw live here.
--
-- The post asks people to follow, comment the surname of the card they want,
-- then register on CardPop and lock in their entry at /giveaway. The site is
-- the entry register because Instagram can't check residency, can't stop
-- duplicate entries and can't prove a draw was random. Here:
--
--   * giveaways        — one row per promotion (prizes, window, terms, result).
--   * giveaway_entries — one row per member per giveaway, written by the member
--                        through a caller-scoped client (routes/giveaways.js)
--                        so RLS + the insert trigger stay the rules: the
--                        giveaway must be open and inside its window, the
--                        member's email must be confirmed, the Australian
--                        residency / 18+ ticks must be true, the prize pick must
--                        be one of the giveaway's prizes, and nothing about
--                        verification or the draw can be set by a client.
--
-- The draw itself is server-side (POST /giveaways/admin/:id/draw, service role
-- behind requireAdmin): crypto.randomInt over the eligible pool, with the pool
-- size, chosen index and a nonce stored on the giveaway so the result can be
-- shown later. A trade promotion of this size needs no permit in any state,
-- but the terms must be published before entry opens and the draw must be
-- recorded — see docs/giveaways.md.

-- ── giveaways ───────────────────────────────────────────────────────────────
create table if not exists public.giveaways (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title              text not null check (char_length(title) between 3 and 120),
  description        text check (description is null or char_length(description) <= 4000),
  image_url          text,
  -- [{ key, label, detail, image_url }] — the cards on offer. With entry_mode
  -- 'pick_prize' the entrant names one and the winner gets the card they
  -- named; with 'single_prize' there is one card and no pick.
  prizes             jsonb not null default '[]'::jsonb,
  entry_mode         text not null default 'pick_prize'
                     check (entry_mode in ('pick_prize', 'single_prize')),
  instagram_post_url text,
  opens_at           timestamptz not null default now(),
  closes_at          timestamptz not null,
  status             text not null default 'draft'
                     check (status in ('draft', 'open', 'closed', 'drawn', 'cancelled')),
  terms              text check (terms is null or char_length(terms) <= 8000),
  min_age            smallint not null default 18 check (min_age between 0 and 21),
  -- Result of the draw. Set only by the draw endpoint.
  winner_entry_id    uuid,
  drawn_at           timestamptz,
  drawn_by           uuid references public.profiles(id) on delete set null,
  draw_record        jsonb,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint giveaways_window check (closes_at > opens_at)
);

create index if not exists giveaways_status_closes_idx
  on public.giveaways (status, closes_at desc);

-- ── giveaway_entries ────────────────────────────────────────────────────────
create table if not exists public.giveaway_entries (
  id                  uuid primary key default gen_random_uuid(),
  giveaway_id         uuid not null references public.giveaways(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  -- Lower-case, no leading @ (normalised by the trigger).
  instagram_handle    text not null
                      check (instagram_handle ~ '^[a-z0-9._]{1,30}$'),
  prize_key           text,
  state               text not null
                      check (state in ('ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA')),
  postcode            text not null check (postcode ~ '^[0-9]{4}$'),
  resident_confirmed  boolean not null default false,
  age_confirmed       boolean not null default false,
  newsletter_opt_in   boolean not null default false,
  -- Snapshot of auth.users.email_confirmed_at at entry time.
  email_confirmed     boolean not null default false,
  -- An admin ticks this once the handle's comment is found under the post.
  verified_at         timestamptz,
  verified_by         uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint giveaway_entries_one_per_member unique (giveaway_id, user_id),
  -- One Instagram account can't enter through several CardPop accounts.
  constraint giveaway_entries_one_per_handle unique (giveaway_id, instagram_handle)
);

create index if not exists giveaway_entries_giveaway_idx
  on public.giveaway_entries (giveaway_id, created_at);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'giveaways_winner_entry_fkey'
  ) then
    alter table public.giveaways
      add constraint giveaways_winner_entry_fkey
      foreign key (winner_entry_id) references public.giveaway_entries(id) on delete set null;
  end if;
end $$;

-- ── Entry rules live in the trigger ─────────────────────────────────────────
create or replace function public.giveaway_entries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g        record;
  v_confirmed timestamptz;
  v_now      timestamptz := now();
begin
  select id, status, entry_mode, opens_at, closes_at, prizes
    into v_g from public.giveaways where id = new.giveaway_id;

  if v_g.id is null or v_g.status <> 'open' or v_now < v_g.opens_at or v_now >= v_g.closes_at then
    raise exception 'This giveaway is not open for entries' using errcode = '22023';
  end if;

  if new.user_id is distinct from (select auth.uid()) and (select auth.uid()) is not null then
    raise exception 'You can only enter as yourself' using errcode = '42501';
  end if;

  select email_confirmed_at into v_confirmed from auth.users where id = new.user_id;
  if v_confirmed is null then
    raise exception 'Confirm your email address before entering' using errcode = '22023';
  end if;
  new.email_confirmed := true;

  if not coalesce(new.resident_confirmed, false) or not coalesce(new.age_confirmed, false) then
    raise exception 'You must confirm you are an Australian resident and old enough to enter' using errcode = '22023';
  end if;

  new.instagram_handle := lower(regexp_replace(btrim(coalesce(new.instagram_handle, '')), '^@+', ''));
  if new.instagram_handle !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'Enter a valid Instagram username' using errcode = '22023';
  end if;

  new.prize_key := nullif(btrim(coalesce(new.prize_key, '')), '');
  if v_g.entry_mode = 'pick_prize' then
    if new.prize_key is null or not exists (
      select 1 from jsonb_array_elements(coalesce(v_g.prizes, '[]'::jsonb)) p
       where p->>'key' = new.prize_key
    ) then
      raise exception 'Pick one of the cards on offer' using errcode = '22023';
    end if;
  else
    new.prize_key := null;
  end if;

  new.state := upper(btrim(new.state));
  new.postcode := btrim(new.postcode);

  -- Verification and timing are never the client's.
  new.verified_at := null;
  new.verified_by := null;
  new.created_at := v_now;
  return new;
end;
$$;

drop trigger if exists trg_giveaway_entries_before_insert on public.giveaway_entries;
create trigger trg_giveaway_entries_before_insert
  before insert on public.giveaway_entries
  for each row execute function public.giveaway_entries_before_insert();

-- ── updated_at on giveaways ─────────────────────────────────────────────────
create or replace function public.giveaways_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_giveaways_touch_updated_at on public.giveaways;
create trigger trg_giveaways_touch_updated_at
  before update on public.giveaways
  for each row execute function public.giveaways_touch_updated_at();

-- ── Public entry count (no row access) ──────────────────────────────────────
create or replace function public.giveaway_entry_count(p_giveaway_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.giveaway_entries where giveaway_id = p_giveaway_id;
$$;

revoke all on function public.giveaway_entry_count(uuid) from public;
grant execute on function public.giveaway_entry_count(uuid) to anon, authenticated;

-- ── Winner notification type ────────────────────────────────────────────────
alter type notification_type add value if not exists 'giveaway_won';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;

drop policy if exists "Live giveaways are public" on public.giveaways;
create policy "Live giveaways are public"
  on public.giveaways for select
  using (status in ('open', 'closed', 'drawn'));

drop policy if exists "Admins can read every giveaway" on public.giveaways;
create policy "Admins can read every giveaway"
  on public.giveaways for select
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

-- Giveaway writes go through the admin routes (service role). No client
-- INSERT/UPDATE/DELETE policy on purpose.

drop policy if exists "Members can read their own giveaway entries" on public.giveaway_entries;
create policy "Members can read their own giveaway entries"
  on public.giveaway_entries for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can read every giveaway entry" on public.giveaway_entries;
create policy "Admins can read every giveaway entry"
  on public.giveaway_entries for select
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Members can enter a giveaway as themselves" on public.giveaway_entries;
create policy "Members can enter a giveaway as themselves"
  on public.giveaway_entries for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- No client UPDATE/DELETE: an entry is final (withdrawals go through support)
-- and verification / the draw are admin-route writes.

grant select on public.giveaways to anon, authenticated;
grant select, insert on public.giveaway_entries to authenticated;

comment on table public.giveaways is
  'Instagram-led giveaways: prizes, entry window, terms and the recorded random draw. Admin-managed via /giveaways/admin.';
comment on table public.giveaway_entries is
  'One entry per member per giveaway. Insert rules (open window, confirmed email, AU residency/age ticks, valid prize pick) enforced by trigger; verification and draw columns are admin-only.';
