-- Supabase advisor clean-up (2026-10-31 site audit). Three mechanical fixes,
-- each a no-op where it has already been applied, none changing behaviour.
--
-- 1. auth_rls_initplan (performance): thirteen policies added since the
--    2026-07-19 sweep (20260719071049_rls_initplan_wrap_auth_calls.sql) call
--    auth.uid() bare, which Postgres evaluates once PER ROW. Wrapping it as
--    (select auth.uid()) makes it an InitPlan evaluated once per query. The
--    rewrite is done from each policy's live definition, so roles, command and
--    every other predicate round-trip exactly; a policy that is missing or
--    already wrapped is skipped.
--
-- 2. function_search_path_mutable (security): four trigger functions were
--    created without `set search_path`. Pinning it to public closes the
--    search-path injection the linter warns about. (The stripe.* functions it
--    also names belong to the Stripe sync schema and are left alone.)
--
-- 3. anon/authenticated_security_definer_function_executable (security):
--    every trigger function carries PostgreSQL's default EXECUTE grant to
--    PUBLIC, so the linter lists each SECURITY DEFINER one as "callable by
--    anon via /rest/v1/rpc". A function that RETURNS trigger can't actually be
--    invoked through RPC or SQL ("trigger functions can only be called as
--    triggers") and firing a trigger does not check the invoker's EXECUTE —
--    20260715270000 revoked it on the listings triggers and listings have
--    been written by ordinary users ever since. Revoking it on every trigger
--    function is therefore zero-risk and silences the noise so a real
--    finding can be seen. Non-trigger SECURITY DEFINER functions are NOT
--    touched here: each needs an individual decision (see the audit notes).

-- ── 1. (select auth.uid()) in the thirteen policies ──────────────────────────
do $$
declare
  p record;
  q text;
  wc text;
  changed boolean;
begin
  for p in
    select v.tbl, v.pol
      from (values
        ('blog_article_topics',    'Admins can read blog article topics'),
        ('card_scans',             'card_scans_select_admin'),
        ('card_scans',             'card_scans_select_own'),
        ('event_scan_candidates',  'Admins can read event scan candidates'),
        ('event_scan_runs',        'Admins can read event scan runs'),
        ('event_scan_sources',     'Admins can read event scan sources'),
        ('event_source_watches',   'Admins can read event source watches'),
        ('promo_code_redemptions', 'Admins can read promo code redemptions'),
        ('promo_codes',            'Admins can read promo codes'),
        ('saved_searches',         'saved_searches_delete_own'),
        ('saved_searches',         'saved_searches_insert_own'),
        ('saved_searches',         'saved_searches_select_own'),
        ('shop_categories',        'admin_manage_shop_categories')
      ) as v(tbl, pol)
  loop
    select pol.qual, pol.with_check into q, wc
      from pg_policies pol
     where pol.schemaname = 'public' and pol.tablename = p.tbl and pol.policyname = p.pol;
    if not found then
      continue;
    end if;

    changed := false;
    -- Only a bare call is rewritten; pg_policies prints an already-wrapped one
    -- as "( SELECT auth.uid() AS uid)", which the lookbehind leaves alone.
    if q is not null and q ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)' then
      q := regexp_replace(q, '(?<!SELECT )auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
      changed := true;
    end if;
    if wc is not null and wc ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)' then
      wc := regexp_replace(wc, '(?<!SELECT )auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
      changed := true;
    end if;
    if not changed then
      continue;
    end if;

    execute format(
      'alter policy %I on public.%I %s %s',
      p.pol, p.tbl,
      case when q  is not null then 'using (' || q || ')' else '' end,
      case when wc is not null then 'with check (' || wc || ')' else '' end
    );
  end loop;
end $$;

-- ── 2. search_path on the four unpinned trigger functions ────────────────────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.set_updated_at()',
    'public.event_reviews_touch_updated_at()',
    'public.players_sync_born_year()',
    'public.giveaways_touch_updated_at()'
  ]
  loop
    if to_regprocedure(fn) is not null then
      execute format('alter function %s set search_path = public', fn);
    end if;
  end loop;
end $$;

-- ── 3. no EXECUTE for API roles on trigger functions ─────────────────────────
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.prorettype = 'trigger'::regtype
       and (
         has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE')
       )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
