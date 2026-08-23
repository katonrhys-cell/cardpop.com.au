-- CardPop Points: an append-only ledger of activity rewards, plus the award
-- triggers and the leaderboard aggregate.
--
-- Award writing happens in the database (not the backend) because the events
-- being rewarded — an order completing, a review landing, a trade being
-- accepted — already transition here, through triggers and RPCs as well as
-- backend code. A DB-side award is the only hook that can't miss one.
--
-- Anti-double-award is structural, not procedural: one row per
-- (user, reason, related_id) via a unique index, and one daily claim per UTC
-- day via a partial unique index — award_points() swallows conflicts.

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points > 0 and points <= 1000),
  reason text not null check (reason in (
    'daily_claim', 'sale_completed', 'purchase_completed',
    'review_written', 'trade_completed', 'listing_created', 'admin_grant'
  )),
  related_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_points_ledger_user_id on public.points_ledger (user_id);
create index if not exists idx_points_ledger_created_at on public.points_ledger (created_at);

-- One award per user per triggering row.
create unique index if not exists uq_points_ledger_user_reason_related
  on public.points_ledger (user_id, reason, related_id)
  where related_id is not null;

-- One daily claim per user per UTC day.
create unique index if not exists uq_points_ledger_daily_claim
  on public.points_ledger (user_id, ((created_at at time zone 'utc')::date))
  where reason = 'daily_claim';

alter table public.points_ledger enable row level security;

-- Users read their own ledger; all writes go through award_points() /
-- the service-role backend — no client insert/update/delete policies.
drop policy if exists points_ledger_select_own on public.points_ledger;
create policy points_ledger_select_own on public.points_ledger
  for select using (user_id = (select auth.uid()));

-- Idempotent award helper: a conflict (already awarded) is success, and no
-- award failure may ever fail the transaction that triggered it.
create or replace function public.award_points(
  p_user uuid, p_points integer, p_reason text, p_related uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_user is null or p_points is null or p_points <= 0 then return; end if;
  begin
    insert into public.points_ledger (user_id, points, reason, related_id)
    values (p_user, p_points, p_reason, p_related)
    on conflict do nothing;
  exception when others then
    null;
  end;
end;
$$;

revoke execute on function public.award_points(uuid, integer, text, uuid) from public;
revoke execute on function public.award_points(uuid, integer, text, uuid) from anon;
revoke execute on function public.award_points(uuid, integer, text, uuid) from authenticated;

-- ── Award triggers ───────────────────────────────────────────────────────────

-- Completed order: seller and buyer both earn.
create or replace function public.award_points_on_order_completed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform award_points(new.seller_id, 25, 'sale_completed', new.id);
    perform award_points(new.buyer_id, 15, 'purchase_completed', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists award_points_on_order_completed on public.orders;
create trigger award_points_on_order_completed
  after update on public.orders
  for each row execute function public.award_points_on_order_completed();

-- Review written (order-verified by the seller-ratings endpoint).
create or replace function public.award_points_on_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform award_points(new.reviewer_id, 10, 'review_written', new.id);
  return new;
end;
$$;

drop trigger if exists award_points_on_review on public.seller_ratings;
create trigger award_points_on_review
  after insert on public.seller_ratings
  for each row execute function public.award_points_on_review();

-- Accepted trade: both collectors earn.
create or replace function public.award_points_on_trade_accepted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform award_points(new.initiator_id, 15, 'trade_completed', new.id);
    perform award_points(new.responder_id, 15, 'trade_completed', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists award_points_on_trade_accepted on public.trades;
create trigger award_points_on_trade_accepted
  after update on public.trades
  for each row execute function public.award_points_on_trade_accepted();

-- ── Leaderboard aggregate ────────────────────────────────────────────────────
-- Sum of points per user since p_since, with public profile fields. Callable
-- only by the service role (backend /points routes) — the aggregate is public
-- but rate-limited through the API, never raw.
create or replace function public.points_leaderboard(p_since timestamptz, p_limit integer default 20)
returns table (
  user_id uuid,
  total_points bigint,
  display_name text,
  username text,
  avatar_url text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    pl.user_id,
    sum(pl.points)::bigint as total_points,
    p.display_name,
    p.username,
    p.avatar_url
  from public.points_ledger pl
  join public.profiles p on p.id = pl.user_id
  where pl.created_at >= p_since
  group by pl.user_id, p.display_name, p.username, p.avatar_url
  order by total_points desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.points_leaderboard(timestamptz, integer) from public;
revoke execute on function public.points_leaderboard(timestamptz, integer) from anon;
revoke execute on function public.points_leaderboard(timestamptz, integer) from authenticated;
