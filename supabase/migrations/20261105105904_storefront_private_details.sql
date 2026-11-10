-- Storefront details are public only when the seller chose to show them.
-- A seller's ABN, email and phone are never public.
--
-- 1. profiles.abn — a sole trader enters their ABN for tax invoices, and the
--    store page (/dealer/:slug) used to print it, because the column was in
--    the public column grant (20260715210000). It leaves that grant; the
--    owner reads their own through get_my_abn(). Writing it is unchanged.
--
-- 2. business_profiles — the admin-curated retailer directory. It still had
--    Supabase's default table-wide grants, so any visitor could read an
--    approved row's email, phone, ABN and review notes. Worse, a signed-in
--    user could insert or update their own row with storefront_status =
--    'approved' and list themselves as an approved retailer. Every write
--    already goes through the admin API (service role, src/routes/admin.js),
--    so the browser keeps read access to the public columns only.
--
-- Test: tests/db/run-storefront-private-details-migration.sh.

-- ── 1. profiles.abn ──────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'abn') then
    revoke select (abn) on public.profiles from anon, authenticated;
  end if;
end;
$$;

create or replace function public.get_my_abn()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select abn from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.get_my_abn() from public, anon;
grant execute on function public.get_my_abn() to authenticated;

-- ── 2. business_profiles ─────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.business_profiles') is null then
    return;
  end if;

  revoke all on public.business_profiles from anon, authenticated;
  grant select (
    id, user_id, business_name, business_type, established_year,
    storefront_status, storefront_slug, tagline, about, banner_url, logo_url,
    website_url, instagram_handle, facebook_url, has_physical_store,
    store_address, store_suburb, store_state, store_postcode, opening_hours,
    specialises_in, total_listings, total_sales, created_at, updated_at
  ) on public.business_profiles to anon, authenticated;

  drop policy if exists "Users can create their own business profile" on public.business_profiles;
  drop policy if exists "Users can update their own business profile" on public.business_profiles;
end;
$$;
