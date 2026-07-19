-- Point the recommended tools at their real brand marks. The "Building your
-- business" page now renders inline, full-colour brand SVGs (BRAND_ICONS registry
-- in pages/community/BuildingYourBusinessPage.jsx) instead of generic lucide
-- glyphs. The page recognises these icon names; any other value still falls back
-- to a lucide icon (or Sparkles), so the change is limited to these rows.
-- Idempotent: safe to re-run.
UPDATE business_affiliate_links SET icon = 'Stripe'  WHERE slug = 'stripe';
UPDATE business_affiliate_links SET icon = 'Google'  WHERE slug = 'google-workspace';
UPDATE business_affiliate_links SET icon = 'Whatnot' WHERE slug = 'whatnot';
UPDATE business_affiliate_links SET icon = 'Kit'     WHERE slug = 'kit';
-- The "Facebook & Instagram" card uses the Meta mark (parent of both platforms;
-- matches its "Explore Meta for Business" button).
UPDATE business_affiliate_links SET icon = 'Meta'    WHERE slug = 'facebook';
