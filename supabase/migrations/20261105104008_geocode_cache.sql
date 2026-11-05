-- One shared cache of address → coordinates for the Local Map.
--
-- pages/community/LocalMapPage.jsx used to geocode every store and upcoming
-- event (up to ~300 addresses) against OpenStreetMap's Nominatim from each
-- visitor's browser, one per second, on every visit. That is against
-- Nominatim's usage policy (bulk geocoding from clients, no caching) and made
-- the map slow to fill. The server now looks each address up once and keeps
-- the answer here (src/utils/geocodeCache.js, POST /geocode/batch); the
-- browser never calls Nominatim for the map.
--
-- Written and read only by the backend's service-role client: RLS on, no
-- policies.

create table if not exists public.geocode_cache (
  query_key   text primary key check (char_length(query_key) between 1 and 200),
  lat         double precision,
  lng         double precision,
  found       boolean not null default false,
  geocoded_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from anon, authenticated;
