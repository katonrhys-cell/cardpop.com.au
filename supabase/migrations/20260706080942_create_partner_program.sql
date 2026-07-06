-- Partner program: local game stores / content creators apply for a referral
-- code that gives their audience a discount at checkout and earns them a
-- commission on referred shop orders and seller-subscription first payments.
--
-- Applications land as status=pending (written by the backend service role,
-- one per user) and are approved from the admin dashboard, where the admin
-- sets the final code and the per-partner discount / commission rates.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  partner_type text not null check (partner_type in ('local_game_store', 'content_creator', 'other')),
  business_name text not null,
  website text,
  socials text,
  abn text,
  phone text,
  pitch text,
  -- What the applicant asked for; `code` is what the admin actually issues.
  preferred_code text,
  code text unique,
  discount_pct numeric(5,2) not null default 10 check (discount_pct >= 0 and discount_pct <= 100),
  commission_pct numeric(5,2) not null default 5 check (commission_pct >= 0 and commission_pct <= 100),
  free_shipping boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Optional link to the store's /card-shops directory listing.
  local_game_store_id uuid references public.local_game_stores (id) on delete set null,
  clicks integer not null default 0,
  admin_notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Codes are matched case-insensitively at checkout; store them uppercase and
-- enforce uniqueness regardless of case.
create unique index if not exists partners_code_upper_idx
  on public.partners (upper(code)) where code is not null;

alter table public.partners enable row level security;

-- A partner can read their own row (application status, code, rates).
drop policy if exists "Partners can read own row" on public.partners;
create policy "Partners can read own row"
  on public.partners for select
  to authenticated
  using (user_id = auth.uid());

-- Admins moderate applications from the admin dashboard (anon-key client, so
-- RLS applies) — mirrors the admin policies on public.local_game_stores.
drop policy if exists "Admins can read all partners" on public.partners;
create policy "Admins can read all partners"
  on public.partners for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "Admins can update partners" on public.partners;
create policy "Admins can update partners"
  on public.partners for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- No insert policy: applications go through the backend (service role,
-- bypasses RLS) so they can be validated and rate limited.

-- Commission ledger: one row per referred purchase. Written by the backend
-- (service role) from the Stripe webhooks; paid out via Stripe transfers.
create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  kind text not null check (kind in ('shop_order', 'subscription')),
  order_id uuid references public.orders (id) on delete set null,
  referred_user_id uuid,
  -- All amounts in cents. sale_amount is the commission base: the referred
  -- item subtotal AFTER the code's discount (fees/GST/shipping excluded).
  sale_amount_cents integer not null check (sale_amount_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  commission_pct numeric(5,2) not null,
  commission_cents integer not null check (commission_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'reversed')),
  stripe_transfer_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Webhook retries must not double-book a commission.
create unique index if not exists partner_referrals_order_idx
  on public.partner_referrals (order_id) where order_id is not null;
-- A referred user's subscription earns a commission once, ever.
create unique index if not exists partner_referrals_subscription_user_idx
  on public.partner_referrals (referred_user_id) where kind = 'subscription';
create index if not exists partner_referrals_partner_idx
  on public.partner_referrals (partner_id);

alter table public.partner_referrals enable row level security;

drop policy if exists "Partners can read own referrals" on public.partner_referrals;
create policy "Partners can read own referrals"
  on public.partner_referrals for select
  to authenticated
  using (
    exists (
      select 1 from public.partners p
      where p.id = partner_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read all referrals" on public.partner_referrals;
create policy "Admins can read all referrals"
  on public.partner_referrals for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Referral-link click counter, incremented from the public tracking endpoint.
-- Security definer (like increment_wallet_balance) so the backend can bump it
-- atomically without a read-modify-write race.
create or replace function public.increment_partner_clicks(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.partners
  set clicks = clicks + 1, updated_at = now()
  where upper(code) = upper(p_code) and status = 'approved';
$$;

revoke all on function public.increment_partner_clicks(text) from public;
grant execute on function public.increment_partner_clicks(text) to service_role;
