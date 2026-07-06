-- Stripe Identity document verification embedded in signup.
-- Stores the user's latest Stripe Identity verification session so the
-- backend can re-sync status, and guarantees the verification fields the
-- webhook writes exist (they predate repo-tracked migrations, so the adds
-- are guarded for environments that already have them).

alter table public.profiles
  add column if not exists stripe_identity_session_id text;

alter table public.profiles
  add column if not exists verification_status text;

alter table public.profiles
  add column if not exists is_verified boolean default false;

alter table public.profiles
  add column if not exists legal_name text;

comment on column public.profiles.stripe_identity_session_id is
  'Latest Stripe Identity verification session (vs_...) for this user';
