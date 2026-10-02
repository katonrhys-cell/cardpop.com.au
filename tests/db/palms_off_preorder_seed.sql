-- Rows for the Palms Off pre-order data migration check (see run-preorder-migration.sh).
insert into public.shop_products (title, brand, price_aud, stock_quantity, status, preorder_eta) values
  ('POG soon priced',   'Palms Off Gaming', 19.95, 0, 'coming_soon', null),
  ('POG soon unpriced', 'Palms Off Gaming', 0,     0, 'coming_soon', null),
  ('POG archived',      'Palms Off Gaming', 9.95,  0, 'archived',    null),
  ('POG live',          'Palms Off Gaming', 29.95, 4, 'active',      null),
  ('POG custom eta',    'Palms Off Gaming', 39.95, 0, 'coming_soon', 'Expected mid-November'),
  ('House soon',        'CardPop',          5,     0, 'coming_soon', null);
