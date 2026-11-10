-- Organisers can keep an event as a private draft before submitting it for
-- review (docs/event-submissions.md). The value has to be committed before
-- anything can use it, so the policies and triggers that do are in the next
-- migration (20261110…_event_organiser_drafts.sql).
alter type event_status add value if not exists 'draft' before 'pending_review';
