-- Give every Palms Off Gaming product a primary image.
--
-- The range was seeded with its full photo gallery in `images` but with
-- `image_url` left null. Grids read `images[0]` first, but other surfaces
-- (cart, admin lists, social previews) read `image_url` alone, so fill it with
-- the gallery's first photo (the hero shot, per data/palmsOffCatalogue.js and
-- data/shopBinderProducts.js).
--
-- Idempotent and non-destructive: only rows with no primary image are touched,
-- so an image an admin has since set in Admin → Products is never overwritten.

update public.shop_products
set image_url = images->>0, updated_at = now()
where brand = 'Palms Off Gaming'
  and image_url is null
  and jsonb_typeof(images) = 'array'
  and jsonb_array_length(images) > 0;
