-- Seed "The Vault – Melbourne Card & Collectible Show" (Sun 4 Oct 2026, Kensington VIC).
-- Source: https://megatix.com.au/events/vault-melbourne-card-collectible-show
--
-- Lands approved so it is live on the /events calendar once the migration applies.
-- Adult ticket pricing was not available when this was written, so entry_fee_aud is
-- left NULL rather than guessed — fill it in from Admin → Events.
-- Idempotent: skipped if the slug already exists.

insert into public.events (
  event_type, status,
  title, slug, short_description, description,
  venue_name, address, suburb, state, postcode,
  start_date, start_time, end_time,
  is_free, registration_required,
  ticket_url, organizer_name,
  featured_card_games, tags, source_url, seo_title, seo_description
)
select
  'card_show'::event_type, 'approved'::event_status,
  'The Vault – Melbourne Card & Collectible Show',
  'the-vault-melbourne-card-collectible-show-2026-10-04',
  'A brand-new Melbourne collector show — 50+ vendors of trading cards, sports cards, Pokémon, One Piece, toys, figures and collectibles. Kids under 10 free.',
  E'The Vault is a brand-new collector show at the Melbourne Pavilion in Kensington, bringing together 50+ vendors across trading cards, sports cards, Pokémon, One Piece and other TCGs, toys, figures, apparel and unique collectibles.\n\nEarly entry starts at 9:00am, with general trading hours from 10:00am to 6:00pm. Family-friendly — children under 10 enter free — with food and drinks available on site.\n\nEvery ticket goes into the VAULT Giveaway, with over $1,000 in prizes: enter the last 4 digits of your ticket number into the vault on site for a chance to win.',
  'Melbourne Pavilion', '135-157 Racecourse Road', 'Kensington', 'VIC', '3031',
  '2026-10-04'::date, '10:00'::time, '18:00'::time,
  false, false,
  'https://megatix.com.au/events/vault-melbourne-card-collectible-show', 'The Vault Card Show',
  array['Pokémon','One Piece']::text[],
  array['Card Show','Sports Cards','Pokemon','One Piece','TCG','Collectibles','Melbourne','Kensington','Victoria','Family Friendly']::text[],
  'https://megatix.com.au/events/vault-melbourne-card-collectible-show',
  'The Vault Melbourne Card & Collectible Show — 4 October 2026',
  'The Vault card and collectible show at Melbourne Pavilion, Kensington on Sunday 4 October 2026, 10am–6pm. 50+ vendors, Pokémon, One Piece, sports cards and a $1,000+ giveaway. Kids under 10 free.'
where not exists (select 1 from public.events where slug = 'the-vault-melbourne-card-collectible-show-2026-10-04');
