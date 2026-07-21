-- Admin-managed affiliate PRODUCTS surfaced at the bottom of the shop pages
-- (/shop and /shop/category/:slug). Each row is an external product CardPop
-- recommends and earns a commission on — starting with Amazon Associates, but
-- `network` keeps it open to other affiliate programs later.
--
-- These are display-only promo cards: no cart, no Stripe, no inventory. They
-- link straight out to the retailer with a sponsored/nofollow rel. An optional
-- free-text `category` lets a product be scoped to a matching shop category
-- page; rows with a NULL category are "general" and show everywhere.
--
-- Public read is limited to published rows; only admins can write.

CREATE TABLE IF NOT EXISTS shop_affiliate_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  image_url     text,
  price_label   text,                       -- free text, e.g. "$29.99" or "From $19" (display only)
  network       text NOT NULL DEFAULT 'amazon',
  affiliate_url text NOT NULL,
  cta_label     text NOT NULL DEFAULT 'View on Amazon',
  badge         text,                        -- optional pill, e.g. "Best seller"
  category      text,                        -- optional: scope to a shop category name; NULL = show everywhere
  sort_order    integer NOT NULL DEFAULT 0,
  is_published  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_affiliate_products_sort_idx
  ON shop_affiliate_products (sort_order, title);

-- Category lookups are case-insensitive ILIKE matches from the category pages.
CREATE INDEX IF NOT EXISTS shop_affiliate_products_category_idx
  ON shop_affiliate_products (lower(category));

ALTER TABLE shop_affiliate_products ENABLE ROW LEVEL SECURITY;

-- Public can read published products only.
DROP POLICY IF EXISTS "shop_affiliate_products_public_read" ON shop_affiliate_products;
CREATE POLICY "shop_affiliate_products_public_read"
  ON shop_affiliate_products
  FOR SELECT
  USING (is_published = true);

-- Admins can read (incl. drafts) and manage everything.
DROP POLICY IF EXISTS "admin_manage_shop_affiliate_products" ON shop_affiliate_products;
CREATE POLICY "admin_manage_shop_affiliate_products"
  ON shop_affiliate_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
