-- Purge historical identity documents from the legacy in-house verification
-- flow. ID verification is now handled entirely by Stripe Identity, so no
-- identity document should remain in our own storage:
--
-- 1. verification-docs: every object (photo IDs + selfies uploaded by the old
--    /account/verification page, and transient AI-extraction scans). The
--    bucket stays (private) but is emptied.
--
-- 2. ai-images ocr/*: the old AI name-extraction endpoint uploaded ID scans
--    here — a PUBLIC bucket — under the same ocr/ prefix the AI chat and
--    card-OCR features use, with indistinguishable random names. Chat images
--    are the only ones referenced from ai_messages history (their URLs are
--    replayed to the AI proxy on follow-up messages), so anything ocr/* that
--    no chat message references is an ID scan or an orphaned one-shot OCR
--    image and is safe to remove without breaking conversations.
--
-- Deleting the storage.objects row severs all API/public-URL access to the
-- file immediately (requests 404). Idempotent: re-running deletes nothing.
--
-- NOTE (2026-07-15): current Supabase blocks direct DELETE on storage.objects
-- with "Direct deletion from storage tables is not allowed. Use the Storage
-- API instead. (SQLSTATE 42501)", raised by a built-in trigger. That made this
-- migration fail on `db push` and — because push stops at the first failing
-- migration — it silently blocked every later migration from applying. Each
-- delete is therefore wrapped so a blocked attempt is a logged no-op instead of
-- aborting the push. Where direct deletion is still permitted the purge runs as
-- before; where it is blocked the objects must be purged out-of-band via the
-- Storage API (service-role client) instead. Either way the migration applies
-- cleanly so it can no longer wedge the migration pipeline.

do $$
begin
  delete from storage.objects
  where bucket_id = 'verification-docs';
exception when insufficient_privilege then
  raise notice 'Skipped verification-docs purge: direct storage.objects deletion is blocked by Supabase; purge via the Storage API instead.';
end $$;

do $$
begin
  delete from storage.objects o
  where o.bucket_id = 'ai-images'
    and o.name like 'ocr/%'
    and not exists (
      select 1 from public.ai_messages m
      where m.content like '%' || o.name || '%'
    );
exception when insufficient_privilege then
  raise notice 'Skipped ai-images ocr/* purge: direct storage.objects deletion is blocked by Supabase; purge via the Storage API instead.';
end $$;
