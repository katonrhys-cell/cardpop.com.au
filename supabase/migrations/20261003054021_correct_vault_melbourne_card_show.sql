-- Correct "The Vault – Melbourne Card & Collectible Show" against the live Megatix
-- listing (checked by hand): 70+ vendors (not 50+), giveaway worth over $1,500
-- (not $1,000), and the ticket prices that were missing from the first seed.
-- Early Bird / Second Release tiers are sold out; Final Release is the live tier.
-- Idempotent: a plain UPDATE keyed on the slug.

update public.events
set
  title = 'Vault – Melbourne Card & Collectible Show',
  short_description = 'VAULT Collector Show #1 — 70+ collector vendors of trading cards, sports cards, Pokémon, One Piece, TCG, toys and figures, plus a $1,500+ giveaway. Kids under 10 free.',
  description = E'VAULT – Collector Show #1. Melbourne, get ready: VAULT is opening.\n\nA brand-new collector show at the Melbourne Pavilion in Kensington, bringing together 70+ vendors across trading cards, sports cards, Pokémon, One Piece, TCG, slabs, singles, sealed product, toys, figures, apparel and unique collectibles — all under one roof. Whether you''re hunting your next grail, looking to trade, sell or rip packs, or just want to meet the collector community, VAULT is built for collectors.\n\nEarly entry from 9:00am (VIP), general trading hours 10:00am–6:00pm. Family-friendly — children under 10 enter free — with food and drinks on site.\n\nTickets: Final Release All Day Entry $20 (from 10am) and VIP Early Entry $30 (from 9am). Earlier release tiers have sold out.\n\nThe VAULT Giveaway — over $1,500 in prizes. Every ticket has a chance to win: enter the last 4 digits of your ticket number into the VAULT on site and you win the full contents of what''s inside. Prizes include sealed Pokémon, PSA slabs, pop figures, collectibles and more.',
  entry_fee_aud = 20,
  organizer_name = 'VAULT Collectibles',
  tags = array['Card Show','Sports Cards','Pokemon','One Piece','TCG','Slabs','Collectibles','Giveaway','Melbourne','Kensington','Victoria','Family Friendly']::text[],
  seo_title = 'Vault Melbourne Card & Collectible Show — 4 October 2026',
  seo_description = 'VAULT Collector Show #1 at Melbourne Pavilion, Kensington on Sunday 4 October 2026, 10am–6pm (VIP from 9am). 70+ vendors, Pokémon, One Piece, sports cards and a $1,500+ giveaway. From $20, kids under 10 free.'
where slug = 'the-vault-melbourne-card-collectible-show-2026-10-04';
