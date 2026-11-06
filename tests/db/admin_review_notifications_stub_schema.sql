-- Minimal stand-in for production, as it stood before
-- 20261106061312_admin_review_notification_types.sql: the live
-- notification_type enum lacks 'event_pending_review'. Only what the
-- migration and its test touch.
create extension if not exists pgcrypto;
create schema if not exists extensions;

create type public.notification_type as enum ('system', 'offer_received', 'product_review_pending');

create table public.profiles (id uuid primary key default gen_random_uuid(), is_admin boolean not null default false);
create table public.notification_preferences (user_id uuid, type text, in_app boolean);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, type public.notification_type not null,
  title text, body text, link text, related_id uuid,
  created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text, status text not null default 'pending_review',
  auto_discovered boolean default false, organiser_id uuid
);

-- Copied from production (pg_get_functiondef, 2026-11-06).
create or replace function public.create_notification(p_user_id uuid, p_type notification_type, p_title text, p_body text, p_link text default null, p_related_id uuid default null)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  if exists (select 1 from notification_preferences where user_id = p_user_id and type = p_type::text and in_app = false) then return; end if;
  if exists (select 1 from notifications where user_id = p_user_id and type = p_type
      and coalesce(related_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_related_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and created_at > now() - interval '60 seconds') then return; end if;
  insert into notifications (user_id, type, title, body, link, related_id) values (p_user_id, p_type, p_title, p_body, p_link, p_related_id);
end; $$;

insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000a2', true),
  ('00000000-0000-0000-0000-0000000000b1', false);
