-- Add optional accessibility information and age restrictions to events. Both
-- are free-text fields on the event form (admin and user submissions); the
-- event detail page and quick-view modal render an "Accessibility" and an
-- "Age Restrictions" heading under "About this event" only when filled in.
--
-- events_public is the anon-facing view the frontend reads (approved events,
-- public-safe columns only), so it must be recreated to expose the new
-- columns. It was created with security_invoker=on; keep that intact.
-- Also exposes presale_fee_aud, which was added to events (20260717095630)
-- without recreating the view — the public event page's entry-fee display and
-- JSON-LD offers already read it but could never see it.

alter table public.events add column if not exists accessibility_info text;
alter table public.events add column if not exists age_restrictions text;

comment on column public.events.accessibility_info is
  'Free-text accessibility details (wheelchair access, step-free entry, accessible parking/toilets, etc). Null = not provided; the event page only shows its Accessibility section when set.';
comment on column public.events.age_restrictions is
  'Free-text age restrictions or guidance (e.g. "18+", "All ages — under 15s accompanied by an adult"). Null = not provided.';

create or replace view public.events_public
with (security_invoker = on) as
select
  id,
  event_type,
  status,
  title,
  slug,
  description,
  short_description,
  image_url,
  venue_name,
  address,
  suburb,
  state,
  postcode,
  start_date,
  end_date,
  start_time,
  end_time,
  entry_fee_aud,
  is_free,
  website_url,
  ticket_url,
  is_cardpop_verified,
  is_featured,
  registration_required,
  capacity,
  tags,
  featured_card_games,
  seo_title,
  seo_description,
  seo_keywords,
  organizer_name,
  created_at,
  updated_at,
  instagram_url,
  facebook_url,
  youtube_url,
  presale_fee_aud,
  accessibility_info,
  age_restrictions
from public.events
where status = 'approved'::event_status;
