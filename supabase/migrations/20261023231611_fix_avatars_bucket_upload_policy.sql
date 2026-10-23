-- Let users actually upload a profile photo / business logo.
--
-- The `avatars` bucket's dashboard-created INSERT policy only admitted one
-- object name per user:
--
--   avatars_owner_insert  INSERT  WITH CHECK (
--     bucket_id = 'avatars' AND name LIKE 'avatars/' || auth.uid() || '.%')
--
-- i.e. the fixed per-user path `avatars/<uid>.<ext>`. But both writers moved
-- to immutable, timestamped names so the file can carry a one-year cache
-- header (see "Image serving & Supabase egress" in CLAUDE.md):
--
--   pages/account/AccountProfile.jsx     avatars/<uid>-<timestamp>.<ext>
--   pages/account/AccountSoleTrader.jsx  business-logos/<uid>-<timestamp>.<ext>
--
-- Neither matches `avatars/<uid>.%`, so every profile-photo and logo upload
-- was refused with "new row violates row-level security policy" — which the
-- page surfaced as a bare toast that read like an image-size problem. (Size
-- was never the issue: the photo is resized to 512 px in the browser before
-- upload and the bucket's limit is 5 MB.)
--
-- Replace the policy with one that admits both the legacy fixed path and the
-- timestamped paths, under either prefix, still keyed to the caller's own id
-- so nobody can write into another user's namespace. Scoped to
-- `authenticated` — anonymous callers have no uid and could never match.

drop policy if exists "avatars_owner_insert" on storage.objects;

create policy "avatars_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      name like 'avatars/' || (select auth.uid())::text || '.%'
      or name like 'avatars/' || (select auth.uid())::text || '-%'
      or name like 'business-logos/' || (select auth.uid())::text || '.%'
      or name like 'business-logos/' || (select auth.uid())::text || '-%'
    )
  );

-- Owners can also tidy up their own old photos (the app doesn't yet, but a
-- user removing their picture should not be left unable to delete the file).
drop policy if exists "avatars_owner_delete" on storage.objects;

create policy "avatars_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and owner_id = (select auth.uid())::text
  );

-- avatars_owner_select / avatars_owner_update (owner_id-keyed) are unchanged.
-- The bucket is public, so reads of the stored photo don't go through RLS.
