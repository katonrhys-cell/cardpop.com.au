-- Wire the `banned_words` platform setting: listings and reviews whose text
-- contains a configured word are auto-flagged for admin review (not blocked).
--
-- Both listings and reviews are created by paths outside a single server route,
-- so enforcement lives in BEFORE INSERT triggers. Text columns are read through
-- to_jsonb(...)->>'col' so a column that doesn't exist yields NULL instead of
-- erroring — a scan must never be able to break a legitimate insert.

alter table public.listings      add column if not exists flagged boolean not null default false;
alter table public.listings      add column if not exists flag_reason text;
alter table public.seller_ratings add column if not exists flagged boolean not null default false;
alter table public.seller_ratings add column if not exists flag_reason text;

-- Returns the first banned word found in `txt` (case-insensitive substring), or
-- NULL. SECURITY DEFINER so it can read platform_settings regardless of the
-- caller's RLS. banned_words is stored as a comma-separated jsonb string.
create or replace function public.first_banned_word(txt text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  raw text;
  w   text;
begin
  if txt is null or btrim(txt) = '' then return null; end if;
  select value #>> '{}' into raw from public.platform_settings where key = 'banned_words';
  if raw is null or btrim(raw) = '' then return null; end if;
  foreach w in array string_to_array(raw, ',')
  loop
    w := btrim(w);
    if w <> '' and position(lower(w) in lower(txt)) > 0 then
      return w;
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function public.first_banned_word(text) from public;
revoke execute on function public.first_banned_word(text) from anon;

-- Listing scan: title/card_name on the listing plus the linked vault_item's
-- card_name / notes / set_name. INSERT-only, so an admin clearing the flag later
-- (an UPDATE) is never re-flagged.
create or replace function public.flag_banned_words_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vi     jsonb;
  corpus text;
  hit    text;
begin
  select to_jsonb(v) into vi from public.vault_items v where v.id = new.vault_item_id;
  corpus := concat_ws(' ',
    to_jsonb(new) ->> 'title',
    to_jsonb(new) ->> 'card_name',
    vi ->> 'card_name',
    vi ->> 'notes',
    vi ->> 'set_name');
  hit := public.first_banned_word(corpus);
  new.flagged := hit is not null;
  new.flag_reason := case when hit is not null then 'Auto-flagged: contains "' || hit || '"' else null end;
  return new;
end;
$$;

drop trigger if exists trg_flag_banned_words_listing on public.listings;
create trigger trg_flag_banned_words_listing
  before insert on public.listings
  for each row execute function public.flag_banned_words_listing();

-- Review scan: the free-text comment.
create or replace function public.flag_banned_words_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hit text;
begin
  hit := public.first_banned_word(to_jsonb(new) ->> 'comment');
  new.flagged := hit is not null;
  new.flag_reason := case when hit is not null then 'Auto-flagged: contains "' || hit || '"' else null end;
  return new;
end;
$$;

drop trigger if exists trg_flag_banned_words_review on public.seller_ratings;
create trigger trg_flag_banned_words_review
  before insert on public.seller_ratings
  for each row execute function public.flag_banned_words_review();
