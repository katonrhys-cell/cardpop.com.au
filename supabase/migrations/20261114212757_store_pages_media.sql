-- Card shop pages: every store in the directory gets its own page
-- (/card-shops/<city>/<slug>) that an admin can fill in — street address,
-- phone, opening hours, Instagram, a photo gallery and videos.
--
--   photos  [{ "url": "...", "caption": "..." }]                    display order
--   videos  [{ "url": "...", "poster_url": "...", "caption": "..." }]
--
-- A url is an http(s) link (an upload to the admin-only `media` bucket, or a
-- YouTube/Vimeo link for a video) or a site-relative path to a file bundled
-- with the app. utils/storePage.js is the one normaliser; nothing here trusts
-- the shape beyond "it is an array".
--
-- Also: admins can add a store straight from Admin → Store Directory (the
-- table had no INSERT policy — public submissions go through the API with the
-- service role and still do), and Swap Itt's Melbourne shop is added with the
-- photos taken in store.
-- See docs/store-pages.md.

alter table public.local_game_stores
  add column if not exists opening_hours text,
  add column if not exists instagram_url text,
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists videos jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'local_game_stores_photos_is_array'
      and conrelid = 'public.local_game_stores'::regclass
  ) then
    alter table public.local_game_stores
      add constraint local_game_stores_photos_is_array check (jsonb_typeof(photos) = 'array');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'local_game_stores_videos_is_array'
      and conrelid = 'public.local_game_stores'::regclass
  ) then
    alter table public.local_game_stores
      add constraint local_game_stores_videos_is_array check (jsonb_typeof(videos) = 'array');
  end if;
end $$;

-- The table's SELECT is granted column by column (submitter_email and
-- submitted_by stay private — 20260715230000); the new columns are public.
grant select (opening_hours, instagram_url, photos, videos)
  on public.local_game_stores to anon, authenticated;

-- Admins add stores from the dashboard. Same admin test as the existing
-- update / delete policies; nobody else can insert from the browser.
drop policy if exists "Admins can insert stores" on public.local_game_stores;
create policy "Admins can insert stores"
  on public.local_game_stores for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

-- Swap Itt — Melbourne. The Wollongong shop is already listed; this is the
-- La Trobe Street store. Photos and the street clip are bundled with the app
-- under public/stores/swap-itt-melbourne/.
insert into public.local_game_stores
  (slug, name, suburb, city, state, address, website, categories, description, opening_hours, photos, videos, status)
values (
  'swap-itt-melbourne',
  'Swap Itt',
  'Melbourne',
  'melbourne',
  'VIC',
  '488 La Trobe St, Melbourne VIC',
  'https://swapitt.com.au/',
  array['pokemon', 'tcg', 'sports', 'collectibles'],
  'Buy, sell and trade card shop on La Trobe Street in Melbourne''s CBD, with walls of priced sports and F1 singles, Pokémon and One Piece sealed product, graded slabs, card supplies and tables to trade at.',
  E'Monday: Closed\nTuesday to Friday: 11am – 7pm\nSaturday: from 11am\nSunday: 11am – 5pm\nPublic holidays: Closed',
  '[
    {"url": "/stores/swap-itt-melbourne/storefront.webp", "caption": "The La Trobe Street entrance"},
    {"url": "/stores/swap-itt-melbourne/shop-floor.webp", "caption": "Trade tables under the One Piece mural"},
    {"url": "/stores/swap-itt-melbourne/card-wall.webp", "caption": "Priced singles on the wall — NBA, F1 and more"},
    {"url": "/stores/swap-itt-melbourne/shop-dog.webp", "caption": "The shop dog"}
  ]'::jsonb,
  '[
    {"url": "/stores/swap-itt-melbourne/street.mp4", "poster_url": "/stores/swap-itt-melbourne/street.poster.jpg", "caption": "Finding the shop from La Trobe Street"}
  ]'::jsonb,
  'approved'
)
on conflict (slug) do nothing;
