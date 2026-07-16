-- Stop exposing store submitters' contact email to the public.
--
-- The "Public can read approved stores" policy is `using (status = 'approved')`
-- with no column restriction, so anyone with the anon key (and any signed-in
-- user) could read submitter_email / submitted_by for every approved store:
--   supabase.from('local_game_stores').select('submitter_email').eq('status','approved')
-- disclosing the personal email a community member gave when submitting a store.
--
-- Fix with column-level SELECT grants (PostgREST honours them), mirroring the
-- profiles hardening: revoke the blanket table SELECT from the API roles and
-- re-grant SELECT only on the public directory columns, omitting submitter_email
-- and submitted_by. The public directory, partner page, prerender and sitemap
-- all read only public columns already, so they are unaffected. The admin
-- dashboard's read of submitter_email moves to a service-role backend endpoint
-- (GET /stores/admin); service_role is unaffected here and keeps full access.

revoke select on public.local_game_stores from anon, authenticated;

grant select (
  id,
  slug,
  name,
  suburb,
  city,
  state,
  address,
  website,
  phone,
  categories,
  description,
  status,
  created_at,
  updated_at
) on public.local_game_stores to anon, authenticated;
