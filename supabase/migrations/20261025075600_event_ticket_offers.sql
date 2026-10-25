-- Event ticket offers: a member discount code and a referral link per event.
--
-- Tickets are sold by the organiser (Humanitix, Eventbrite, their own site),
-- not by CardPop, so CardPop never applies the discount or sees the sale. What
-- it does is:
--
--   * show signed-in members the organiser's ticket discount code on the
--     event page ("Reveal code") — visitors who aren't signed in see only
--     the offer line and a prompt to sign in;
--   * send "Get Tickets" through the organiser's referral / tracking link,
--     so the organiser can credit CardPop for the sale;
--   * count ticket clicks and code reveals per event for Admin → Events.
--
-- `events` is publicly readable (every column), so the code can't live there.
-- It lives in this table, which has no public SELECT at all: the event page
-- reads it through two security-definer functions — one returns the public
-- teaser (offer line, referral link, whether a code exists), the other hands
-- the code to a signed-in caller only. Admins edit rows directly (RLS).
--
-- An offer is shown only while the event is public (approved/completed),
-- hasn't ended, and the row is active.

create table if not exists public.event_ticket_offers (
  event_id       uuid primary key references public.events(id) on delete cascade,
  -- Public teaser, e.g. "15% off GA tickets for CardPop members".
  offer_text     text check (offer_text is null or char_length(offer_text) <= 120),
  -- The organiser's code, shown to signed-in members only.
  discount_code  text check (discount_code is null or char_length(discount_code) between 1 and 60),
  -- The organiser's referral / tracking link. Replaces the event's ticket_url
  -- as the "Get Tickets" destination while the offer is active.
  referral_url   text check (referral_url is null or referral_url ~* '^https?://[^[:space:]]+$'),
  is_active      boolean not null default true,
  ticket_clicks  integer not null default 0 check (ticket_clicks >= 0),
  code_reveals   integer not null default 0 check (code_reveals >= 0),
  last_click_at  timestamptz,
  last_reveal_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.event_ticket_offers enable row level security;

-- Admins only. No public policy: the code must never be readable with the
-- anon key, and the counters only move through the functions below.
drop policy if exists "Admins manage event ticket offers" on public.event_ticket_offers;
create policy "Admins manage event ticket offers"
  on public.event_ticket_offers for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

grant select, insert, update, delete on public.event_ticket_offers to authenticated;

-- An admin's save may not reset the counters (the form never sends them, but
-- an upsert of stale values must not wipe them either).
create or replace function public.event_ticket_offers_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.offer_text := nullif(btrim(new.offer_text), '');
  new.discount_code := nullif(btrim(new.discount_code), '');
  new.referral_url := nullif(btrim(new.referral_url), '');
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    -- Counters move only through the security-definer functions, which set
    -- this flag for the duration of their own update.
    if coalesce(current_setting('cardpop.offer_counter', true), '') <> 'on' then
      new.ticket_clicks := old.ticket_clicks;
      new.code_reveals := old.code_reveals;
      new.last_click_at := old.last_click_at;
      new.last_reveal_at := old.last_reveal_at;
    end if;
  else
    new.ticket_clicks := 0;
    new.code_reveals := 0;
    new.last_click_at := null;
    new.last_reveal_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_event_ticket_offers_before_write on public.event_ticket_offers;
create trigger trg_event_ticket_offers_before_write
  before insert or update on public.event_ticket_offers
  for each row execute function public.event_ticket_offers_before_write();

-- True while an offer for this event may be shown: active row, public event,
-- not yet finished (Australian time, same rule as event_has_ended()).
create or replace function public.event_ticket_offer_is_live(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.event_ticket_offers o
      join public.events e on e.id = o.event_id
     where o.event_id = p_event_id
       and o.is_active
       and e.status = 'approved'::event_status
       and coalesce(e.end_date, e.start_date) >= (now() at time zone 'Australia/Sydney')::date
  );
$$;

revoke all on function public.event_ticket_offer_is_live(uuid) from public;

-- Public teaser for the event page — never the code itself.
create or replace function public.get_event_ticket_offer(p_event_id uuid)
returns table (offer_text text, has_code boolean, referral_url text)
language sql
stable
security definer
set search_path = public
as $$
  select o.offer_text, o.discount_code is not null, o.referral_url
    from public.event_ticket_offers o
   where o.event_id = p_event_id
     and public.event_ticket_offer_is_live(p_event_id);
$$;

revoke all on function public.get_event_ticket_offer(uuid) from public;
grant execute on function public.get_event_ticket_offer(uuid) to anon, authenticated;

-- The member code. Signed-in callers only; counts the reveal.
create or replace function public.reveal_event_ticket_code(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to see the member code' using errcode = '42501';
  end if;
  if not public.event_ticket_offer_is_live(p_event_id) then
    return null;
  end if;

  perform set_config('cardpop.offer_counter', 'on', true);
  update public.event_ticket_offers
     set code_reveals = code_reveals + 1, last_reveal_at = now()
   where event_id = p_event_id and discount_code is not null
  returning discount_code into v_code;
  perform set_config('cardpop.offer_counter', '', true);
  return v_code;
end;
$$;

revoke all on function public.reveal_event_ticket_code(uuid) from public;
grant execute on function public.reveal_event_ticket_code(uuid) to authenticated;

-- A "Get Tickets" click on an event with a live offer. Anyone may call it.
create or replace function public.record_event_ticket_click(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.event_ticket_offer_is_live(p_event_id) then
    return;
  end if;
  perform set_config('cardpop.offer_counter', 'on', true);
  update public.event_ticket_offers
     set ticket_clicks = ticket_clicks + 1, last_click_at = now()
   where event_id = p_event_id;
  perform set_config('cardpop.offer_counter', '', true);
end;
$$;

revoke all on function public.record_event_ticket_click(uuid) from public;
grant execute on function public.record_event_ticket_click(uuid) to anon, authenticated;
