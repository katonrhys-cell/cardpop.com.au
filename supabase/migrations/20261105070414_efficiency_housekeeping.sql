-- Efficiency housekeeping from the 2026-11 cost review.
--
-- Four independent, idempotent changes. None alters application behaviour:
-- they bound tables that only ever grow, slow a job whose output nothing
-- reads, collapse a two-policy check that every marketplace grid paid for per
-- image row, and add indexes the advisor and the current query shapes ask for.
-- Test: tests/db/run-efficiency-housekeeping-migration.sh.

create schema if not exists private;

-- ── 1. Retention for tables that only ever grow ──────────────────────────────
--
-- cron.job_run_details keeps one row per pg_cron run forever: 108,599 rows
-- and 74 MB of a 126 MB database on 2026-11-04, almost all of it from the
-- Stripe sync worker. Seven days is plenty to debug a failing job.
--
-- rate_limit_counters gets one row per IP + route key and is only deleted on
-- an explicit reset (20260721072719). The longest window any limiter uses is
-- one hour, so a key whose window started two days ago is dead weight; the
-- next hit simply recreates it.

create or replace function private.run_housekeeping()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.rate_limit_counters
   where window_start < now() - interval '2 days';

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    delete from cron.job_run_details
     where coalesce(end_time, start_time) < now() - interval '7 days';
  end if;
end;
$$;

revoke all on function private.run_housekeeping() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Clear the backlog now, then keep it bounded daily (03:43 AEST).
    perform private.run_housekeeping();
    perform cron.unschedule(jobid) from cron.job where jobname = 'housekeeping-prune';
    perform cron.schedule('housekeeping-prune', '43 17 * * *', 'select private.run_housekeeping()');
  end if;
end;
$$;

-- ── 2. Stripe Sync Engine worker: hourly ─────────────────────────────────────
--
-- The integration mirrors Stripe into the `stripe` schema for reporting that
-- nothing in the application runs (docs/stripe-sync.md). 20261010022330 cut
-- its pg_cron job from every minute to every five; hourly is still fresh
-- enough for an ad-hoc report and cuts the wake-ups (each one an Edge Function
-- call plus a history row) by another 92%. As before this touches only the
-- job's schedule, never the schema the integration owns, and is a no-op when
-- pg_cron or the job is absent (the integration switched off).

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule := '7 * * * *')
      from cron.job
     where jobname = 'stripe-sync-worker'
       and schedule is distinct from '7 * * * *';
  end if;
end;
$$;

-- ── 3. vault_images: one check per image row ─────────────────────────────────
--
-- The owner policy was FOR ALL, so it applied to SELECT too and was OR'd with
-- vault_images_public_select (20261010020701). Every image row in every grid
-- ran both EXISTS lookups into vault_items, for anonymous visitors as well,
-- and CLAUDE.md's rule of a single permissive SELECT policy on this table was
-- quietly broken. The owner's read moves into the one SELECT policy; the
-- owner's writes get their own INSERT / UPDATE / DELETE policies, restricted
-- to signed-in users (an anonymous caller can never be an owner anyway).
-- Who can see and change which image is unchanged.

do $$
begin
  if to_regclass('public.vault_images') is null then
    return;
  end if;

  drop policy if exists "Users can manage images for their own vault items" on public.vault_images;
  drop policy if exists vault_images_public_select on public.vault_images;
  drop policy if exists vault_images_owner_insert on public.vault_images;
  drop policy if exists vault_images_owner_update on public.vault_images;
  drop policy if exists vault_images_owner_delete on public.vault_images;

  create policy vault_images_public_select on public.vault_images
    as permissive for select to public
    using (exists (
      select 1 from public.vault_items vi
       where vi.id = vault_images.vault_item_id
         and (vi.publicly_listed or vi.is_featured or vi.owner_id = (select auth.uid()))
    ));

  create policy vault_images_owner_insert on public.vault_images
    as permissive for insert to authenticated
    with check (exists (
      select 1 from public.vault_items vi
       where vi.id = vault_images.vault_item_id and vi.owner_id = (select auth.uid())
    ));

  create policy vault_images_owner_update on public.vault_images
    as permissive for update to authenticated
    using (exists (
      select 1 from public.vault_items vi
       where vi.id = vault_images.vault_item_id and vi.owner_id = (select auth.uid())
    ))
    with check (exists (
      select 1 from public.vault_items vi
       where vi.id = vault_images.vault_item_id and vi.owner_id = (select auth.uid())
    ));

  create policy vault_images_owner_delete on public.vault_images
    as permissive for delete to authenticated
    using (exists (
      select 1 from public.vault_items vi
       where vi.id = vault_images.vault_item_id and vi.owner_id = (select auth.uid())
    ));
