-- Allow admins to manage (update / delete) any listing.
--
-- The `listings` table already had an "Admins can view all listings" SELECT
-- policy, but no matching admin UPDATE or DELETE policy. The only write policy
-- was "Sellers can update their own non-sold listings". Because the frontend
-- admin pages use the anon key (subject to RLS), an admin acting on another
-- user's listing — enabling, archiving, marking sold — passed the RLS row
-- filter to 0 rows: the request "succeeded" but changed nothing.
--
-- These permissive policies (OR-combined with the existing seller policies)
-- let a user flagged `profiles.is_admin = true` update or delete any listing,
-- mirroring the existing admin SELECT policy. The backend service_role key
-- bypasses RLS and is unaffected.

drop policy if exists "Admins can update all listings" on public.listings;
create policy "Admins can update all listings"
  on public.listings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "Admins can delete all listings" on public.listings;
create policy "Admins can delete all listings"
  on public.listings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
