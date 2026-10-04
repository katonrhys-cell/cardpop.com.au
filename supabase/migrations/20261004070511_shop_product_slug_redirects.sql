-- Shop product slug redirects + SEO slug clean-up.
--
-- 1. `shop_product_slug_redirects`: every slug a shop product used to have,
--    pointing at the product it now belongs to. A BEFORE trigger on
--    shop_products records the old slug whenever a slug changes, so renaming a
--    product in Admin → Products never strands a URL Google has indexed: the
--    SPA (pages/shop/ShopListedProductPage.jsx) and api/prerender.js look an
--    unknown slug up here and 301 to the product's current URL
--    (shopSlugRedirectTarget() in utils/shopProductUrl.js).
--
-- 2. Rename the Palms Off Gaming playmat line to its real product name, "Core
--    Playmat" (it's what the packaging says and what people search for), and
--    rewrite the CardPop house-product slugs so they mirror the product title
--    in natural word order ("9-Pocket Zip Binder" → 9-pocket-zip-binder, not
--    binder-9-pocket-zip). SKUs are untouched: shop_products_normalise_sku only
--    derives a CP-… SKU when the column is blank.
--
-- Idempotent: the renames key on the old slug, so a re-run finds nothing.

create table if not exists public.shop_product_slug_redirects (
  old_slug   text primary key,
  product_id uuid not null references public.shop_products(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.shop_product_slug_redirects is
  'Former slugs of shop products. Filled by trigger when shop_products.slug changes; the SPA and prerender 301 an old slug to the product''s current /shop/<category>/<slug> URL.';

create index if not exists shop_product_slug_redirects_product_id_idx
  on public.shop_product_slug_redirects (product_id);

alter table public.shop_product_slug_redirects enable row level security;

drop policy if exists "Slug redirects are public" on public.shop_product_slug_redirects;
create policy "Slug redirects are public"
  on public.shop_product_slug_redirects for select
  using (true);

grant select on public.shop_product_slug_redirects to anon, authenticated;

-- Record the previous slug on every rename; a slug that becomes live again
-- (a product renamed back, or a new product taking an old slug) must not keep
-- redirecting away from itself. SECURITY DEFINER so the admin UI's
-- (RLS-restricted) session can still write the redirect row.
create or replace function public.shop_products_record_slug_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.slug is not null and btrim(old.slug) <> ''
     and new.slug is distinct from old.slug then
    insert into public.shop_product_slug_redirects (old_slug, product_id)
    values (old.slug, new.id)
    on conflict (old_slug) do update
      set product_id = excluded.product_id, created_at = now();
  end if;
  if new.slug is not null then
    delete from public.shop_product_slug_redirects where old_slug = new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_products_record_slug_change on public.shop_products;
create trigger shop_products_record_slug_change
  before insert or update of slug on public.shop_products
  for each row execute function public.shop_products_record_slug_change();

-- ── Palms Off Gaming Core Playmat ───────────────────────────────────────────
-- One row per colour (family_sku PM-ST); the line page is
-- /shop/playmats/palms-off-gaming-core-playmat (data/palmsOffCatalogue.js).
update public.shop_products
set slug = replace(slug, 'palms-off-gaming-playmat-', 'palms-off-gaming-core-playmat-')
where slug like 'palms-off-gaming-playmat-%';

update public.shop_products
set title = replace(title, 'Palms Off Gaming Playmat', 'Palms Off Gaming Core Playmat'),
    description = replace(description, 'Palms Off Gaming Playmat', 'Palms Off Gaming Core Playmat')
where family_sku = 'PM-ST'
  and (title like '%Palms Off Gaming Playmat%' or description like '%Palms Off Gaming Playmat%');

-- ── CardPop house products: slug mirrors the title ──────────────────────────
update public.shop_products as p
set slug = r.new_slug
from (values
  ('acrylic-stand-5-pack',        'acrylic-card-stand-5-pack'),
  ('acrylic-stand-single',        'acrylic-card-stand-single'),
  ('binder-12-pocket-premium',    '12-pocket-premium-binder'),
  ('binder-9-pocket-zip',         '9-pocket-zip-binder'),
  ('cardboard-mailers-25-pack',   'rigid-cardboard-mailers-25-pack'),
  ('cardboard-mailers-50-pack',   'rigid-cardboard-mailers-50-pack'),
  ('centering-gauge-digital',     'digital-centering-gauge'),
  ('centering-tool',              'card-centering-tool'),
  ('cleaning-cloths-3-pack',      'anti-static-cleaning-cloth-3-pack'),
  ('display-case-graded-slab',    'graded-slab-display-case'),
  ('display-case-uv-35pt',        'uv-acrylic-display-case-35pt'),
  ('dividers-25-pack',            'tabbed-card-box-dividers-25-pack'),
  ('floating-frame-graded',       'floating-frame-graded-slab'),
  ('floating-frame-single',       'floating-frame-single-card'),
  ('gloves-cotton-5-pairs',       'cotton-inspection-gloves-5-pairs'),
  ('gloves-nitrile-50-pack',      'nitrile-handling-gloves-50-pack'),
  ('graded-protectors-25-pack',   'graded-slab-protective-sleeves-25-pack'),
  ('magnetic-holder-35pt',        'magnetic-card-holder-35pt'),
  ('magnetic-holder-55pt',        'magnetic-card-holder-55pt'),
  ('magnetic-holder-75pt',        'magnetic-card-holder-75pt'),
  ('magnetic-holder-100pt',       'magnetic-card-holder-100pt'),
  ('microfiber-cloths-5-pack',    'premium-microfiber-cloth-5-pack'),
  ('packing-tape-2-pack',         'clear-packing-tape-2-roll-pack'),
  ('pages-9-pocket-25-pack',      '9-pocket-binder-pages-25-pack'),
  ('pages-9-pocket-100-pack',     '9-pocket-binder-pages-100-pack'),
  ('storage-box-550ct',           '550ct-cardboard-storage-box'),
  ('storage-box-800ct',           '800ct-cardboard-storage-box'),
  ('storage-box-3200ct',          '3200ct-storage-box'),
  ('submission-kit-psa',          'psa-submission-kit'),
  ('submission-kit-starter',      'grading-starter-kit'),
  ('wall-mount-3-pack',           'acrylic-wall-mount-3-pack'),
  ('wall-mount-single',           'acrylic-wall-mount-single-card')
) as r(old_slug, new_slug)
where p.slug = r.old_slug
  and not exists (select 1 from public.shop_products q where q.slug = r.new_slug);
