-- Soft-disable account status for the admin "Delete Account" action, which was
-- previously a disabled no-op ("Delete Account (unavailable)") requiring a
-- service-role backend endpoint. Per the confirmed decision, "delete" means a
-- permanent-looking soft-disable — not row deletion: keep all historical
-- orders/listings/reviews intact, but block the account from signing in again.
--
-- Kept as its own flag alongside the existing profiles.is_active (rather than
-- folding into a single status enum) because is_active already has independent
-- meaning read by several public-facing queries (e.g. HomePage's featured
-- sellers, SellersManagementPage) as "visible in public listings" — reusing it
-- to also mean "deleted" would conflate two different concerns. A deleted
-- account always has is_active = false too (enforced by the app), so every
-- existing is_active check already stops surfacing it.
alter table public.profiles
  add column if not exists is_deleted boolean not null default false;

comment on column public.profiles.is_deleted is
  'Set by an admin "Delete Account" action — a permanent soft-disable (auth login blocked via Supabase admin ban), not a row deletion. Historical data is retained.';
