-- More kinds of event for the calendar.
--
-- The event form only offered Card Show / Trade Event / Community Event / LGS
-- Event, which doesn't fit shows such as a comic & toy fair, a collectables
-- market, a pop culture convention or a stand-alone tournament. The values are
-- mirrored in utils/eventTypes.js (EVENT_TYPES) — keep the two in step.
--
-- ADD VALUE IF NOT EXISTS is idempotent; the new values are not used in this
-- migration, so it is safe inside the migration transaction (PG 12+).
alter type public.event_type add value if not exists 'comic_toy_fair';
alter type public.event_type add value if not exists 'collectables_fair';
alter type public.event_type add value if not exists 'convention';
alter type public.event_type add value if not exists 'tournament';
