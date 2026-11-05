-- Behavioural checks for 20261104192816_grading_submission_partners.sql.
\set ON_ERROR_STOP on

-- Seed landed, once.
do $$ declare n int; begin
  select count(*) into n from public.grading_submission_partners;
  if n <> 14 then raise exception 'expected 14 seeded partners, got %', n; end if;
end $$;

-- Every seeded partner has at least one known company and an http(s) website.
do $$ declare n int; begin
  select count(*) into n from public.grading_submission_partners where cardinality(companies) = 0 or website !~* '^https?://';
  if n <> 0 then raise exception '% seeded rows have no company or a bad website', n; end if;
end $$;

-- Constraints: unknown company, no company, bad slug, non-object links.
do $$ begin
  begin
    insert into public.grading_submission_partners (slug, name, website, companies) values ('x-bad-co', 'X', 'https://x', array['psaa']);
    raise exception 'unknown company accepted';
  exception when check_violation then null; end;
  begin
    insert into public.grading_submission_partners (slug, name, website, companies) values ('x-no-co', 'X', 'https://x', '{}');
    raise exception 'empty companies accepted';
  exception when check_violation then null; end;
  begin
    insert into public.grading_submission_partners (slug, name, website, companies) values ('Bad Slug', 'X', 'https://x', array['psa']);
    raise exception 'bad slug accepted';
  exception when check_violation then null; end;
  begin
    insert into public.grading_submission_partners (slug, name, website, companies, company_links) values ('x-links', 'X', 'https://x', array['psa'], '[]'::jsonb);
    raise exception 'array company_links accepted';
  exception when check_violation then null; end;
end $$;

-- updated_at moves on update.
do $$ declare before_ts timestamptz; after_ts timestamptz; begin
  select updated_at into before_ts from public.grading_submission_partners where slug = 'pgcg';
  perform pg_sleep(0.01);
  update public.grading_submission_partners set location = 'Melbourne, VIC (Mordialloc)' where slug = 'pgcg';
  select updated_at into after_ts from public.grading_submission_partners where slug = 'pgcg';
  if after_ts <= before_ts then raise exception 'updated_at did not advance'; end if;
end $$;

-- RLS: anon reads only active rows; a non-admin can't write; an admin can.
update public.grading_submission_partners set is_active = false where slug = 'beckett-boy';
set role anon;
do $$ declare n int; begin
  select count(*) into n from public.grading_submission_partners;
  if n <> 13 then raise exception 'anon should see 13 active rows, saw %', n; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    insert into public.grading_submission_partners (slug, name, website, companies) values ('member-row', 'Member', 'https://m.example', array['psa']);
    raise exception 'non-admin insert accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.grading_submission_partners (slug, name, website, companies) values ('admin-row', 'Admin Added', 'https://a.example', array['sgc']);
do $$ declare n int; begin
  select count(*) into n from public.grading_submission_partners;
  if n <> 15 then raise exception 'admin should see 15 rows (incl. the inactive one), saw %', n; end if;
end $$;
reset role;
select 'ok' as grading_partners_migration;
