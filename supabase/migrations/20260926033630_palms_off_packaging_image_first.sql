-- Palms Off Gaming products lead with their retail-packaging render.
--
-- The supplier's packaging shot ("…_pkg1.png", or "…_pkg.png" where a line has
-- only one) carries the Palms Off Gaming branding; the plain cover shot
-- ("…_front.png") that used to lead reads as a blank coloured rectangle in the
-- grid. Grids show images[0] and other surfaces read image_url, so both move.
--
-- 1. A trigger keeps it that way for every future insert or image change
--    (new colour products, admin uploads), so the rule can't drift.
-- 2. A one-off update reorders the existing rows.
--
-- Scoped to brand = 'Palms Off Gaming': the _pkg naming is that supplier's.
-- The rest of the gallery keeps its order. Idempotent — a row whose gallery
-- already starts with its packaging shot is left untouched.
-- Mirrored client-side by packagingFirst() in utils/shopFamily.js.

create or replace function public.shop_products_packaging_image_first()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pkg_ord bigint;
  reordered jsonb;
begin
  if new.brand is distinct from 'Palms Off Gaming' or jsonb_typeof(new.images) is distinct from 'array' then
    return new;
  end if;

  select min(e.ord) into pkg_ord
  from jsonb_array_elements_text(new.images) with ordinality as e(url, ord)
  where e.url ~* '_pkg1?\.(png|jpe?g|webp)$';

  if pkg_ord is null or pkg_ord = 1 then
    return new;
  end if;

  select jsonb_agg(to_jsonb(e.url) order by (e.ord <> pkg_ord), e.ord) into reordered
  from jsonb_array_elements_text(new.images) with ordinality as e(url, ord);

  -- Keep image_url in step when it was simply mirroring the old first photo.
  if new.image_url is null or new.image_url = new.images->>0 then
    new.image_url := reordered->>0;
  end if;
  new.images := reordered;
  return new;
end;
$$;

drop trigger if exists trg_shop_products_packaging_image_first on public.shop_products;
create trigger trg_shop_products_packaging_image_first
  before insert or update of images, brand on public.shop_products
  for each row execute function public.shop_products_packaging_image_first();

-- Existing rows: a no-op write of `images` fires the trigger, which reorders.
update public.shop_products p
set images = p.images, updated_at = now()
where p.brand = 'Palms Off Gaming'
  and jsonb_typeof(p.images) = 'array'
  and exists (
    select 1
    from jsonb_array_elements_text(p.images) with ordinality as e(url, ord)
    where e.url ~* '_pkg1?\.(png|jpe?g|webp)$' and e.ord > 1
  )
  and not ((p.images->>0) ~* '_pkg1?\.(png|jpe?g|webp)$');
