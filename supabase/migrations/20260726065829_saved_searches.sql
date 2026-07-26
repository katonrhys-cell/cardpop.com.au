-- Saved marketplace searches.
--
-- The marketplace mirrors its full filter state into the URL query string, so
-- a saved search is simply that string (e.g. "q=umbreon&max=200&cat=…") plus a
-- human label. Rows are per-user, managed directly from the client under RLS.
-- (Email alerts on new matches are a planned follow-up; nothing here assumes
-- them.)

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  params text not null check (char_length(params) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (user_id, params)
);

create index if not exists saved_searches_user_id_idx on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

drop policy if exists "saved_searches_select_own" on public.saved_searches;
create policy "saved_searches_select_own" on public.saved_searches
  for select using (auth.uid() = user_id);

drop policy if exists "saved_searches_insert_own" on public.saved_searches;
create policy "saved_searches_insert_own" on public.saved_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_searches_delete_own" on public.saved_searches;
create policy "saved_searches_delete_own" on public.saved_searches
  for delete using (auth.uid() = user_id);
