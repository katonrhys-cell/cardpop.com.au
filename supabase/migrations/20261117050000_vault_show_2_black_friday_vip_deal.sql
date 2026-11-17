-- VAULT Collector Show #2 (Sun 14 Mar 2027, The Timber Yard, Port Melbourne):
-- bring the event page in line with the organiser's current Megatix listing as of
-- 2026-11-17. What changed since the seed (20261111090600):
--   * Black Friday deal: "VIP Black Friday - Buy 1 Get 1 Free", 2 VIP tickets for $35.
--     It replaces the single $35 VIP ticket, so the VIP row becomes a named ticket.
--   * Each VIP ticket is its own entry into the $5,000 on-site Vault, and the Vault
--     code is the last four digits of the order number (GA and VIP alike).
--   * Banner headline: 70+ vendors, buy, swap, sell, $5,000 on-site Vault prize.
-- The copy is written for CardPop, not pasted. The deal's end date isn't stated on
-- the listing, so none is given. Idempotent: it only sets the same values again.

update public.events
set
  short_description = 'VAULT returns for round two at The Timber Yard, Port Melbourne. 70+ vendors to buy, swap and sell with, a $5,000+ on-site Vault giveaway and a Black Friday deal: 2 VIP tickets for $35. General entry $20, kids under 10 free.',
  description =
    E'VAULT, Melbourne''s trading card and collectibles show, is back for its second edition. Show #2 is on Sunday 14 March 2027 at The Timber Yard, a large warehouse venue on Plummer Street in Port Melbourne.\n\n'
    || E'Black Friday deal: Buy 1 Get 1 Free VIP tickets\n'
    || E'Two VIP tickets for $35. The offer is strictly limited, so grab yours while it''s on.\n\n'
    || E'More than 70 vendors will be selling under one roof across trading cards, sports cards, Pokémon, One Piece and other TCGs, toys, figures, apparel and unique collectibles. You''ll find slabs, raw singles and sealed product.\n\n'
    || E'Whether you''re hunting your next grail, looking to trade or sell, ripping packs, finding new vendors or just enjoying the collector community, VAULT is built for collectors. Buy, swap and sell.\n\n'
    || E'Times\n'
    || E'- VIP early entry: from 9:00am, one hour before general admission\n'
    || E'- General trading: 10:00am to 6:00pm\n\n'
    || E'Tickets\n'
    || E'Tickets are sold through Megatix.\n'
    || E'- First Release General Admission, $20: all-day entry from 10:00am. This is a limited First Release allocation, and the price rises to $25 once it''s gone. It includes your entry into the $5,000 on-site Vault, and kids under 10 are free.\n'
    || E'- VIP Black Friday, Buy 1 Get 1 Free, $35 for 2 tickets: includes two entries into the $5,000 on-site Vault, entry from 9:00am (first pick of the vendor tables), a VIP showbag and an exclusive meet and greet.\n\n'
    || E'Who can come\n'
    || E'VAULT is family-friendly, and children under 10 enter free. Food and drinks are available on site.\n\n'
    || E'The VAULT Giveaway: over $5,000 in prizes\n'
    || E'Every ticket has a chance to win. Enter the last four digits of your order number into the VAULT on site. If it opens, you win everything inside. Prizes include sealed Pokémon product, PSA-graded slabs, Pop figures and other collectibles.\n\n'
    || E'Getting there\n'
    || E'The Timber Yard is at 351 Plummer St, Port Melbourne VIC 3207, a short trip from the CBD in Melbourne''s inner south-west.',
  entry_fee_aud = 20,
  ticket_prices = '[{"type":"custom","label":"VIP Black Friday – Buy 1 Get 1 Free (2 tickets)","price_aud":35}]'::jsonb,
  age_restrictions = 'All ages, family-friendly. Children under 10 enter free.',
  tags = array['Card Show','Sports Cards','Pokemon','One Piece','TCG','Slabs','Sealed','Collectibles','Toys & Figures','Giveaway','Black Friday','Melbourne','Port Melbourne','Victoria','Family Friendly']::text[],
  seo_description = 'VAULT Collector Show #2 at The Timber Yard, Port Melbourne, Sun 14 Mar 2027, 10am–6pm (VIP 9am). 70+ vendors, a $5,000+ on-site Vault giveaway and Black Friday: 2 VIP tickets for $35.',
  updated_at = now()
where slug = 'vault-collector-show-2-port-melbourne-2027-03-14';
