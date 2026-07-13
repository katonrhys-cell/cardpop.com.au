-- Codify the verification-docs bucket in the repo (it was created via the
-- dashboard) and guarantee it is PRIVATE. It holds government ID scans and
-- selfies: the account-verification form uploads the durable copies for admin
-- review, and the AI name-extraction endpoint now stages its transient scan
-- here too (short-lived signed URL, deleted after extraction) instead of the
-- public ai-images bucket. A public flip of this bucket would expose identity
-- documents to the world, so this migration re-asserts public = false even if
-- the bucket already exists.

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do update set public = false;
