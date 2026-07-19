-- Card-art overrides: admin-uploaded artwork for cards the free card APIs don't
-- cover (sports cards etc.), or to deliberately override the resolved art for any
-- card. The server-side resolver (src/utils/cardImageResolver.js) checks this
-- table FIRST — before the Pokémon TCG / Scryfall / YGOPRODeck lookups — keyed by
-- a normalized `name|set|collection` lookup key (see cardArtLookupKey there).
--
-- Images live in the public `media` storage bucket (uploaded from the admin page)
-- and are served through the img.cardpop.com.au Worker, so they cache into R2 on
-- first view like every other stored image — no new bucket or credentials.

CREATE TABLE IF NOT EXISTS card_art_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  card_set     text,          -- not `set` (a reserved word); display only
  collection   text,
  image_url    text NOT NULL, -- canonical Supabase public URL of the uploaded art
  storage_path text,          -- bucket path, for deletion cleanup
  lookup_key   text NOT NULL, -- normalized name|set|collection — the match key
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One override per normalized card identity; the admin upsert keys on this.
CREATE UNIQUE INDEX IF NOT EXISTS card_art_overrides_lookup_key_key
  ON card_art_overrides (lookup_key);

ALTER TABLE card_art_overrides ENABLE ROW LEVEL SECURITY;

-- Public read: the resolver reads with the service role (bypassing RLS), but a
-- public SELECT policy is harmless (image URLs are already public CDN assets)
-- and keeps the door open for a direct client read if ever needed.
DROP POLICY IF EXISTS card_art_overrides_public_read ON card_art_overrides;
CREATE POLICY card_art_overrides_public_read
  ON card_art_overrides FOR SELECT USING (true);

-- Admin-only writes. Inlined profiles.is_admin check — the repo convention
-- (there is no is_admin() SQL helper). Writes normally go through the
-- /admin/card-art backend endpoints (service role), but this keeps the DB itself
-- the security boundary for defence in depth.
DROP POLICY IF EXISTS admin_manage_card_art_overrides ON card_art_overrides;
CREATE POLICY admin_manage_card_art_overrides
  ON card_art_overrides FOR ALL
  USING     (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
