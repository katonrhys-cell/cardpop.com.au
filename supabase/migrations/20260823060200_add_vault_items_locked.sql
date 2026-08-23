-- Let a seller lock a vault card against their own edits.
--
-- pages/account/AccountListings.jsx ("My Listings") now links each listing
-- straight through to its vault item's edit form (PATCH /vault/items/:id/lock
-- flips the new `locked` flag). Locking is a seller convenience — e.g. to stop
-- an accidental mid-negotiation price change — not an admin control, so it is
-- NOT one of the existing "locked columns" (is_featured, locked_base_value_aud)
-- that are pinned against the OWNER. Here the owner is exactly who is allowed
-- to flip it, in both directions; the trigger below stops a locked row's OTHER
-- columns being changed in the same request a full edit would attempt, while
-- still allowing a pure lock/unlock toggle through.
alter table public.vault_items
  add column if not exists locked boolean not null default false;

comment on column public.vault_items.locked is
  'Owner-set edit lock. While true, trg_fn_vault_enforce_item_lock blocks changes to every other column until the owner unlocks it again.';

create or replace function public.trg_fn_vault_enforce_item_lock()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF OLD.locked THEN
    SELECT COALESCE(is_admin, FALSE)
    INTO   v_is_admin
    FROM   profiles
    WHERE  id = auth.uid();

    IF NOT v_is_admin THEN
      -- Still locked (or re-locking): no edit may pass, full stop.
      IF NEW.locked THEN
        RAISE EXCEPTION 'This card is locked. Unlock it before making changes.';
      -- Unlocking: allow ONLY a pure toggle — every other column must be
      -- byte-for-byte unchanged, so an unlock can't smuggle other edits
      -- through in the same request. jsonb diff avoids enumerating ~90 columns
      -- and automatically covers any column added later.
      ELSIF (to_jsonb(NEW) - 'locked' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'locked' - 'updated_at') THEN
        RAISE EXCEPTION 'This card is locked. Unlock it before making changes.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

drop trigger if exists trg_vault_enforce_item_lock on public.vault_items;
create trigger trg_vault_enforce_item_lock
  before update on public.vault_items
  for each row
  execute function public.trg_fn_vault_enforce_item_lock();
