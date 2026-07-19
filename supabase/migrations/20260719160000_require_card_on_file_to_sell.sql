-- Hobby (and Pro) sellers must have a card on file to list/sell/trade.
--
-- CardPop charges its fee when a sale or trade completes. For trades there are
-- no sale proceeds to net the fee from, so a saved payment method is required
-- before an account can sell or trade at all. The card is NEVER charged until a
-- transaction actually happens (it's saved via a Stripe `setup`-mode Checkout —
-- see src/routes/wallet.js `/save-card`).
--
-- We mirror "has a card on file" onto profiles.has_saved_card (kept in sync from
-- the Stripe webhook + the /wallet/payment-methods read), the same pattern used
-- for is_verified. can_sell() then requires BOTH identity verification and a
-- saved card. The RESTRICTIVE RLS policy on `listings` already calls can_sell(),
-- so it tightens automatically with no policy change.

-- ── Card-on-file flag ────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists has_saved_card boolean not null default false;

comment on column public.profiles.has_saved_card is
  'True when the user has at least one saved card on their Stripe customer. '
  'Mirrored from Stripe (setup-checkout webhook / payment-methods sync). '
  'Required, with is_verified, for can_sell().';

-- ── Selling gate now = identity verification AND a card on file ───────────────
create or replace function public.can_sell(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and coalesce(p.is_verified, false) = true
      and coalesce(p.has_saved_card, false) = true
  );
$$;

-- `create or replace` preserves grants, but re-assert them so this migration is
-- self-contained (matches 20260702000001_lockdown_can_sell_fn).
revoke execute on function public.can_sell(uuid) from public;
revoke execute on function public.can_sell(uuid) from anon;
grant  execute on function public.can_sell(uuid) to authenticated;
