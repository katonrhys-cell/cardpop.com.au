-- Australian grading submission partners: the stores and services that take a
-- collector's cards and submit them to PSA, Beckett (BGS), CGC, ACE, SGC or
-- TAG on their behalf. Shown on /grading/submission-partners (filtered by
-- ?company=psa… — where every "Grade with PSA" button on the estimator lands)
-- and on /grading/companies; maintained at Admin → Grading Partners.
--
--   * One row per business. `companies` lists the grading companies it submits
--     to (lower-case keys matching data/gradingCompanies.js) and
--     `company_links` an optional per-company page on the partner's site
--     ({"psa": "https://…/psa", "bgs": "https://…/beckett"}); the public page
--     links to that page for the selected company, else to `website`.
--   * The seed below is the lists that were hardcoded on the Compare Companies
--     page plus the partners researched for CGC, ACE, SGC and TAG on
--     2026-11-04. Rows insert `on conflict (slug) do nothing`, so an admin's
--     later edits survive a re-run. data/gradingPartnersSeed.js mirrors it for
--     the prerenderer and as the browser's fallback (a test keeps them in step).
--   * Adding a grading company means extending the `companies_known` check
--     here (new migration) and GRADING_COMPANIES in data/gradingCompanies.js.
--
-- See docs/grading-partners.md.

create table if not exists public.grading_submission_partners (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  website       text not null,
  -- "Melbourne, VIC", "Gold Coast, QLD", "Australia-wide (mail-in)"…
  location      text,
  -- One or two sentences, plain text.
  description   text,
  -- Which grading companies this partner submits to: psa | bgs | cgc | ace | sgc | tag.
  companies     text[] not null default '{}',
  -- Optional per-company page on the partner's site, keyed like `companies`.
  company_links jsonb not null default '{}'::jsonb,
  -- Free-text tags shown as chips: 'TCG', 'Sports Cards', 'AFL'…
  categories    text[] not null default '{}',
  -- Admin-only context: where the listing came from, what to re-check.
  notes         text,
  -- Lower sorts first.
  sort_order    integer not null default 100,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint grading_submission_partners_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint grading_submission_partners_companies_known check (companies <@ array['psa','bgs','cgc','ace','sgc','tag']::text[]),
  constraint grading_submission_partners_has_company check (cardinality(companies) >= 1),
  constraint grading_submission_partners_links_object check (jsonb_typeof(company_links) = 'object'),
  constraint grading_submission_partners_website_http check (website ~* '^https?://')
);

create index if not exists grading_submission_partners_active_sort_idx
  on public.grading_submission_partners (sort_order, name) where is_active;
create index if not exists grading_submission_partners_companies_idx
  on public.grading_submission_partners using gin (companies);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_grading_submission_partners_set_updated_at on public.grading_submission_partners;
create trigger trg_grading_submission_partners_set_updated_at
  before update on public.grading_submission_partners
  for each row execute function public.set_updated_at();

alter table public.grading_submission_partners enable row level security;

