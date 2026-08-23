-- New Card Showcase display style: Spinning Stand (elite) — a Courtyard-style
-- continuous 360° revolve above the black CardPop turntable base. This only
-- widens the allowed-values CHECK on vault_items.display_style to mirror the
-- registry in lib/displayStyles.js — rendering, tier gating and the picker all
-- read from that registry, so no other schema change is needed. Backward
-- compatible: existing values remain valid, so this can land before the app
-- deploy that uses the new key.
alter table public.vault_items
  drop constraint if exists vault_items_display_style_check;
alter table public.vault_items
  add constraint vault_items_display_style_check
  check (display_style in (
    'classic', 'stand', 'floating', 'neon', 'glass', 'slab',
    'spotlight', 'rotating', 'spinning', 'prism', 'holographic'
  ));
