-- Admin-editable shop categories.
--
-- The built-in taxonomy (sections → leaf categories) lives in code,
-- utils/shopCategories.js, because each entry carries icons, gradients and SEO
-- copy. This table is an overlay on top of it, edited from Admin → Products →
-- Categories:
--
--   • hidden = false → an extra leaf category under an existing section
--     (section_slug = the group's slug: protection, storage, display, shipping,
--     grading). It shows in the Shop menu, the /shop/category/<slug> page and
--     the admin product form's picker.
--   • hidden = true  → removes the built-in (or custom) category of that name
--     from the menu and pickers. Deleting the row restores it.
--
-- `name` is exactly what gets stored in shop_products.category, so removing a
-- category never touches products — they just show under "Other" in the admin
-- list until they're moved.

CREATE TABLE IF NOT EXISTS shop_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The built-in groups in utils/shopCategories.js.
  section_slug text NOT NULL CHECK (section_slug IN ('protection', 'storage', 'display', 'shipping', 'grading')),
  -- Plain characters only: names are matched with ILIKE and inside PostgREST
  -- .or() filters on the storefront, where commas, % and brackets would break.
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 60 AND name ~ '^[A-Za-z0-9][A-Za-z0-9 &''+/-]*$'),
  description  text CHECK (description IS NULL OR length(description) <= 200),
  hidden       boolean NOT NULL DEFAULT false,
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per category name, case-insensitively (a name is either added or
-- hidden, never both).
CREATE UNIQUE INDEX IF NOT EXISTS shop_categories_name_key
  ON shop_categories (lower(btrim(name)));

ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;

-- Public read: the storefront Shop menu merges these rows for every visitor.
DROP POLICY IF EXISTS shop_categories_public_read ON shop_categories;
CREATE POLICY shop_categories_public_read
  ON shop_categories FOR SELECT USING (true);

-- Admin-only writes (inlined profiles.is_admin check — the repo convention).
DROP POLICY IF EXISTS admin_manage_shop_categories ON shop_categories;
CREATE POLICY admin_manage_shop_categories
  ON shop_categories FOR ALL
  USING     (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
