-- Remove the Gamegenic Just Sleeves BOARD GAME line from the shop.
--
-- CardPop stocks trading card supplies only. The board-game sleeve sizes
-- (Standard American, Standard European, Mini European, Mini American — the
-- seven styles of family GG-JS-BOARD-GAME, added as drafts by
-- 20261111100255_seed_gamegenic_just_sleeves_drafts.sql) don't fit trading
-- cards, so they go. The trading-card sizes from that batch stay: Soft and
-- Inner sleeves, Standard Card Game 66 x 92 (50 and the 250 value pack) and
-- Japanese Size 62 x 89.
--
-- Their shop_product_costs rows (cost + Amazon supplier link) go with them:
-- every reference to shop_products cascades on delete. They were never sold.
--
-- Idempotent: deleting rows that are already gone is a no-op.

delete from public.shop_products
where family_sku = 'GG-JS-BOARD-GAME'
  and brand = 'Gamegenic';
