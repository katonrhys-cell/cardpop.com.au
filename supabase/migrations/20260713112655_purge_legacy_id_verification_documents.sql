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

delete from storage.objects
where bucket_id = 'verification-docs';

delete from storage.objects o
where o.bucket_id = 'ai-images'
  and o.name like 'ocr/%'
  and not exists (
    select 1 from public.ai_messages m
    where m.content like '%' || o.name || '%'
  );
