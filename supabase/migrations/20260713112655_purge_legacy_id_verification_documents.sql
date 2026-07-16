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
-- NOTE (2026-07-15): this migration cannot perform its purge as SQL against the
-- current project and is now a best-effort no-op that always applies cleanly:
--
--   * Supabase blocks direct DELETE on storage.objects — "Direct deletion from
--     storage tables is not allowed. Use the Storage API instead." (42501) —
--     via a built-in trigger, so neither delete below can remove anything.
--   * public.ai_messages does not exist in this project (42P01), so the second
--     delete's subquery cannot even be planned.
--
-- Because `supabase db push` stops at the first failing migration, the original
-- raw deletes silently blocked EVERY later migration from applying to
-- production since 2026-07-13. Each delete is therefore wrapped in a block that
-- swallows any error and emits a notice, so the migration can no longer wedge
-- the pipeline. The actual purge of legacy identity documents must be done
-- out-of-band via the Storage API (service-role client) — see the follow-up
-- cleanup script rather than a SQL migration.

do $$
begin
  delete from storage.objects
  where bucket_id = 'verification-docs';
exception when others then
  raise notice 'Skipped verification-docs purge (%): %. Purge via the Storage API instead.', sqlstate, sqlerrm;
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
exception when others then
  raise notice 'Skipped ai-images ocr/* purge (%): %. Purge via the Storage API instead.', sqlstate, sqlerrm;
end $$;
