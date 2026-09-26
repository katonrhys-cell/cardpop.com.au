-- Shipment tracking on orders. Written only by the admin "mark as shipped"
-- endpoint (POST /admin/orders/:id/ship, service role), which also emails the
-- buyer their tracking link. shipping_notified_at records when that email went
-- out, so the admin table can show whether the customer has been told.
alter table public.orders add column if not exists tracking_carrier text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists shipping_notified_at timestamptz;
