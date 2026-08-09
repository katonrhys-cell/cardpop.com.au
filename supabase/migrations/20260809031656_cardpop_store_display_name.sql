-- The storefront account's display_name was left as 'admin' — the provisioning
-- migration (20260806064711) only fills display_name when it is EMPTY, and the
-- account had been created with 'admin' already set. That name then surfaced
-- as the Owner / Seller on every listing the platform sells.
--
-- Product pages now brand this account "Official CardPop Store" client-side
-- (lib/sellerIdentity.js keys off is_admin), but display_name still shows in
-- chat, marketplace tiles and search — so fix the data too. Only the literal
-- 'admin'/'Admin' value is replaced, so a deliberately chosen future name is
-- never overwritten on re-run.
update public.profiles p
   set display_name = 'CardPop',
       updated_at   = now()
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'admin@cardpop.com.au'
   and lower(coalesce(p.display_name, '')) in ('', 'admin');
