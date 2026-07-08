-- "Personal Collection (PC)" — a short, public-facing note on each profile
-- describing what that collector personally collects (e.g. "Pokémon WOTC
-- Charizards, vintage Yu-Gi-Oh"). Distinct from the free-form `bio`: this is a
-- focused, at-a-glance summary of collecting interests so other members can see
-- what someone chases when browsing collector profiles.
--
-- Nullable free text with no default — an empty PC simply doesn't render on the
-- profile. Kept backward-compatible so the schema can land before the UI that
-- reads/writes it.
alter table public.profiles
  add column if not exists personal_collection text;

comment on column public.profiles.personal_collection is
  'Public "Personal Collection (PC)" note shown on a member''s profile — a short description of what they personally collect. User-editable via the Public Profile page.';
