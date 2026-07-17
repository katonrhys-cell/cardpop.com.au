-- Add a presale / early-bird ticket price alongside the general-admission
-- entry_fee_aud. Many shows advertise two prices (e.g. TCXPO: $25 early-bird
-- entry, $15 general admission; Oz Comic-Con: discounted presale before door
-- prices are announced). Keeping them in separate columns lets the Event
-- JSON-LD emit both as distinct Offers instead of shoehorning one into the
-- other.
alter table public.events
  add column if not exists presale_fee_aud numeric(8,2);

comment on column public.events.presale_fee_aud is
  'Advance/early-bird ticket price in AUD where it differs from entry_fee_aud (general admission). Null = no separate presale price advertised.';
