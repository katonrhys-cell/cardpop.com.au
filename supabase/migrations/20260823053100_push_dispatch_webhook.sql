-- Push dispatch: fan every notifications INSERT out to the web-push sender.
--
-- Almost all user-facing notifications are created by DB triggers
-- (on_order_paid, offer/trade notify functions via create_notification), not
-- by backend code — so the only complete hook point for "send a push when a
-- notification is created" is the table itself. A Database-Webhook-style
-- trigger POSTs each inserted row to /api/push/dispatch, which atomically
-- claims the row (pushed_at) and sends the push; the claim makes replays and
-- spoofed calls no-ops, so the endpoint needs no shared secret.
--
-- Defensive on purpose: supabase_functions.http_request ships with hosted
-- Supabase (it powers dashboard Database Webhooks), but if it's ever missing
-- this migration must degrade to "no push" — never a failed db push, which
-- blocks every later migration (see CLAUDE.md).

alter table public.notifications add column if not exists pushed_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'supabase_functions' and p.proname = 'http_request'
  ) then
    execute 'drop trigger if exists notifications_push_dispatch on public.notifications';
    execute $trg$
      create trigger notifications_push_dispatch
        after insert on public.notifications
        for each row
        execute function supabase_functions.http_request(
          'https://cardpop.com.au/hcgi/api/push/dispatch',
          'POST',
          '{"Content-Type":"application/json"}',
          '{}',
          '3000'
        )
    $trg$;
  else
    raise notice 'supabase_functions.http_request not available — push dispatch trigger not installed (web push stays off)';
  end if;
end $$;
