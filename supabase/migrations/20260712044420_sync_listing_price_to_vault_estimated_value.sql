-- Keep a card's displayed price consistent everywhere on the site.
--
-- The app stores a card's price in two columns that were only ever written
-- independently:
--
--   * vault_items.estimated_value_aud — read by nearly every card/grid surface
--     (homepage featured, VaultListingCard, My Vault, Account dashboard, seller
--     & vault profiles, collections, admin dashboards, portfolio stats…)
--   * listings.price_aud             — read by the marketplace: MarketplaceListingCard,
--     the product detail page, cart and checkout.
--
-- When a seller sets or edits a card's sale price (VaultListingModal, or the
-- "asking price" field on AddEditCardPage) only listings.price_aud changes, so
-- the grid keeps showing the stale estimated value while the detail page shows
-- the new sale price — the exact "price didn't update everywhere" report.
--
-- For a card that is actively For Sale, the sale price IS the operative number,
-- so make it authoritative: whenever a fixed-price active listing's price_aud is
-- written, mirror it onto the parent vault_item's estimated_value_aud. Every
-- reader of estimated_value_aud then reflects the current sale price with no
-- change to their queries. Trade-only and Expression-of-Interest listings carry
-- no price_aud, so the seller's own estimate is left untouched for them.

create or replace function public.sync_vault_estimated_value_from_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fixed-price, live listings carry an authoritative sale price. Guard on
  -- IS DISTINCT FROM so the write is a no-op (and fires no vault_items triggers)
  -- when the value already matches.
  if new.vault_item_id is not null
     and new.status = 'active'
     and new.listing_type = 'fixed'
     and new.price_aud is not null then
    update public.vault_items
      set estimated_value_aud = new.price_aud
      where id = new.vault_item_id
        and estimated_value_aud is distinct from new.price_aud;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_vault_estimated_value_from_listing() from public;
revoke execute on function public.sync_vault_estimated_value_from_listing() from anon;

-- AFTER so the listing row is already persisted; scoped to the columns that can
-- change the authoritative price to avoid needless vault_items writes.
drop trigger if exists trg_sync_vault_estimated_value on public.listings;
create trigger trg_sync_vault_estimated_value
  after insert or update of price_aud, status, listing_type on public.listings
  for each row execute function public.sync_vault_estimated_value_from_listing();

-- One-time backfill: reconcile cards that already diverged before this trigger
-- existed (e.g. the reported card showing $500 on the grid but $400 in the
-- marketplace). The app enforces at most one non-archived listing per vault
-- item, so this join is unambiguous.
update public.vault_items vi
  set estimated_value_aud = l.price_aud
  from public.listings l
  where l.vault_item_id = vi.id
    and l.status = 'active'
    and l.listing_type = 'fixed'
    and l.price_aud is not null
    and vi.estimated_value_aud is distinct from l.price_aud;
