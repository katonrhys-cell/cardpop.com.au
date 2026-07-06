-- public.partner_referrals is a commission ledger — rows can carry
-- status='paid' with a real stripe_transfer_id, i.e. financial audit
-- records. Its partner_id FK was created ON DELETE CASCADE
-- (20260706080942_create_partner_program.sql), so deleting a partner (or a
-- cascading delete from auth.users via partners.user_id ... on delete
-- cascade) would silently destroy that history. Switch to RESTRICT: a
-- partner with any referral history cannot be deleted outright — the
-- decision to archive/reassign that history has to be explicit.

alter table public.partner_referrals
  drop constraint if exists partner_referrals_partner_id_fkey;

alter table public.partner_referrals
  add constraint partner_referrals_partner_id_fkey
  foreign key (partner_id) references public.partners (id) on delete restrict;
