-- Joint organisers: an organiser page can carry more than one logo.
--
-- `logo_url` stays the primary logo (event pages, og:image, JSON-LD). The
-- additional marks sit beside it on the organiser page, in order. The owner may
-- edit them like the rest of their public profile (the owner guard trigger only
-- pins name / slug / owner / created_at).

alter table public.event_organisers
  add column if not exists extra_logo_urls text[] not null default '{}'
    check (cardinality(extra_logo_urls) <= 5);

comment on column public.event_organisers.extra_logo_urls is
  'Additional logos (http(s) URLs, display order) for a joint organiser, shown beside logo_url on the organiser page.';
