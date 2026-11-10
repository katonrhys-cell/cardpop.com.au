\set ON_ERROR_STOP 1
insert into public.ai_usage_events (user_id, feature, model, input_tokens, output_tokens, cost_usd, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'card_scan', 'claude-haiku-5-5', 1000, 200, 0.0002, now()),
  ('11111111-1111-1111-1111-111111111111', 'card_scan', 'claude-haiku-5-5', 1000, 200, 0.0002, now()),
  (null, 'blog_draft', 'claude-sonnet-5-5', 20000, 4000, 0.08, now()),
  (null, 'blog_draft', 'claude-sonnet-5-5', 1, 1, 1, now() - interval '19 months');

do $$
declare r record; n int;
begin
  select * into r from public.ai_usage_summary(now() - interval '1 day', now() + interval '1 day') where feature = 'card_scan';
  if r.calls <> 2 or r.members <> 1 or r.input_tokens <> 2000 then raise exception 'FAIL: summary %', r; end if;
  select count(*) into n from public.ai_usage_summary(now() - interval '1 day', now() + interval '1 day');
  if n <> 2 then raise exception 'FAIL: expected 2 feature/model rows, got %', n; end if;
  raise notice 'ok: summary groups by feature and model within the range';

  perform private.run_housekeeping();
  select count(*) into n from public.ai_usage_events;
  if n <> 3 then raise exception 'FAIL: housekeeping should prune only rows older than 18 months (left %)', n; end if;
  raise notice 'ok: housekeeping prunes ledger rows older than 18 months';
end $$;

-- The browser roles can neither read the ledger nor call the summary.
set role anon;
do $$ begin
  perform 1 from public.ai_usage_events;
  raise exception 'FAIL: anon read the ledger';
exception when insufficient_privilege then raise notice 'ok: anon cannot read the ledger'; end $$;
do $$ begin
  perform * from public.ai_usage_summary(now() - interval '1 day', now());
  raise exception 'FAIL: anon called the summary';
exception when insufficient_privilege then raise notice 'ok: anon cannot call the summary'; end $$;
reset role;
set role authenticated;
do $$ begin
  insert into public.ai_usage_events (feature, model) values ('x', 'y');
  raise exception 'FAIL: a member wrote to the ledger';
exception when insufficient_privilege then raise notice 'ok: members cannot write the ledger'; end $$;
reset role;
set role service_role;
do $$ begin
  insert into public.ai_usage_events (feature, model) values ('card_scan', 'claude-haiku-5-5');
  perform * from public.ai_usage_summary(now() - interval '1 day', now() + interval '1 day');
  raise notice 'ok: the service role writes the ledger and reads the summary';
end $$;
reset role;

