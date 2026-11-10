-- Paid Featured Placement for events (utils/featuredPackages.js).
--
-- One row per Stripe Checkout Session an organiser opens from Account → My
-- Events. The API (service role, src/routes/event-feature.js) writes the row
-- `pending` with the price it charged; the Stripe webhook marks it `paid` and
-- switches events.is_featured on (src/services/eventFeatureService.js), or
-- `expired` when the session lapses unpaid. The browser never writes here:
-- the organiser reads their own rows, admins read everything.

-- Bell type for "your event is featured" / "Featured Placement paid".
alter type notification_type add value if not exists 'event_featured';

create table if not exists public.event_feature_purchases (
  id                       uuid primary key default gen_random_uuid(),
  event_id                 uuid not null references public.events(id) on delete cascade,
  organiser_id             uuid not null references public.profiles(id) on delete cascade,
  package                  text not null,
  base_aud                 numeric(10,2) not null check (base_aud >= 0),
  discount_aud             numeric(10,2) not null default 0 check (discount_aud >= 0),
  amount_aud               numeric(10,2) not null check (amount_aud >= 0),
  early_bird               boolean not null default false,
  status                   text not null default 'pending',
  stripe_session_id        text unique,
  stripe_payment_intent_id text,
  paid_at                  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint event_feature_purchases_package_known
    check (package in ('spotlight', 'spotlight_instagram', 'full')),
  constraint event_feature_purchases_status_known
    check (status in ('pending', 'paid', 'expired', 'refunded'))
);

create index if not exists event_feature_purchases_event_idx
  on public.event_feature_purchases (event_id);
create index if not exists event_feature_purchases_organiser_idx
  on public.event_feature_purchases (organiser_id, created_at desc);
-- At most one paid featuring per event.
create unique index if not exists event_feature_purchases_one_paid_per_event
  on public.event_feature_purchases (event_id) where status = 'paid';

alter table public.event_feature_purchases enable row level security;

revoke all on public.event_feature_purchases from anon, authenticated;
grant select on public.event_feature_purchases to authenticated;

drop policy if exists "Organisers read their own feature purchases" on public.event_feature_purchases;
create policy "Organisers read their own feature purchases"
  on public.event_feature_purchases
  for select to authenticated
  using ((select auth.uid()) = organiser_id or (select public.event_caller_is_admin()));