-- Anyone can read an active partner; admins also see inactive rows.
drop policy if exists grading_submission_partners_public_select on public.grading_submission_partners;
create policy grading_submission_partners_public_select on public.grading_submission_partners
  for select to public
  using (
    is_active
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists grading_submission_partners_admin_insert on public.grading_submission_partners;
create policy grading_submission_partners_admin_insert on public.grading_submission_partners
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists grading_submission_partners_admin_update on public.grading_submission_partners;
create policy grading_submission_partners_admin_update on public.grading_submission_partners
  for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists grading_submission_partners_admin_delete on public.grading_submission_partners;
create policy grading_submission_partners_admin_delete on public.grading_submission_partners
  for delete to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

grant select on public.grading_submission_partners to anon, authenticated;
grant insert, update, delete on public.grading_submission_partners to authenticated;

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- One row per line so tests/frontend/gradingPartners.test.js can read the slug
-- and companies back out and compare them with data/gradingPartnersSeed.js.
insert into public.grading_submission_partners
  (slug, name, website, location, description, companies, company_links, categories, notes, sort_order)
values
  ('the-hobby', 'The Hobby', 'https://thehobby.com.au', 'Sydney, NSW', 'Australia''s first PSA Certified Dealer in the Southern Hemisphere (since 2016), now also running monthly CGC group submissions. Grades TCG and sports cards including AFL and Pokémon.', array['psa','cgc']::text[], '{"psa": "https://thehobby.com.au/pages/grading-services", "cgc": "https://thehobby.com.au/pages/cgc-submission-process"}'::jsonb, array['TCG','Sports Cards']::text[], 'PSA from the former Compare Companies list; CGC from thehobby.com.au/pages/cgc-submission-process (2026-11-04).', 10),
  ('slabbys', 'Slabbys', 'https://slabbys.com.au', 'Australia-wide (mail-in)', 'Full-service PSA and Beckett submission with 7-stage tracking, fully insured, and transparent upfront pricing. 12 PSA tiers from Value Bulk to Walkthrough; BGS in four tiers with sub-grades on every card.', array['psa','bgs']::text[], '{"bgs": "https://slabbys.com.au/grading/beckett"}'::jsonb, array['TCG','Sports Cards']::text[], 'From the former Compare Companies lists.', 20),
  ('slabd', 'SLABD', 'https://slabd.com.au', 'Adelaide, SA', 'Australian-based, fully insured submission service — cards are insured from receipt through to return — with clear tiered pricing for PSA, Beckett and CGC. An SGC service page is also listed.', array['psa','bgs','cgc','sgc']::text[], '{"bgs": "https://slabd.com.au/beckett-grading-services-bgs/", "sgc": "https://slabd.com.au/sgc-services/"}'::jsonb, array['TCG','Sports Cards']::text[], 'PSA/BGS from the former lists. Home page lists PSA, BGS and CGC; the SGC page (slabd.com.au/sgc-services) is old — confirm SGC is still offered (2026-11-04).', 30),
  ('cherry-collectables', 'Cherry Collectables', 'https://www.cherrycollectables.com.au', 'Melbourne, VIC', 'PSA and Beckett submission with Melbourne store drop-off or mail-in. Accepts TCG and AFL/sports cards. Trusted community retailer with a strong collector following across Australia.', array['psa','bgs']::text[], '{"psa": "https://www.cherrycollectables.com.au/pages/grading", "bgs": "https://www.cherrycollectables.com.au/pages/beckett-grading"}'::jsonb, array['TCG','Sports Cards','AFL']::text[], 'From the former Compare Companies lists.', 40),
  ('mana-market', 'Mana Market', 'https://manamarket.com.au', 'Gold Coast, QLD', 'Gold Coast-based PSA Registered Dealer, ideal for Queensland collectors. Straightforward submission process with in-store drop-off available for local customers.', array['psa']::text[], '{"psa": "https://manamarket.com.au/pages/psa-grading-services"}'::jsonb, array['TCG','Sports Cards']::text[], 'From the former Compare Companies list.', 50),
  ('graded-cards-australia', 'Graded Cards Australia', 'https://gradedcardsaustralia.com.au', 'Australia-wide (mail-in)', 'Authorised BGS submission partner — cards are listed in the official BGS Population Report — and monthly SGC group submissions: collected in week one, checked in week two, sent in weeks three and four. Accepts AFL, NBA and Pokémon.', array['bgs','sgc']::text[], '{"bgs": "https://gradedcardsaustralia.com.au/collections/beckett-card-grading-australia", "sgc": "https://gradedcardsaustralia.com.au/collections/sgc-card-grading-australia"}'::jsonb, array['Sports Cards','AFL','NBA','TCG']::text[], 'BGS from the former list; SGC from gradedcardsaustralia.com.au/collections/sgc-card-grading-australia (2026-11-04).', 60),
  ('the-card-spot', 'The Card Spot', 'https://thecardspot.com.au', 'Australia-wide (mail-in)', 'Monthly BGS batch submissions — cards dispatched to Beckett the first week of each month. Suited to collectors who plan ahead and want a reliable, consistent submission process.', array['bgs']::text[], '{"bgs": "https://thecardspot.com.au/products/beckett-grading-bgs"}'::jsonb, array['TCG','Sports Cards']::text[], 'From the former Compare Companies list.', 70),
  ('collectible-madness', 'Collectible Madness', 'https://collectiblemadness.com.au', 'Australia-wide (mail-in)', 'CGC submission middleman — every batch is sent to CGC on the first business day of the month.', array['cgc']::text[], '{"cgc": "https://collectiblemadness.com.au/pages/cgc-grading-services"}'::jsonb, array['TCG']::text[], 'Researched 2026-11-04: collectiblemadness.com.au/pages/cgc-grading-services.', 80),
  ('leo-games', 'Leo Games', 'https://www.leogames.com.au', 'Sydney, NSW', 'Sydney card store offering CGC submissions with in-store drop-off or postal options.', array['cgc']::text[], '{"cgc": "https://www.leogames.com.au/pages/card-grading-services"}'::jsonb, array['TCG']::text[], 'Researched 2026-11-04: leogames.com.au/pages/card-grading-services.', 90),
  ('cardrevive', 'CardRevive', 'https://www.cardrevive.com.au', 'Sydney, NSW', 'Sydney-based middleman service — drop-off, card prep and submissions to CGC, ACE and TAG with per-card pricing published on its site.', array['cgc','ace','tag']::text[], '{"cgc": "https://www.cardrevive.com.au/grading/cgc-grading-australia", "ace": "https://www.cardrevive.com.au/card-grading-sydney", "tag": "https://www.cardrevive.com.au/grading/tag-grading-australia"}'::jsonb, array['TCG','Sports Cards']::text[], 'Researched 2026-11-04: cardrevive.com.au grading pages. Prices on its pages are vendor claims — check before quoting.', 100),
  ('crystal-collectables-tcg', 'Crystal Collectables TCG', 'https://crystalcollectablestcg.com.au', 'Gold Coast, QLD', 'In-store ACE Grading submissions: fill in the form, drop the cards off in a semi-rigid sleeve, and batches go to ACE fortnightly or once 30 cards have accumulated.', array['ace']::text[], '{"ace": "https://crystalcollectablestcg.com.au/pages/ace-submissions"}'::jsonb, array['TCG']::text[], 'Researched 2026-11-04: crystalcollectablestcg.com.au/pages/ace-submissions.', 110),
  ('tnt-cards', 'TNT Cards', 'https://www.tntcards.com', 'Australia-wide (mail-in)', 'SGC submission support — reviews and preps each card and matches it to an SGC service tier, at SGC''s standard grading fees.', array['sgc']::text[], '{"sgc": "https://www.tntcards.com/sgc-card-grading/"}'::jsonb, array['Sports Cards','TCG']::text[], 'Researched 2026-11-04: tntcards.com/sgc-card-grading.', 120),
  ('beckett-boy', 'Beckett Boy', 'https://www.beckettboy.com.au', 'Australia-wide (mail-in)', 'Card grading submission service with an SGC grading programme; contact details and current terms are on its site.', array['sgc']::text[], '{"sgc": "https://www.beckettboy.com.au/collections/sgc-card-grading-australia/card-grading"}'::jsonb, array['Sports Cards','TCG']::text[], 'Researched 2026-11-04: beckettboy.com.au SGC collection page. Newer entrant — verify.', 130),
  ('pgcg', 'PGCG', 'https://www.pgcg.au', 'Melbourne, VIC', 'TAG Grading''s authorised Australian affiliate — the only route to TAG from Australia — and a PSA middleman. Buy a slot online, then drop off at a participating Melbourne store or post to its PO box; cards received by the 25th ship on the 1st of the month.', array['tag','psa']::text[], '{"tag": "https://www.pgcg.au/products/tag-grading-value-service", "psa": "https://www.pgcg.au/pages/grading-services"}'::jsonb, array['TCG','Sports Cards']::text[], 'Researched 2026-11-04: help.taggrading.com names PGCG.AU as the Australian affiliate; pgcg.au/pages/grading-services.', 140)
on conflict (slug) do nothing;
