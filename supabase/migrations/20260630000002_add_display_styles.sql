-- Vault "Display Styles" — the Card Showcase Engine.
--
-- Two new columns power a single feature: every vault listing can be rendered
-- with a chosen visual treatment (Classic Flat → Holographic), and which
-- treatments a user may pick depends on their subscription tier.
--
-- 1. profiles.subscription_tier — the membership level that gates premium
--    display styles. This is a NEW concept, distinct from `seller_tier`
--    (which is reputation earned through sales). Billing is not wired up yet,
--    so everyone defaults to 'free'; the column exists now so the frontend
--    access checks have a real value to read.
--
-- 2. vault_items.display_style — the showcase style chosen for a listing.
--    Defaults to 'classic', the always-free baseline, so every existing and
--    future listing renders correctly even if no style was ever selected.
--
-- IMPORTANT: the application code that reads/writes these columns ships in the
-- same change set — apply this migration BEFORE (or together with) that deploy.

-- ── profiles.subscription_tier ──────────────────────────────────────────────
alter table public.profiles
  add column if not exists subscription_tier text not null default 'free';

-- Keep the value within the known ladder. Cumulative access ranking is:
--   free < pro < premium < elite < ultimate
alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;
alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'pro', 'premium', 'elite', 'ultimate'));

-- ── vault_items.display_style ───────────────────────────────────────────────
alter table public.vault_items
  add column if not exists display_style text not null default 'classic';

-- Mirror the registry in lib/displayStyles.js. A bad/legacy value must never
-- break rendering, so the frontend also coerces unknown values back to
-- 'classic'; the constraint here is the defence-in-depth at the data layer.
alter table public.vault_items
  drop constraint if exists vault_items_display_style_check;
alter table public.vault_items
  add constraint vault_items_display_style_check
  check (display_style in (
    'classic', 'stand', 'floating', 'glass', 'slab', 'rotating', 'holographic'
  ));

-- Backfill any rows that predate the column / arrived NULL via bulk import.
update public.vault_items
  set display_style = 'classic'
  where display_style is null;
