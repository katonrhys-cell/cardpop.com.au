-- Rename the "Hockey" sports franchise to "NHL" so it reads like the other
-- league franchises (NBA, NRL, NBL, AFL…) everywhere the name is shown: the
-- listing form's Franchise dropdown, the "Showing foils & variants for …"
-- line, and the `collection` text the form writes onto vault_items.
--
-- The row keeps its id, so teams / manufacturers / sets / parallels linked by
-- franchise_id are untouched. `categories.name` and `categories.slug` are both
-- globally unique; the guard clauses make this a no-op if an "NHL" row already
-- exists or the rename has already happened.
update public.categories c
   set name = 'NHL',
       slug = 'nhl'
 where c.name = 'Hockey'
   and c.parent_id is not null
   and not exists (select 1 from public.categories x where x.name = 'NHL' or x.slug = 'nhl');

-- Cards whose free-text `collection` was written while the franchise was still
-- called "Hockey" (the form stores the franchise's display name).
update public.vault_items set collection = 'NHL' where collection = 'Hockey';
update public.card_catalogue set collection = 'NHL' where collection = 'Hockey';
update public.card_scans set collection = 'NHL' where collection = 'Hockey';
update public.card_art_overrides set collection = 'NHL' where collection = 'Hockey';
