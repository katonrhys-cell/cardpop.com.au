-- Close cross-tenant read access to the `ai-images` storage bucket.
--
-- `ai-images` holds every photo a user sends through the AI assistant and the
-- card-identification pipeline (src/api/integrated-ai.js →
-- uploadImagesToSupabase, keyed `ocr/<random>.<ext>`). The bucket is private,
-- but two dashboard-created policies granted the whole bucket to every signed-in
-- user:
--
--   ai_images_auth_select  SELECT  to authenticated  USING (bucket_id = 'ai-images')
--   ai_images_auth_insert  INSERT  to authenticated  WITH CHECK (bucket_id = 'ai-images')
--
-- The SELECT policy is not scoped to the object's owner, so any authenticated
-- caller with the shipped anon key could
--   supabase.storage.from('ai-images').list('ocr')
--   supabase.storage.from('ai-images').createSignedUrl(<any listed path>, 3600)
-- and read every other user's uploaded photos. The random object name is not a
-- defence once the bucket can be listed. The INSERT policy likewise let any
-- signed-in user write arbitrary objects into the bucket.
--
-- Nothing in the app needs either grant: every read and write of this bucket
-- goes through the Express backend's service-role client (which bypasses RLS),
-- and no browser code touches `ai-images` at all — a repo-wide search for
-- `storage.from('ai-images')` finds only src/api/integrated-ai.js. Dropping the
-- two policies leaves the bucket service-role-only, which is what the code
-- already assumes.
--
-- (Storage policies for this project have lived only in the dashboard until
-- now. Adding them here brings them under the same repo-as-source-of-truth rule
-- as the rest of the schema — see CLAUDE.md.)

drop policy if exists "ai_images_auth_select" on storage.objects;
drop policy if exists "ai_images_auth_insert" on storage.objects;

-- ai_images_service_read (service_role SELECT) already exists and is kept; the
-- service role bypasses RLS regardless, so it is belt-and-braces.

-- Constrain what can be stored in the two buckets that had no limits at all.
-- `vault-images` is a PUBLIC bucket any authenticated user can write into
-- (under their own uid folder), with no size cap and no MIME allow-list — so it
-- doubled as unmetered, publicly-served file hosting for arbitrary content, on
-- a plan where storage egress is the metered resource. Match the limits the
-- other image buckets already carry.
update storage.buckets
set file_size_limit = 20971520, -- 20 MB, matching the `events` bucket
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'vault-images';
