-- Minimal stand-in for the parts of the Supabase schema the past-events /
-- attendee-review migration touches. Used by
-- tests/db/run-event-attendee-review-migrations.sh only.
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;

create type notification_type as enum ('offer_received', 'system');
create type event_status as enum ('pending_review', 'approved', 'rejected', 'cancelled', 'completed');

create table public.profiles (id uuid primary key, display_name text, username text, is_admin boolean default false);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text, status event_status not null default 'pending_review',
  title text, slug text, description text, short_description text, image_url text,
  venue_name text, address text, suburb text, state text, postcode text,
  start_date date, end_date date, start_time time, end_time time,
  entry_fee_aud numeric, is_free boolean, website_url text, ticket_url text,
  is_cardpop_verified boolean, is_featured boolean, registration_required boolean, capacity int,
  tags text[], featured_card_games text[], seo_title text, seo_description text, seo_keywords text,
  organizer_name text, created_at timestamptz default now(), updated_at timestamptz default now(),
  instagram_url text, facebook_url text, youtube_url text, presale_fee_aud numeric,
  accessibility_info text, age_restrictions text, facebook_video_url text
);
alter table public.events enable row level security;
-- The live policy the migration alters (created by a pre-repo migration).
create policy "Public can view approved events" on public.events
  for select using (status = 'approved'::event_status);
create view public.events_public with (security_invoker = on) as
  select * from public.events where status = 'approved'::event_status;
create table public.notifications (
  id bigserial primary key, user_id uuid, type notification_type, title text, body text, link text, related_id uuid
);
create or replace function public.create_notification(p_user_id uuid, p_type notification_type, p_title text, p_body text, p_link text default null, p_related_id uuid default null)
returns void language sql security definer as
$$ insert into public.notifications (user_id, type, title, body, link, related_id) values (p_user_id, p_type, p_title, p_body, p_link, p_related_id) $$;

grant select on public.profiles, public.events, public.events_public to authenticated, anon;
