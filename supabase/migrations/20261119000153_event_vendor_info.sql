-- Vendor information on an event.
--
-- A show's organiser usually runs a whole vendor programme beside the ticket
-- sales — an application form, a vendor FAQ, a PDF trader pack, a floor plan.
-- The event form's new **Vendors** tab collects it in one place, and the event
-- page shows it as a "Vendor Information" section, linked from a
-- "Want to be a vendor?" line under the RSVP buttons. Nothing shows until
-- something is entered.
--
--   vendor_info jsonb  { intro, faqs: [{ question, answer }],
--                        documents: [{ title, url }], links: [{ label, url }] }
--                      Shape, limits and cleaning: utils/eventVendorInfo.js.
--                      The application link stays its own column,
--                      vendor_application_url (now edited on the Vendors tab).
--
-- An ordinary organiser-editable column (guard_event_organiser_write does not
-- pin it), logged on live edits via event_logged_fields(), read by the public
-- page through events_public (recreated with the column appended — everything
-- else is 20261111092216_event_side_events_and_prizes.sql).
--
-- Documents upload into the `events` bucket under vendor-info/<uuid>.<ext>
-- (utils/uploadEventVendorFile.js), so the bucket now also takes PDFs.

alter table public.events add column if not exists vendor_info jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_vendor_info_is_object') then
    alter table public.events
      add constraint events_vendor_info_is_object check (jsonb_typeof(vendor_info) = 'object');
  end if;
end $$;

comment on column public.events.vendor_info is
  'Vendor information ({intro, faqs[{question, answer}], documents[{title, url}], links[{label, url}]}, see utils/eventVendorInfo.js). Empty object = none.';

-- Trader packs are usually PDFs. Keep the bucket's existing types and add it.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
    set allowed_mime_types = (
      select array_agg(distinct t)
      from unnest(coalesce(allowed_mime_types, '{}'::text[]) || array['application/pdf']) as t
    )
    where id = 'events' and allowed_mime_types is not null;
  end if;
end $$;

create or replace function public.event_logged_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'title', 'short_description', 'description', 'accessibility_info', 'age_restrictions',
    'event_type', 'featured_card_games', 'image_url', 'gallery_images', 'gallery_albums', 'event_videos',
    'side_events', 'event_prizes', 'prize_pool', 'vendor_info',
    'venue_name', 'address', 'suburb', 'state', 'postcode',
    'start_date', 'end_date', 'start_time', 'end_time',
    'organizer_name', 'organizer_logo_url', 'organizer_email', 'organizer_phone',
    'website_url', 'ticket_url', 'vendor_application_url', 'tickets_sold_out', 'waitlist_url', 'booking_fee_aud',
    'instagram_url', 'facebook_url', 'youtube_url', 'youtube_channel_url', 'tiktok_url', 'x_url', 'discord_url',
    'facebook_video_url',
    'entry_fee_aud', 'presale_fee_aud', 'ticket_prices', 'is_free', 'capacity', 'registration_required',
    'seo_title', 'seo_description', 'seo_keywords', 'tags', 'source_url'
  ]::text[]
$$;

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
  homepage_featured,
  tickets_sold_out,
  waitlist_url,
  booking_fee_aud,
  side_events,
  event_prizes,
  prize_pool,
  vendor_info
from public.events
where status in ('approved'::event_status, 'completed'::event_status);
