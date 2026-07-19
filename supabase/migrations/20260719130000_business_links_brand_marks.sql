-- Point the Stripe and Google Workspace tools at their real brand marks.
-- The "Building your business" page now renders inline, full-colour brand SVGs
-- for these two (BRAND_ICONS registry in pages/community/BuildingYourBusinessPage.jsx)
-- instead of the generic lucide CreditCard / Briefcase icons. The page recognises
-- the icon names 'Stripe' and 'Google'; every other value still falls back to a
-- lucide icon (or Sparkles), so this change is limited to these two rows.
-- Idempotent: safe to re-run.
UPDATE business_affiliate_links SET icon = 'Stripe' WHERE slug = 'stripe';
UPDATE business_affiliate_links SET icon = 'Google' WHERE slug = 'google-workspace';
