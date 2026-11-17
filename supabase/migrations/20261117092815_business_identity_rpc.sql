-- Public read of who operates CardPop (legal name + ABN), for the bot
-- prerenderer.
--
-- The About, Contact and Terms pages now show the operating entity and its
-- ABN. The browser gets them from the public settings endpoint
-- (src/routes/settings.js); api/prerender.js reads with the anon key, and
-- platform_settings is admin-only under RLS — so, like shop_shipping_terms(),
-- this exposes exactly the two public fields of the `invoice_supplier_details`
-- setting (Admin → Invoices → Invoice details) and nothing else: the address,
-- phone, email and footer note on that row stay private.
--
-- The ABN is returned as its digits only, and only when there are exactly 11;
-- the caller (utils/businessIdentity.js) applies the ATO checksum before
-- showing it. An unset or malformed row comes back as empty strings.

create or replace function public.business_identity()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'legal_name', coalesce((
      select left(btrim(s.value ->> 'legal_name'), 120)
      from public.platform_settings s
      where s.key = 'invoice_supplier_details' and jsonb_typeof(s.value) = 'object'
    ), ''),
    'abn', coalesce((
      select case
        when regexp_replace(coalesce(s.value ->> 'abn', ''), '\D', '', 'g') ~ '^[0-9]{11}$'
          then regexp_replace(s.value ->> 'abn', '\D', '', 'g')
        else ''
      end
      from public.platform_settings s
      where s.key = 'invoice_supplier_details' and jsonb_typeof(s.value) = 'object'
    ), '')
  );
$$;

revoke all on function public.business_identity() from public;
grant execute on function public.business_identity() to anon, authenticated, service_role;
