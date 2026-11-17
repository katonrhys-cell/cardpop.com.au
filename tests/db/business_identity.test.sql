-- business_identity(): anon gets exactly the legal name and the ABN digits of
-- the invoice supplier setting — never its address, phone, email or footer
-- note — while the table itself stays unreadable to anon.
\set ON_ERROR_STOP on
insert into public.platform_settings (key, value) values
  ('invoice_supplier_details', '{"legal_name":"  Example Cards Pty Ltd ","abn":"51 824 753 556","address":"1 Private St","phone":"0400 000 000","email":"owner@example.test","footer_note":"private"}'::jsonb);
set role anon;
do $$
declare t jsonb := public.business_identity();
begin
  if t <> '{"legal_name": "Example Cards Pty Ltd", "abn": "51824753556"}'::jsonb then
    raise exception 'unexpected identity: %', t;
  end if;
  if (select count(*) from public.platform_settings) <> 0 then
    raise exception 'anon can read platform_settings directly';
  end if;
end $$;
reset role;

-- A half-typed ABN is not published; a blank name stays blank.
update public.platform_settings
  set value = '{"legal_name":"","abn":"51 824 753"}'::jsonb where key = 'invoice_supplier_details';
do $$
declare t jsonb := public.business_identity();
begin
  if t <> '{"legal_name": "", "abn": ""}'::jsonb then raise exception 'unexpected identity for a partial row: %', t; end if;
end $$;

-- A malformed (non-object) value and a missing row both come back empty.
update public.platform_settings set value = '"CardPop"'::jsonb where key = 'invoice_supplier_details';
do $$
begin
  if public.business_identity() <> '{"legal_name": "", "abn": ""}'::jsonb then raise exception 'non-object value leaked'; end if;
end $$;
delete from public.platform_settings where key = 'invoice_supplier_details';
do $$
begin
  if public.business_identity() <> '{"legal_name": "", "abn": ""}'::jsonb then raise exception 'missing row not empty'; end if;
end $$;
select 'business_identity: ok' as result;
