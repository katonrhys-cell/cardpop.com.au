-- Promotion extras for events (EVENT_EXTRAS in utils/featuredPackages.js):
-- an Instagram story ($49), an Instagram post ($99) or a full event review
-- ($199), bought per event by any organiser on any plan.
--
-- They are deliberately separate from Featured Placement and from membership:
-- an extra never touches events.is_featured, an event can carry each extra
-- once whether or not it is featured, and an Ultimate member (whose events
-- are featured by the membership) buys them like anyone else.
--
-- Extras ride the same purchase table and Stripe flow as Featured Placement
-- (event_feature_purchases; src/services/eventFeatureService.js) — the
-- `package` column tells the two apart:
--
--   featuring  spotlight            (+ spotlight_instagram, full: sold until
--                                    2026-11, kept so old rows stay valid)
--   extras     story, post, review
--
-- Idempotent. Test: tests/db/run-event-feature-purchases-migration.sh.

alter table public.event_feature_purchases
  drop constraint if exists event_feature_purchases_package_known;
alter table public.event_feature_purchases
  add constraint event_feature_purchases_package_known
  check (package in ('spotlight', 'spotlight_instagram', 'full', 'story', 'post', 'review'));

-- "At most one paid featuring per event" used to cover every row. It now
-- covers the featuring packages only, and each extra is unique per event on
-- its own — so a story and a post can sit beside a Spotlight.
drop index if exists public.event_feature_purchases_one_paid_per_event;

create unique index if not exists event_feature_purchases_one_paid_featuring
  on public.event_feature_purchases (event_id)
  where status = 'paid' and package in ('spotlight', 'spotlight_instagram', 'full');

create unique index if not exists event_feature_purchases_one_paid_extra
  on public.event_feature_purchases (event_id, package)
  where status = 'paid' and package in ('story', 'post', 'review');