end;
$$;

-- ── 4. Indexes ───────────────────────────────────────────────────────────────
--
-- Query shapes with no supporting index:
--   * the daily price refresh reads today's snapshots across every card
--     (src/utils/cardPriceSnapshots.js); the unique index leads with card_id.
--   * the 15-minute expire_stale_offers() sweep looks for live offers past
--     their expiry.
-- Plus the foreign keys the Supabase performance advisor lists as unindexed,
-- so deleting or re-pointing a parent row never scans the child table.
-- Every statement is guarded so a table that doesn't exist yet is skipped.

do $$
declare
  spec text[];
  specs text[][] := array[
    -- table, index name, column list (optionally with a WHERE clause)
    array['card_price_snapshots',   'card_price_snapshots_snapshot_date_idx',        '(snapshot_date)'],
    array['offers',                 'offers_open_expires_at_idx',                    '(expires_at) where status in (''pending'', ''countered'')'],
    array['card_scans',             'card_scans_vault_item_id_idx',                  '(vault_item_id) where vault_item_id is not null'],
    array['blog_article_topics',    'blog_article_topics_article_id_idx',            '(article_id)'],
    array['event_attendee_reviews', 'event_attendee_reviews_hidden_by_idx',          '(hidden_by)'],
    array['event_reviews',          'event_reviews_author_id_idx',                   '(author_id)'],
    array['event_scan_candidates',  'event_scan_candidates_event_id_idx',            '(event_id)'],
    array['event_scan_candidates',  'event_scan_candidates_source_id_idx',           '(source_id)'],
    array['event_scan_runs',        'event_scan_runs_triggered_by_idx',              '(triggered_by)'],
    array['event_source_watches',   'event_source_watches_created_by_idx',           '(created_by)'],
    array['event_stall_layouts',    'event_stall_layouts_updated_by_idx',            '(updated_by)'],
    array['giveaway_entries',       'giveaway_entries_user_id_idx',                  '(user_id)'],
    array['giveaway_entries',       'giveaway_entries_verified_by_idx',              '(verified_by)'],
    array['giveaways',              'giveaways_created_by_idx',                      '(created_by)'],
    array['giveaways',              'giveaways_drawn_by_idx',                        '(drawn_by)'],
    array['giveaways',              'giveaways_winner_entry_id_idx',                 '(winner_entry_id)'],
    array['invoices',               'invoices_credits_invoice_id_idx',               '(credits_invoice_id)'],
    array['promo_code_redemptions', 'promo_code_redemptions_order_id_idx',           '(order_id)'],
    array['promo_codes',            'promo_codes_created_by_idx',                    '(created_by)'],
    array['shop_product_costs',     'shop_product_costs_updated_by_idx',             '(updated_by)'],
    array['shop_product_reviews',   'shop_product_reviews_moderated_by_idx',         '(moderated_by)'],
    array['shop_restock_requests',  'shop_restock_requests_user_id_idx',             '(user_id)']
  ];
  col text;
begin
  foreach spec slice 1 in array specs loop
    continue when to_regclass('public.' || spec[1]) is null;
    -- The first identifier inside the parentheses is the indexed column;
    -- skip the index if a migration hasn't added that column yet.
    col := substring(spec[3] from '^\(([a-z_]+)\)');
    continue when not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = spec[1] and column_name = col
    );
    execute format('create index if not exists %I on public.%I %s', spec[2], spec[1], spec[3]);
  end loop;
end;
$$;
