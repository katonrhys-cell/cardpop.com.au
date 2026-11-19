-- Organiser pages: public contact details.
--
-- A confirmed organiser can show a contact name, email address and phone
-- number on their page (/events/organisers/<slug>) so traders and collectors
-- can reach them directly. All three are optional and are public by the
-- organiser's own choice — they are entered in "Edit page", never copied from
-- the member's account. The owner guard trigger only pins name / slug / owner /
-- created_at, so the existing update policy covers these columns.

alter table public.event_organisers
  add column if not exists contact_name  text check (contact_name  is null or char_length(btrim(contact_name)) between 1 and 80),
  add column if not exists contact_email text check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  add column if not exists contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9(][0-9 ()-]{5,23}$');

comment on column public.event_organisers.contact_name is
  'Who to ask for (optional), shown publicly on the organiser page.';
comment on column public.event_organisers.contact_email is
  'Public contact email the organiser chose to show on their page — not their account email.';
comment on column public.event_organisers.contact_phone is
  'Public contact phone the organiser chose to show on their page.';
