-- Homepage "Featured events" section — the homepage spot in the Full Feature
-- package (utils/featuredPackages.js, docs/event-featuring.md).
--
-- events.homepage_featured is separate from is_featured (the calendar
-- placement every package buys): the Stripe webhook sets both for a Full
-- Feature purchase, and an admin can switch either in the event form. The
-- homepage reads approved, not-yet-ended events with it set
-- (lib/homepageQueries.js → queryHomepageEvents).
--
-- Only admins and the service role may write it: organisers can edit their
-- own events, so a BEFORE trigger pins the column for everyone else (the
-- existing guard, trg_guard_event_organiser_write, pins is_featured the same
-- way).
--
-- events_public is recreated with the column appended — `create or replace
-- view` can't drop or reorder, so every column of
-- 20261029022225_event_organiser_logo.sql stays as it was.

alter table public.events
  add column if not exists homepage_featured boolean not null default false;

comment on column public.events.homepage_featured is
  'Shown in the homepage Featured events section while approved and not yet ended. Set by the Full Feature purchase or an admin; organisers cannot write it.';

create index if not exists events_homepage_featured_idx
  on public.events (start_date)
  where homepage_featured and status = 'approved'::event_status;

create or replace function public.guard_event_homepage_featured()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_admin boolean := public.event_caller_is_admin();
begin
  -- null = service role (no JWT), true = admin: they write anything.
  if v_admin is null or v_admin then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.homepage_featured := false;
  else
    new.homepage_featured := old.homepage_featured;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_event_homepage_featured on public.events;
create trigger trg_guard_event_homepage_featured
  before insert or update on public.events
  for each row execute function public.guard_event_homepage_featured();

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
  age_restrictions,
  facebook_video_url,
  gallery_images,
  ticket_prices,
  gallery_albums,
  event_videos,
  youtube_channel_url,
  tiktok_url,
  x_url,
  discord_url,
  vendor_application_url,
  organizer_logo_url,
  homepage_featured
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
