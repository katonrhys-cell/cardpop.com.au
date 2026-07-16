-- Tighten the client INSERT policy on public.user_verifications.
--
-- The original policy (20260706140841) only checked ownership:
--   with check (user_id = auth.uid())
-- so an authenticated user calling PostgREST directly with the anon key could
-- self-insert a row with status = 'approved', name_match = true, a forged
-- id_extracted_name, an admin_id, etc. This grants NO real verification
-- privilege — the trust anchor (profiles.is_verified / verification_status) is
-- written only by the backend service-role after its isAdminUser check — but it
-- lets a user pollute / mislead the admin review queue
-- (AdminVerificationDashboard) and insert unbounded rows.
--
-- All legitimate verification writes go through the backend service-role client
-- (which bypasses RLS), and no browser code inserts into this table directly, so
-- constraining the client INSERT path is safe: force a fresh submission to be
-- 'pending' with every admin-decision / ID-extraction column null. Reviewers set
-- those later, server-side.
--
-- NOTE: the live database also carries a SECOND, drifted INSERT policy
-- (`users_insert_own_verification`, applied to the `public` role via the
-- dashboard and never committed here) with the same loose check. RLS permissive
-- policies are OR'd, so tightening only one would leave the loose path open —
-- drop the drifted duplicate too. anon can never satisfy auth.uid() = user_id,
-- so a single `authenticated` policy loses no legitimate access.

drop policy if exists "users_insert_own_verification" on public.user_verifications;
drop policy if exists "Users can submit their own verification" on public.user_verifications;
create policy "Users can submit their own verification"
  on public.user_verifications
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and admin_id is null
    and admin_notes is null
    and additional_info_requested is null
    and id_extracted_name is null
    and name_match is null
    and name_match_confidence is null
    and reviewed_at is null
  );
