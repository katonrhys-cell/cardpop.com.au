-- Minimal stand-in for the parts of the Supabase schema the event organiser
-- review migration touches (20261109235618_event_organiser_review_flow.sql).
-- Used by tests/db/run-event-organiser-review-migration.sh only.
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;

create type notification_type as enum ('event_approved', 'event_rejected', 'event_pending_review', 'system');
create type event_status as enum ('pending_review', 'approved', 'rejected', 'cancelled', 'completed');
create type event_type as enum ('card_show', 'trade_event', 'community_event', 'lgs_event');

create table public.profiles (id uuid primary key, display_name text, username text, is_admin boolean default false);

-- Same columns (and types) as production public.events.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid, reviewed_by uuid,
  event_type event_type default 'community_event', status event_status not null default 'pending_review',
  title text, slug text, description text, image_url text,
  venue_name text, address text, suburb text, state text, postcode text,
  start_date date, end_date date, start_time time, end_time time,
  entry_fee_aud numeric default 0, is_free boolean default true, website_url text, ticket_url text,
  is_cardpop_verified boolean default false, tags text[], rejection_reason text, reviewed_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  short_description text, seo_title text, seo_description text, seo_keywords text[],
  organizer_name text, organizer_email text, organizer_phone text, capacity integer,
  featured_card_games text[], source_url text, is_featured boolean default false, registration_required boolean default false,
  instagram_url text, facebook_url text, youtube_url text, presale_fee_aud numeric,
  accessibility_info text, age_restrictions text, facebook_video_url text,
  auto_discovered boolean default false, discovered_at timestamptz,
  gallery_images text[] default '{}', ticket_prices jsonb default '[]', gallery_albums jsonb default '[]',
  event_videos jsonb default '[]', youtube_channel_url text, tiktok_url text, x_url text, discord_url text,
  vendor_application_url text, organizer_logo_url text
);
alter table public.events enable row level security;

-- The live policies (created before the repo owned the schema).
create policy "Authenticated users can submit events" on public.events for insert
  with check ((select auth.uid()) = organiser_id and status = 'pending_review'::event_status);
create policy "Organisers can update pending events" on public.events for update
  using ((select auth.uid()) = organiser_id and status = 'pending_review'::event_status);
create policy "Organisers can view their own events" on public.events for select
  using ((select auth.uid()) = organiser_id);
create policy "Public can view approved events" on public.events for select
  using (status = any (array['approved'::event_status, 'completed'::event_status]));
create policy admins_manage_events on public.events for all
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

create table public.notifications (
  id bigserial primary key, user_id uuid, type notification_type, title text, body text, link text, related_id uuid
);
create or replace function public.create_notification(p_user_id uuid, p_type notification_type, p_title text, p_body text, p_link text default null, p_related_id uuid default null)
returns void language sql security definer as
$$ insert into public.notifications (user_id, type, title, body, link, related_id) values (p_user_id, p_type, p_title, p_body, p_link, p_related_id) $$;

grant select on public.profiles to authenticated, anon;
grant select, insert, update, delete on public.events to authenticated;
grant select on public.events to anon;

-- Member ticket offers (20261025075600_event_ticket_offers.sql), as far as the
-- organiser-offer migration (20261110002320) touches them.
create table public.event_ticket_offers (
  event_id uuid primary key references public.events(id) on delete cascade,
  offer_text text, discount_code text,
  referral_url text check (referral_url is null or referral_url ~* '^https?://[^[:space:]]+$'),
  is_active boolean not null default true,
  ticket_clicks integer not null default 0, code_reveals integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.event_ticket_offers enable row level security;
create policy "Admins manage event ticket offers" on public.event_ticket_offers for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
grant select, insert, update, delete on public.event_ticket_offers to authenticated;
