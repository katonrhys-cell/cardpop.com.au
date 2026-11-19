-- Organiser pages: a contact link.
--
-- Where enquiries for this organiser should go — their own contact form or
-- ticketing-site contact page. When set, the organiser page shows a "Contact"
-- button at the top that opens it, in place of the on-site Message button.
-- An admin (or the page's owner) sets it in "Edit page" on
-- /events/organisers/<slug>; the owner guard trigger only pins name / slug /
-- owner / created_at, so no policy or grant change is needed.

alter table public.event_organisers
  add column if not exists contact_url text check (contact_url is null or contact_url ~* '^https?://[^[:space:]]+$');

comment on column public.event_organisers.contact_url is
  'Where enquiries for this organiser go (their contact form), http(s) only. Shown as the Contact button at the top of the organiser page; not a social profile, so not in Organization sameAs.';
