-- Who issues the tax invoice. The PDF tax invoice an admin downloads from Order
-- Management / Admin → Invoices must name the supplier and show its ABN (an
-- invoice for a taxable sale of $82.50 or more is not a valid tax invoice
-- without it). The details are DATA — edited in Admin → Invoices → "Invoice
-- details" — so the ABN never has to be hard-coded or deployed. Seeded blank:
-- the PDF still renders, and the admin page warns until the ABN is filled in.
insert into public.platform_settings (key, value, label, description, group_name)
values (
  'invoice_supplier_details',
  '{"legal_name":"CardPop","abn":"","address":"","email":"admin@cardpop.com.au","phone":"","footer_note":""}'::jsonb,
  'Tax invoice: supplier details',
  'JSON object printed on every PDF tax invoice and credit note: legal_name, abn, address, email, phone, footer_note. Edit in Admin → Invoices → Invoice details.',
  'accounting'
)
on conflict (key) do nothing;
