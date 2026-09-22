-- Every shop product carries a SKU.
--
-- Palms Off Gaming rows were seeded with the brand's SKUs; the ~50 CardPop
-- house products had none, and the admin form had no SKU field, so new
-- uploads couldn't get one either. This makes SKU a first-class,
-- always-present, unique identifier:
--
--   1. Backfill: a house product gets `CP-<SLUG>` (e.g. CP-ACRYLIC-STAND-5-PACK)
--      — slugs are unique, so these are too. A row with no slug falls back to
--      CP-<first 8 chars of its id>.
--   2. Normalise + default trigger: SKUs are stored trimmed and upper-cased;
--      an insert/update that leaves sku blank is given the same CP-… default,
--      so the column can be NOT NULL without breaking any writer that hasn't
--      learned about SKUs yet.
--   3. Unique (case-insensitive) index, then NOT NULL.
--
-- Idempotent: every step is guarded, and the backfill only touches null SKUs.

-- ── 1. Backfill ─────────────────────────────────────────────────────────────
update public.shop_products
set sku = 'CP-' || upper(regexp_replace(slug, '[^A-Za-z0-9]+', '-', 'g'))
where (sku is null or btrim(sku) = '')
  and slug is not null and btrim(slug) <> '';

update public.shop_products
set sku = 'CP-' || upper(left(replace(id::text, '-', ''), 8))
where sku is null or btrim(sku) = '';

-- ── 2. Normalise + default ──────────────────────────────────────────────────
create or replace function public.shop_products_normalise_sku()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.sku := upper(btrim(coalesce(new.sku, '')));
  if new.sku = '' then
    if new.slug is not null and btrim(new.slug) <> '' then
      new.sku := 'CP-' || upper(regexp_replace(new.slug, '[^A-Za-z0-9]+', '-', 'g'));
    else
      new.sku := 'CP-' || upper(left(replace(new.id::text, '-', ''), 8));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_products_normalise_sku on public.shop_products;
create trigger shop_products_normalise_sku
  before insert or update of sku, slug on public.shop_products
  for each row execute function public.shop_products_normalise_sku();

-- ── 3. Uniqueness + NOT NULL ────────────────────────────────────────────────
-- Any pre-existing case-duplicates would fail the unique index; there are
-- none today (Palms Off SKUs are distinct and CP-<slug> mirrors the unique
-- slug index), but normalise casing first so the index sees one spelling.
update public.shop_products set sku = upper(btrim(sku)) where sku <> upper(btrim(sku));

create unique index if not exists shop_products_sku_key
  on public.shop_products (upper(sku));

alter table public.shop_products alter column sku set not null;

comment on column public.shop_products.sku is
  'Stock-keeping unit. Brand SKU for wholesale lines (Palms Off Gaming), CP-<SLUG> for CardPop house products. Upper-cased and unique; auto-derived from slug/id when left blank.';
