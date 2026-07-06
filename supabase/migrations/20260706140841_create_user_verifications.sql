-- Identity verification schema. The account verification form
-- (pages/account/AccountVerification.jsx), the admin review endpoint
-- (src/routes/admin.js PATCH /admin/verifications/:id), and the admin
-- Verification Management dashboard (pages/admin/AdminVerificationDashboard.jsx)
-- have all been reading/writing `user_verifications` and
-- `verification_audit_log` since they were built, but neither table was ever
-- committed as a migration -- so on any environment without out-of-band
-- dashboard changes, every query against them fails outright (surfaced in the
-- admin dashboard as "Failed to load verifications").

create table if not exists public.user_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_legal_name text not null,
  date_of_birth date,
  residential_address text,
  phone_number text,
  photo_id_path text,
  selfie_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended', 'revoked')),
  admin_notes text,
  additional_info_requested text,
  admin_id uuid references public.profiles(id),
  id_extracted_name text,
  name_match boolean,
  name_match_confidence text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_verifications_user_id on public.user_verifications(user_id);
create index if not exists idx_user_verifications_status on public.user_verifications(status);
create index if not exists idx_user_verifications_submitted_at on public.user_verifications(submitted_at desc);

alter table public.user_verifications enable row level security;

drop policy if exists "Users can view their own verifications" on public.user_verifications;
create policy "Users can view their own verifications"
  on public.user_verifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can submit their own verification" on public.user_verifications;
create policy "Users can submit their own verification"
  on public.user_verifications
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can view all verifications" on public.user_verifications;
create policy "Admins can view all verifications"
  on public.user_verifications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Deliberately no client-writable UPDATE policy: verification decisions are
-- written exclusively by the backend's service-role client after its own
-- isAdminUser check (src/routes/admin.js), so a direct client update can't be
-- used to self-approve.

-- Per-decision audit trail written by the same admin review endpoint.
create table if not exists public.verification_audit_log (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.user_verifications(id) on delete cascade,
  admin_id uuid references public.profiles(id),
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_verification_audit_log_verification_id on public.verification_audit_log(verification_id);

alter table public.verification_audit_log enable row level security;

drop policy if exists "Admins can view verification audit log" on public.verification_audit_log;
create policy "Admins can view verification audit log"
  on public.verification_audit_log
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Stamped by the review endpoint on approval; predates this migration like the
-- other verification columns added onto profiles.
alter table public.profiles
  add column if not exists verified_at timestamptz;
