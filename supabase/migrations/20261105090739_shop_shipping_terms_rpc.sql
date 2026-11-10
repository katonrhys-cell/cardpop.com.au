-- Public read of the two shop shipping settings, for the bot prerenderer.
--
-- api/prerender.js reads with the anon key, and platform_settings is admin-only
-- under RLS. The product pages' structured data now carries `shippingDetails`
-- (utils/productShippingLd.js), which must quote the same flat rate and
-- free-shipping threshold the checkout charges (src/services/cartService.js) —
-- an admin edit in Admin → Settings has to reach the markup without a deploy,
-- or Merchant Center flags a shipping mismatch. This exposes exactly those two
-- keys (both already public through GET /settings/public) and nothing else.
--
-- Values are stored as jsonb numbers or strings ('15'); a malformed value
-- comes back null and the caller falls back to the checkout default.

create or replace function public.shop_shipping_terms()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'default_shipping_rate_aud', (
      select case when (s.value #>> '{}') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then (s.value #>> '{}')::numeric end
      from public.platform_settings s where s.key = 'default_shipping_rate_aud'
    ),
    'free_shipping_threshold_aud', (
      select case when (s.value #>> '{}') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then (s.value #>> '{}')::numeric end
      from public.platform_settings s where s.key = 'free_shipping_threshold_aud'
    )
  );
$$;

revoke all on function public.shop_shipping_terms() from public;
grant execute on function public.shop_shipping_terms() to anon, authenticated, service_role;
