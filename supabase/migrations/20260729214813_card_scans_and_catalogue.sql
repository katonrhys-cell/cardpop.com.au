-- Card scan log, and the catalogue that accumulates out of it.
--
-- Every identification currently fills a form and is then thrown away. That
-- discards two genuinely valuable things:
--
--   1. The scan itself — what the pipeline read, which model read it, whether it
--      escalated, what the catalogue corroborated. In aggregate this is a
--      production accuracy signal, the same measurement the fixture harness
--      gives us but on real seller traffic.
--
--   2. The seller's correction. When someone edits a field after an
--      identification, that edit is ground truth, and it is the only source of
--      ground truth that arrives for free.
--
-- `card_scans` keeps both, one row per scan. `card_catalogue` is the
-- deduplicated result: one row per distinct card, accumulating observations, so
-- CardPop ends up with its own card database rather than depending on
-- third-party catalogues to recognise a card.
--
-- Scope note: this is deliberately NOT per-seller. vault_items already holds a
-- seller's own cards; the catalogue is a shared asset, readable by everyone and
-- written only by the backend (service role), so no seller can corrupt it.

-- ─── card_scans ──────────────────────────────────────────────────────────────

create table if not exists public.card_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- How many images the read had to work with. Front-only scans lose the
  -- copyright line and the collector number, which both live on the back, so
  -- this is needed to interpret a missing field.
  image_count smallint not null default 1 check (image_count between 1 and 5),

  -- The full mapped OCR result, kept verbatim. Individual columns below are
  -- denormalised out of it for querying; this is the audit trail.
  ocr jsonb,

  -- Identity as identified.
  collection text,
  set_name text,
  insert_name text,
  card_number text,
  year text,
  parallel text,
  card_name text,
  rookie text,

  -- Grading, as read off a slab label.
  grading_company text,
  grade text,
  cert_number text,

  -- Pipeline telemetry. `escalation_reason` is the code from escalationReason()
  -- — tracking which reason dominates is how we tell a useful gate from one
  -- that fires on every scan and costs a second model call for nothing.
  model_escalated boolean not null default false,
  escalation_reason text,
  catalogue_verified text[],
  cardsight_card_id text,
  cardsight_confidence text,
  cardsight_ambiguous boolean,

  -- Identity key, null when the read was too vague to catalogue.
  catalogue_key text,

  -- The seller's corrections, attached when they save the listing. A diff of
  -- these against the columns above is real-world accuracy.
  saved_fields jsonb,
  corrected_at timestamptz,
  vault_item_id uuid references public.vault_items(id) on delete set null
);

create index if not exists card_scans_user_id_created_idx
  on public.card_scans (user_id, created_at desc);
create index if not exists card_scans_catalogue_key_idx
  on public.card_scans (catalogue_key) where catalogue_key is not null;
-- Supports "which escalation reasons are firing, and how often".
create index if not exists card_scans_escalation_reason_idx
  on public.card_scans (escalation_reason) where escalation_reason is not null;

alter table public.card_scans enable row level security;

drop policy if exists "card_scans_select_own" on public.card_scans;
create policy "card_scans_select_own" on public.card_scans
  for select using (auth.uid() = user_id);

-- Admins read everything: the aggregate is the point of the table, and it is
-- not visible from any one seller's rows.
drop policy if exists "card_scans_select_admin" on public.card_scans;
create policy "card_scans_select_admin" on public.card_scans
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- No insert/update/delete policies: rows are written by the backend with the
-- service role, which bypasses RLS. A seller cannot forge or edit scan history.

-- ─── card_catalogue ──────────────────────────────────────────────────────────

