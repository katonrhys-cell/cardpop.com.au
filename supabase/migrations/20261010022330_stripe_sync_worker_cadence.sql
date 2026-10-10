-- Stripe Sync Engine worker: every 5 minutes instead of every minute.
--
-- Supabase's Stripe Sync Engine integration (docs/stripe-sync.md) schedules a
-- pg_cron job, `stripe-sync-worker`, that wakes once a minute to drain its
-- webhook/polling queue into the `stripe.*` tables. That is 1,440 wake-ups a
-- day — the busiest recurring query on the database by count (EFFICIENCY_AUDIT
-- 2026-10-10 §6) — for a schema nothing in the application reads: it exists for
-- ad-hoc reporting and reconciliation only, and `stripeWebhookService.js`
-- remains the real-time source of truth. A five-minute cadence keeps the mirror
-- fresh enough for that while cutting the wake-ups by 80%.
--
-- This touches only the job's schedule, which is ours to set; the integration
-- owns the `stripe` schema itself and this repo never alters it. Idempotent: a
-- project without pg_cron, or without the job (integration not enabled), is a
-- no-op, and re-running sets the same schedule again.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule := '*/5 * * * *')
      from cron.job
     where jobname = 'stripe-sync-worker'
       and schedule is distinct from '*/5 * * * *';
  end if;
end;
$$;
