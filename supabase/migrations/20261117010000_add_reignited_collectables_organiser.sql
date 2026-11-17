-- Add "Reignited Collectables" to the saved organiser list (event_organisers),
-- so it can be picked on the event form's Organiser tab and gets its own page at
-- /events/organisers/reignited-collectables.
--
-- Name only: the logo, description and social links are added from the event
-- form / the organiser page editor once they are known. The draft event seeded in
-- 20261116234738 already uses organizer_name = 'Reignited Collectables', so it
-- shows up on the organiser's page as soon as an admin approves it.
--
-- Idempotent: one row per case-insensitive name.

insert into public.event_organisers (name)
values ('Reignited Collectables')
on conflict do nothing;
