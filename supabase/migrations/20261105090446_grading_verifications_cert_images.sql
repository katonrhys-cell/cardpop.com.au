-- Cache PSA cert images beside the cert record.
--
-- The Certification panel on a graded card's page called PSA twice per view
-- (GetByCertNumber + GetImagesByCertNumber) with no cache. The record is now
-- kept on the grading_verifications row the verification check already
-- writes (details), and the images go here; src/routes/psa.js serves both
-- from the row for 30 days. Null means the images were never fetched.

alter table public.grading_verifications
  add column if not exists images jsonb;
