-- Admin-managed promo codes: Admin → Promo Codes creates codes with any
-- percentage off, an optional start/expiry window, a usage policy (one-off or
-- ongoing, with optional caps) and a record of who the code was given to.
--
-- Codes are entered in the same checkout box as welcome codes (POP-XXXX-XXXX)
-- and partner referral codes. The discount is platform-funded and applied as a
-- one-off Stripe amount-off coupon on the item subtotal — fees, GST and seller
-- payouts are untouched, exactly like the welcome offer.
--
-- Every use is logged in promo_code_redemptions. A row is RESERVED when the
-- Checkout Session is created (so a single-use code can't be applied to two
-- concurrent checkouts), then REDEEMED by the Stripe webhook once payment
-- completes, or RELEASED if the session expires / the order is fully refunded
-- as a double-sale. Both tables are written only by the backend (service role).

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9-]{3,29}$'),
  -- Internal label, e.g. "Instagram giveaway October".
  description text,
  discount_pct numeric(5,2) not null check (discount_pct > 0 and discount_pct <= 100),
  -- 'shop' = CardPop Shop items only; 'all' = every item in the cart (the
  -- platform funds the discount on marketplace cards too — sellers are still
  -- paid in full).
  applies_to text not null default 'shop' check (applies_to in ('shop', 'all')),
  -- 'single_use' = one redemption, ever, by anyone. 'ongoing' = reusable,
  -- bounded by max_redemptions / once_per_customer.
  usage_type text not null default 'ongoing' check (usage_type in ('single_use', 'ongoing')),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  once_per_customer boolean not null default true,
  min_order_aud numeric(10,2) check (min_order_aud is null or min_order_aud >= 0),
  max_discount_aud numeric(10,2) check (max_discount_aud is null or max_discount_aud > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  -- Who the code was handed to (free text — they don't need an account).
  issued_to_name text,
  issued_to_email text,
  -- When true, only an account whose login email matches issued_to_email can use it.
  restrict_to_email boolean not null default false,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_window_check check (starts_at is null or expires_at is null or expires_at > starts_at),
  constraint promo_codes_restrict_needs_email check (not restrict_to_email or issued_to_email is not null)
);

create unique index if not exists promo_codes_code_upper_idx on public.promo_codes (upper(code));

create table if not exists public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  -- restrict: a code with usage history can be deactivated but not deleted.
  promo_code_id uuid not null references public.promo_codes (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  buyer_email text,
  stripe_session_id text unique,
  order_id uuid references public.orders (id) on delete set null,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'redeemed', 'released')),
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists promo_code_redemptions_code_idx
  on public.promo_code_redemptions (promo_code_id, status);
create index if not exists promo_code_redemptions_user_idx
  on public.promo_code_redemptions (user_id);

alter table public.promo_codes enable row level security;
alter table public.promo_code_redemptions enable row level security;

-- Read-only for admins (the admin page goes through the backend, but this keeps
-- direct dashboard/SQL reads consistent with the rest of the admin tables). No
-- write policies: only the service role writes.
drop policy if exists "Admins can read promo codes" on public.promo_codes;
create policy "Admins can read promo codes"
  on public.promo_codes for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "Admins can read promo code redemptions" on public.promo_code_redemptions;
create policy "Admins can read promo code redemptions"
  on public.promo_code_redemptions for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function public.promo_codes_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_promo_codes_updated_at on public.promo_codes;
create trigger trg_promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.promo_codes_touch_updated_at();

-- Promo codes and partner referral codes share the checkout box, so a code may
-- exist in only one of the two tables.
create or replace function public.promo_codes_reject_partner_collision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.partners where code is not null and upper(code) = upper(new.code)) then
    raise exception 'promo code % is already a partner referral code', new.code using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_promo_codes_partner_collision on public.promo_codes;
create trigger trg_promo_codes_partner_collision
  before insert or update of code on public.promo_codes
  for each row execute function public.promo_codes_reject_partner_collision();

create or replace function public.partners_reject_promo_collision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is not null
     and exists (select 1 from public.promo_codes where upper(code) = upper(new.code)) then
    raise exception 'partner code % is already a promo code', new.code using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_partners_promo_collision on public.partners;
create trigger trg_partners_promo_collision
  before insert or update of code on public.partners
  for each row execute function public.partners_reject_promo_collision();

-- Atomically claim one use of a promo code for an in-flight checkout. The row
-- lock on the code serialises concurrent checkouts, so the usage caps can't be
-- overrun by two buyers (or one buyer in two tabs) racing. A reservation older
-- than 24 hours — Stripe's default Checkout Session lifetime — is treated as
-- abandoned, a safety net for a missed checkout.session.expired webhook.
-- Raises with a machine-readable message the backend maps to a user-facing one.
create or replace function public.reserve_promo_code(
  p_promo_code_id uuid,
  p_user_id uuid,
  p_email text,
  p_discount_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes%rowtype;
  v_cap integer;
  v_live integer;
  v_id uuid;
  v_stale_before timestamptz := now() - interval '24 hours';
begin
  select * into v_code from public.promo_codes where id = p_promo_code_id for update;
  if not found or not v_code.active then
    raise exception 'promo_invalid';
  end if;
  if v_code.starts_at is not null and v_code.starts_at > now() then
    raise exception 'promo_not_started';
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception 'promo_expired';
  end if;

  v_cap := case when v_code.usage_type = 'single_use' then 1 else v_code.max_redemptions end;
  if v_cap is not null then
    select count(*) into v_live
      from public.promo_code_redemptions r
     where r.promo_code_id = p_promo_code_id
       and (r.status = 'redeemed' or (r.status = 'reserved' and r.reserved_at > v_stale_before));
    if v_live >= v_cap then
      raise exception 'promo_exhausted';
    end if;
  end if;

  if v_code.once_per_customer and p_user_id is not null and exists (
    select 1 from public.promo_code_redemptions r
     where r.promo_code_id = p_promo_code_id
       and r.user_id = p_user_id
       and (r.status = 'redeemed' or (r.status = 'reserved' and r.reserved_at > v_stale_before))
  ) then
    raise exception 'promo_already_used';
  end if;

  insert into public.promo_code_redemptions (promo_code_id, user_id, buyer_email, discount_cents, status)
  values (p_promo_code_id, p_user_id, p_email, greatest(coalesce(p_discount_cents, 0), 0), 'reserved')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.reserve_promo_code(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_promo_code(uuid, uuid, text, integer) to service_role;
