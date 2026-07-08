-- Business / ABN billing details for tax invoices.
--
-- When a buyer checks out as a business they can supply a business name and
-- ABN on the billing step. The ABN is also attached to their Stripe customer
-- (au_abn tax id) so Stripe issues a valid Australian tax invoice, but we keep
-- a copy on the order for our own records and reporting.
--
-- Backward-compatible: both columns are nullable and default null, so existing
-- checkout inserts that omit them keep working unchanged.

alter table public.orders
  add column if not exists billing_business_name text,
  add column if not exists billing_abn text;

comment on column public.orders.billing_business_name is
  'Business/trading name supplied at checkout for a business purchase (tax invoice). Null for personal orders.';
comment on column public.orders.billing_abn is
  '11-digit Australian Business Number supplied at checkout for a business purchase. Null for personal orders.';