create table if not exists public.card_catalogue (
  id uuid primary key default gen_random_uuid(),
  catalogue_key text not null unique,

  -- Identity components, mirroring what went into the key.
  collection text not null,
  set_name text not null,
  insert_name text,
  card_number text,
  parallel text,

  -- Best-known descriptive values. These improve as observations accumulate.
  card_name text,
  year text,
  rookie text,
  manufacturer text,

  -- `observations` counts every scan that resolved to this key.
  -- `confirmations` counts only those a seller then saved without correcting the
  -- identity fields — i.e. a human agreed. An entry with many observations and
  -- no confirmations is one the pipeline keeps producing and sellers keep
  -- fixing, which is exactly the signal worth surfacing.
  observations integer not null default 0,
  confirmations integer not null default 0,

  -- False when the key had to fall back to the card name because no collector
  -- number was read. Such entries are provisional: a later, better-identified
  -- scan of the same card will not merge into them.
  strong_key boolean not null default true,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists card_catalogue_collection_set_idx
  on public.card_catalogue (collection, set_name);
create index if not exists card_catalogue_observations_idx
  on public.card_catalogue (observations desc);

alter table public.card_catalogue enable row level security;

-- The catalogue is a shared reference: readable by anyone, written only by the
-- backend. Card facts are not secret, and a public read lets the browse and
-- autocomplete paths use it directly.
drop policy if exists "card_catalogue_select_all" on public.card_catalogue;
create policy "card_catalogue_select_all" on public.card_catalogue
  for select using (true);

-- ─── promotion ───────────────────────────────────────────────────────────────

-- Records one observation against a catalogue entry, creating it on first sight.
--
-- Descriptive fields use coalesce so a later scan can fill a gap an earlier one
-- left, but never blank out a value we already have — a single bad read must not
-- erase a field that other scans agreed on.
create or replace function public.record_catalogue_observation(
  p_catalogue_key text,
  p_collection text,
  p_set_name text,
  p_insert_name text,
  p_card_number text,
  p_parallel text,
  p_card_name text,
  p_year text,
  p_rookie text,
  p_manufacturer text,
  p_strong_key boolean,
  p_confirmed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.card_catalogue as c (
    catalogue_key, collection, set_name, insert_name, card_number, parallel,
    card_name, year, rookie, manufacturer, strong_key,
    observations, confirmations
  )
  values (
    p_catalogue_key, p_collection, p_set_name, nullif(p_insert_name, ''),
    nullif(p_card_number, ''), nullif(p_parallel, ''),
    nullif(p_card_name, ''), nullif(p_year, ''), nullif(p_rookie, ''),
    nullif(p_manufacturer, ''), coalesce(p_strong_key, true),
    1, case when p_confirmed then 1 else 0 end
  )
  on conflict (catalogue_key) do update set
    observations  = c.observations + 1,
    confirmations = c.confirmations + case when p_confirmed then 1 else 0 end,
    last_seen_at  = now(),
    card_name     = coalesce(c.card_name, nullif(excluded.card_name, '')),
    year          = coalesce(c.year, nullif(excluded.year, '')),
    rookie        = coalesce(c.rookie, nullif(excluded.rookie, '')),
    manufacturer  = coalesce(c.manufacturer, nullif(excluded.manufacturer, '')),
    insert_name   = coalesce(c.insert_name, nullif(excluded.insert_name, '')),
    card_number   = coalesce(c.card_number, nullif(excluded.card_number, '')),
    parallel      = coalesce(c.parallel, nullif(excluded.parallel, ''))
  returning c.id into v_id;

  return v_id;
end;
$$;

-- The function is security definer, so who may call it is the whole security
-- boundary: revoke the implicit PUBLIC execute grant, then hand it back to the
-- service role alone. The grant is not optional — revoking from PUBLIC drops
-- service_role's implicit privilege too, and because catalogue logging is
-- fire-and-forget a missing grant would lose every observation silently rather
-- than surfacing an error. (Matches `compute_seller_tier`, whose ACL is exactly
-- {postgres, service_role}.)
revoke all on function public.record_catalogue_observation(
  text, text, text, text, text, text, text, text, text, text, boolean, boolean
) from public, anon, authenticated;

grant execute on function public.record_catalogue_observation(
  text, text, text, text, text, text, text, text, text, text, boolean, boolean
) to service_role;
