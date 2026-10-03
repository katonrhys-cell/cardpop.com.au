-- Verified-purchase reviews of shop (catalogue) products.
--
-- Separate from seller_ratings, which rate a seller on a marketplace order. A
-- shop review is about a product, written by someone who bought it, and is
-- moderated before it shows.
--
-- The DB owns the rules (the same stance as the offers lifecycle): a BEFORE
-- INSERT trigger checks the order really is the reviewer's, really has shipped
-- and really contained this product, and forces `status = 'pending'` — a client
-- can never publish its own review. Moderation is a service-role write from
-- /shop-reviews/admin (requireAdmin), so there is no user UPDATE policy.
--
-- Colour siblings (shop_products.family_sku) share one pool of reviews: a
-- binder is reviewed as "the binder", not once per colour. `pool_key` is the
-- family_sku, or the product id for a product with no family.

create table if not exists public.shop_product_reviews (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.shop_products(id) on delete cascade,
  pool_key       text not null,
  order_id       uuid not null references public.orders(id) on delete cascade,
  reviewer_id    uuid not null references public.profiles(id) on delete cascade,
  reviewer_name  text not null default 'CardPop buyer',
  rating         smallint not null check (rating between 1 and 5),
  title          text check (title is null or char_length(title) <= 120),
  body           text check (body is null or char_length(body) <= 2000),
  status         text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  moderation_note text,
  moderated_by   uuid references public.profiles(id) on delete set null,
  moderated_at   timestamptz,
  created_at     timestamptz not null default now(),
  constraint shop_product_reviews_one_per_order unique (order_id, product_id)
);

create index if not exists shop_product_reviews_pool_idx
  on public.shop_product_reviews (pool_key, created_at desc) where status = 'published';
create index if not exists shop_product_reviews_status_idx
  on public.shop_product_reviews (status, created_at desc);
create index if not exists shop_product_reviews_reviewer_idx
  on public.shop_product_reviews (reviewer_id);
create index if not exists shop_product_reviews_product_idx
  on public.shop_product_reviews (product_id);

-- ── Insert guard ────────────────────────────────────────────────────────────
create or replace function public.shop_product_reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   record;
  v_family  text;
  v_name    text;
begin
  select o.buyer_id, o.status::text as status, to_jsonb(o.order_items) as lines
    into v_order
    from public.orders o
   where o.id = new.order_id;

  if not found or v_order.buyer_id is distinct from new.reviewer_id then
    raise exception 'You can only review products from your own orders'
      using errcode = '42501';
  end if;

  if v_order.status not in ('shipped', 'completed') then
    raise exception 'You can review a product once your order has shipped'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_order.lines) is distinct from 'array'
     or not exists (
       select 1 from jsonb_array_elements(v_order.lines) l
        where l->>'type' = 'shop' and l->>'id' = new.product_id::text
     ) then
    raise exception 'That product is not on this order'
      using errcode = '22023';
  end if;

  select family_sku into v_family from public.shop_products where id = new.product_id;
  new.pool_key := coalesce(nullif(btrim(v_family), ''), new.product_id::text);

  select nullif(btrim(coalesce(p.display_name, p.username, '')), '') into v_name
    from public.profiles p where p.id = new.reviewer_id;
  new.reviewer_name := left(coalesce(v_name, 'CardPop buyer'), 60);

  -- Lifecycle is the DB's, never the client's.
  new.status := 'pending';
  new.moderation_note := null;
  new.moderated_by := null;
  new.moderated_at := null;
  new.title := nullif(btrim(new.title), '');
  new.body := nullif(btrim(new.body), '');
  return new;
end;
$$;

drop trigger if exists trg_shop_product_reviews_before_insert on public.shop_product_reviews;
create trigger trg_shop_product_reviews_before_insert
  before insert on public.shop_product_reviews
  for each row execute function public.shop_product_reviews_before_insert();

-- ── Tell the admins a review is waiting ─────────────────────────────────────
alter type notification_type add value if not exists 'product_review_pending';

create or replace function public.notify_admins_product_review()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_title text;
  v_admin record;
begin
  select title into v_title from public.shop_products where id = new.product_id;
  for v_admin in select id from public.profiles where is_admin = true loop
    perform create_notification(
      v_admin.id, 'product_review_pending',
      'Product review to moderate',
      new.rating::text || '-star review of ' || coalesce(v_title, 'a product'),
      '/admin/product-reviews', new.id
    );
  end loop;
  return new;
exception when others then
  -- A notification problem must never block a review.
  return new;
end;
$$;

drop trigger if exists trg_shop_product_reviews_notify on public.shop_product_reviews;
create trigger trg_shop_product_reviews_notify
  after insert on public.shop_product_reviews
  for each row execute function public.notify_admins_product_review();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.shop_product_reviews enable row level security;

drop policy if exists "Published product reviews are public" on public.shop_product_reviews;
create policy "Published product reviews are public"
  on public.shop_product_reviews for select
  using (status = 'published');

drop policy if exists "Reviewers can read their own product reviews" on public.shop_product_reviews;
create policy "Reviewers can read their own product reviews"
  on public.shop_product_reviews for select
  to authenticated
  using (reviewer_id = (select auth.uid()));

drop policy if exists "Buyers can write a product review" on public.shop_product_reviews;
create policy "Buyers can write a product review"
  on public.shop_product_reviews for insert
  to authenticated
  with check (reviewer_id = (select auth.uid()));

grant select on public.shop_product_reviews to anon, authenticated;
grant insert on public.shop_product_reviews to authenticated;

-- Rating summary per pool, published reviews only.
create or replace view public.shop_product_review_stats
with (security_invoker = true) as
  select pool_key,
         count(*)::int                       as review_count,
         round(avg(rating)::numeric, 2)      as average_rating
    from public.shop_product_reviews
   where status = 'published'
   group by pool_key;

grant select on public.shop_product_review_stats to anon, authenticated;

comment on table public.shop_product_reviews is
  'Verified-purchase reviews of shop products. Insert guarded + status forced to pending by trigger; moderated via the backend (service role).';
