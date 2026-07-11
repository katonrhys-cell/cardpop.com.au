-- Seed placeholder accessory products for the new Shop dropdown categories
-- (Protection / Storage / Display / Shipping / Grading). Each row is a normal
-- editable shop_products record — admins can update title, price, stock, images
-- and status from /admin/products, or delete any they don't stock.
--
-- The `category` value matches the leaf category name in utils/shopCategories.js
-- exactly, so each product surfaces on its /shop/category/<slug> page (which
-- matches on category via ILIKE). Prices/stock are placeholders to review.
--
-- Idempotent: each row is keyed by its unique slug and only inserted if a
-- product with that slug doesn't already exist, so re-running is a no-op and
-- won't duplicate or overwrite edits made in the admin portal.

insert into public.shop_products (title, description, price_aud, stock_quantity, product_type, category, slug, status)
select v.title, v.description, v.price_aud, v.stock_quantity, 'accessory', v.category, v.slug, 'active'
from (values
  -- ── Protection ──────────────────────────────────────────────────────────────
  ('Penny Sleeves - 100 Pack',  'Soft, acid-free penny sleeves for everyday storage and double-sleeving. Bulk 100-count pack.', 4.99,  100, 'Penny Sleeves', 'penny-sleeves-100-pack'),
  ('Penny Sleeves - 500 Pack',  'Soft, acid-free penny sleeves. Value 500-count bulk pack.', 19.99, 60,  'Penny Sleeves', 'penny-sleeves-500-pack'),
  ('Penny Sleeves - 1000 Pack', 'Soft, acid-free penny sleeves. Bulk 1000-count carton for high-volume sellers.', 34.99, 40, 'Penny Sleeves', 'penny-sleeves-1000-pack'),
  ('Premium Matte Sleeves - 100 Pack', 'Matte-finish premium deck sleeves with a durable, anti-glare back. 100-count pack.', 12.99, 80, 'Premium Sleeves', 'premium-matte-sleeves-100-pack'),
  ('Premium Gloss Sleeves - 100 Pack', 'Glossy premium deck sleeves with a clear front and coloured back. 100-count pack.', 11.99, 80, 'Premium Sleeves', 'premium-gloss-sleeves-100-pack'),
  ('Perfect Fit Sleeves - 100 Pack', 'Snug clear inner sleeves sized for standard cards — ideal for double-sleeving. 100-count.', 6.99, 90, 'Perfect Fit Sleeves', 'perfect-fit-sleeves-100-pack'),
  ('Perfect Fit Sleeves - 200 Pack', 'Snug clear inner sleeves for double-sleeving. Value 200-count pack.', 12.99, 70, 'Perfect Fit Sleeves', 'perfect-fit-sleeves-200-pack'),
  ('Top Loaders 3x4in - 25 Pack',  'Rigid PVC top loaders for standard trading cards. 25-count pack.', 9.99,  100, 'Top Loaders', 'top-loaders-25-pack'),
  ('Top Loaders 3x4in - 50 Pack',  'Rigid PVC top loaders for standard trading cards. 50-count pack.', 17.99, 80,  'Top Loaders', 'top-loaders-50-pack'),
  ('Top Loaders 3x4in - 100 Pack', 'Rigid PVC top loaders for standard trading cards. 100-count pack.', 32.99, 60, 'Top Loaders', 'top-loaders-100-pack'),
  ('Top Loaders 3x4in - 200 Pack', 'Rigid PVC top loaders for standard trading cards. Bulk 200-count pack.', 59.99, 40, 'Top Loaders', 'top-loaders-200-pack'),
  ('Magnetic Card Holder 35pt (One-Touch)',  'UV-protective one-touch magnetic holder for standard 35pt cards.', 4.99, 120, 'Magnetic Holders', 'magnetic-holder-35pt'),
  ('Magnetic Card Holder 55pt (One-Touch)',  'UV-protective one-touch magnetic holder for thicker 55pt cards.', 5.49, 100, 'Magnetic Holders', 'magnetic-holder-55pt'),
  ('Magnetic Card Holder 75pt (One-Touch)',  'UV-protective one-touch magnetic holder for 75pt cards.', 5.99, 90, 'Magnetic Holders', 'magnetic-holder-75pt'),
  ('Magnetic Card Holder 100pt (One-Touch)', 'UV-protective one-touch magnetic holder for thick 100pt cards and relics.', 6.99, 80, 'Magnetic Holders', 'magnetic-holder-100pt'),
  ('Card Savers I (Semi-Rigid) - 25 Pack', 'Semi-rigid card savers — the standard choice for safe grading submission. 25-count.', 9.99, 90, 'Card Savers', 'card-savers-25-pack'),
  ('Card Savers I (Semi-Rigid) - 50 Pack', 'Semi-rigid card savers for grading submission and mailing. 50-count pack.', 17.99, 70, 'Card Savers', 'card-savers-50-pack'),

  -- ── Storage ─────────────────────────────────────────────────────────────────
  ('550ct Cardboard Storage Box', 'Sturdy cardboard storage box holding around 550 sleeved cards.', 6.99, 80, 'Storage Boxes', 'storage-box-550ct'),
  ('800ct Cardboard Storage Box', 'Sturdy cardboard storage box holding around 800 sleeved cards.', 8.99, 70, 'Storage Boxes', 'storage-box-800ct'),
  ('3200ct Storage Box',          'Large-capacity storage box for around 3200 cards — ideal for bulk collections.', 19.99, 40, 'Storage Boxes', 'storage-box-3200ct'),
  ('9-Pocket Zip Binder (360 Cards)',     'Padded zip-close binder with 20 fixed 9-pocket pages holding 360 cards.', 29.99, 50, 'Binders', 'binder-9-pocket-zip'),
  ('12-Pocket Premium Binder (480 Cards)','Premium D-ring binder that holds up to 480 cards across 12-pocket pages.', 39.99, 40, 'Binders', 'binder-12-pocket-premium'),
  ('9-Pocket Binder Pages - 25 Pack',  'Side-loading 9-pocket binder pages fitting standard 3-ring binders. 25-count.', 9.99, 80, 'Pages', 'pages-9-pocket-25-pack'),
  ('9-Pocket Binder Pages - 100 Pack', 'Side-loading 9-pocket binder pages. Value 100-count pack.', 29.99, 50, 'Pages', 'pages-9-pocket-100-pack'),
  ('Tabbed Card Box Dividers - 25 Pack', 'Write-on tabbed dividers for sorting storage boxes by set or player. 25-count.', 12.99, 60, 'Dividers', 'dividers-25-pack'),

  -- ── Display ─────────────────────────────────────────────────────────────────
  ('Acrylic Card Stand - Single', 'Clear acrylic easel stand for displaying a single raw or top-loaded card.', 3.99, 100, 'Acrylic Stands', 'acrylic-stand-single'),
  ('Acrylic Card Stand - 5 Pack', 'Clear acrylic easel stands for displaying cards. Value 5-pack.', 14.99, 70, 'Acrylic Stands', 'acrylic-stand-5-pack'),
  ('UV Acrylic Display Case (35pt)', 'UV-resistant acrylic screw-down display case for standard 35pt cards.', 12.99, 60, 'Display Cases', 'display-case-uv-35pt'),
  ('Graded Slab Display Case',       'Acrylic display case sized to hold a PSA/BGS/SGC graded slab.', 14.99, 50, 'Display Cases', 'display-case-graded-slab'),
  ('Acrylic Wall Mount - Single Card', 'Wall-mounted acrylic holder to display one card. Fixings included.', 9.99, 60, 'Wall Mounts', 'wall-mount-single'),
  ('Acrylic Wall Mount - 3 Pack',      'Wall-mounted acrylic card holders. Value 3-pack.', 24.99, 40, 'Wall Mounts', 'wall-mount-3-pack'),
  ('Floating Frame - Single Card',  'Frameless floating display frame that suspends a card between two clear panes.', 11.99, 60, 'Floating Frames', 'floating-frame-single'),
  ('Floating Frame - Graded Slab',  'Floating display frame sized for a graded slab.', 16.99, 45, 'Floating Frames', 'floating-frame-graded'),

  -- ── Shipping ────────────────────────────────────────────────────────────────
  ('Team Bags (Resealable) - 100 Pack', 'Resealable outer bags that fit a sleeved or top-loaded card. 100-count.', 5.99, 90, 'Team Bags', 'team-bags-100-pack'),
  ('Team Bags (Resealable) - 500 Pack', 'Resealable outer bags for sleeved cards. Bulk 500-count pack.', 22.99, 50, 'Team Bags', 'team-bags-500-pack'),
  ('Bubble Mailers - 10 Pack', 'Padded bubble mailers for posting cards safely. 10-count pack.', 9.99, 80, 'Bubble Mailers', 'bubble-mailers-10-pack'),
  ('Bubble Mailers - 25 Pack', 'Padded bubble mailers for posting cards. Value 25-count pack.', 19.99, 60, 'Bubble Mailers', 'bubble-mailers-25-pack'),
  ('Rigid Cardboard Mailers - 25 Pack', 'Rigid cardboard mailers that protect graded slabs and top-loaders in transit. 25-count.', 14.99, 60, 'Cardboard Mailers', 'cardboard-mailers-25-pack'),
  ('Rigid Cardboard Mailers - 50 Pack', 'Rigid cardboard mailers for graded slabs and top-loaders. 50-count pack.', 24.99, 40, 'Cardboard Mailers', 'cardboard-mailers-50-pack'),
  ('Clear Packing Tape - 2 Roll Pack', 'Strong clear packing tape for sealing mailers and parcels. 2-roll pack.', 7.99, 70, 'Packing Tape', 'packing-tape-2-pack'),
  ('Graded Slab Protective Sleeves - 25 Pack', 'Snug protective sleeves that shield graded slabs from scuffs during storage and postage. 25-count.', 12.99, 60, 'Graded Card Protectors', 'graded-protectors-25-pack'),

  -- ── Grading ─────────────────────────────────────────────────────────────────
  ('CardPop PSA Submission Kit', 'Everything you need to submit cards for grading: card savers, penny sleeves, team bags, bubble wrap, cardboard protectors, packing instructions and a submission checklist.', 27.99, 40, 'Submission Kits', 'submission-kit-psa'),
  ('CardPop Grading Starter Kit', 'A lighter grading prep kit: penny sleeves, card savers, team bags and a submission checklist to get you started.', 19.99, 50, 'Submission Kits', 'submission-kit-starter'),
  ('Anti-Static Cleaning Cloth - 3 Pack', 'Anti-static cloths for gently removing dust and fingerprints before grading. 3-pack.', 8.99, 70, 'Cleaning Cloths', 'cleaning-cloths-3-pack'),
  ('Cotton Inspection Gloves - 5 Pairs', 'Lint-free cotton gloves for handling raw cards without leaving fingerprints. 5 pairs.', 7.99, 80, 'Gloves', 'gloves-cotton-5-pairs'),
  ('Nitrile Handling Gloves - 50 Pack', 'Powder-free nitrile gloves for clean card handling. 50-count box.', 12.99, 60, 'Gloves', 'gloves-nitrile-50-pack'),
  ('Premium Microfiber Cloth - 5 Pack', 'Lint-free premium microfiber cloths for polishing card surfaces and slabs. 5-pack.', 11.99, 70, 'Microfiber Cloths', 'microfiber-cloths-5-pack'),
  ('Card Centering Tool', 'Transparent overlay tool for measuring a card''s centering before submitting for grading.', 14.99, 55, 'Centering Tools', 'centering-tool'),
  ('Digital Centering Gauge', 'Precision gauge for measuring border centering to help estimate a likely grade.', 24.99, 35, 'Centering Tools', 'centering-gauge-digital')
) as v(title, description, price_aud, stock_quantity, category, slug)
where not exists (
  select 1 from public.shop_products p where p.slug = v.slug
);
