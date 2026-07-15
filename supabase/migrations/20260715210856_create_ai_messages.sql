-- Create public.ai_messages — persistence for the integrated AI chat history.
--
-- The AI chat backend (src/api/integrated-ai.js) already reads and writes this
-- table: saveMessages() inserts { user_id?, role, content } and getHistory()
-- selects a user's rows ordered by created_at. The table was listed in the
-- PocketBase → Supabase migration plan (integratedAiMessages → ai_messages) but
-- never actually created in this project, so every insert silently failed
-- (the code swallows the error and returns []) and no chat history was retained.
-- This also surfaced as `relation "public.ai_messages" does not exist` when an
-- unrelated migration referenced it.
--
-- Column shapes mirror exactly how the code uses them:
--   * user_id  — omitted for guest chats, so nullable; FK to profiles, cascade
--                so a deleted account's history is removed with it.
--   * role     — 'user' / 'assistant' (MessageRole); kept as free text to avoid
--                rejecting any role the app sends.
--   * content  — the code stores JSON.stringify(message.content) and JSON.parses
--                it back, so this is a text column holding a JSON string.
--   * created_at — getHistory() orders by this ascending.
--
-- Backend access is via the service-role key (bypasses RLS). RLS is enabled with
-- only a self-select policy, so if the history is ever read client-side a user
-- can see only their own messages; inserts remain server-side only.

create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_user_id_created_at_idx
  on public.ai_messages (user_id, created_at);

alter table public.ai_messages enable row level security;

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own
  on public.ai_messages
  for select
  to authenticated
  using (auth.uid() = user_id);
