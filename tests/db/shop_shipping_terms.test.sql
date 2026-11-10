-- shop_shipping_terms(): anon gets exactly the two shipping keys, coerced to
-- numbers, while the table itself stays unreadable to anon.
\set ON_ERROR_STOP on
set role anon;
do $$
declare t jsonb := public.shop_shipping_terms();
begin
  if t <> '{"default_shipping_rate_aud": 15, "free_shipping_threshold_aud": 100}'::jsonb then
    raise exception 'unexpected terms: %', t;
  end if;
  if (select count(*) from public.platform_settings) <> 0 then
    raise exception 'anon can read platform_settings directly';
  end if;
end $$;
reset role;

-- A malformed value comes back null (the caller falls back to the default).
update public.platform_settings set value = '"free"'::jsonb where key = 'default_shipping_rate_aud';
delete from public.platform_settings where key = 'free_shipping_threshold_aud';
do $$
declare t jsonb := public.shop_shipping_terms();
begin
  if t <> '{"default_shipping_rate_aud": null, "free_shipping_threshold_aud": null}'::jsonb then
    raise exception 'unexpected terms for malformed/missing rows: %', t;
  end if;
end $$;
select 'shop_shipping_terms: ok' as result;
