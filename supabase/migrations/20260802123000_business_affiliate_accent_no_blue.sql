-- The branding guide has no blue: the brand palette is red / charcoal /
-- silver / light grey / white, and brand-blue was never defined in
-- tailwind.config.js — so the 'from-brand-red to-brand-blue' accent default
-- (and any stored rows using it) silently rendered with a missing gradient
-- endpoint. Repoint the default and existing rows at brand-charcoal.

alter table public.business_affiliate_links
  alter column accent set default 'from-brand-red to-brand-charcoal';

update public.business_affiliate_links
  set accent = replace(accent, 'brand-blue', 'brand-charcoal')
  where accent like '%brand-blue%';
