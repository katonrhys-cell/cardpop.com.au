-- Event forums + per-event information board.
--
-- 1. Repairs the community forum's posts table: the live table pre-dates this
--    repo and never had the title/category/views columns the forum UI reads and
--    writes, so creating a discussion has been failing in production. Also adds
--    event_id so a discussion can be attached to an event.
-- 2. Creates the per-event information board: event_board_posts (announcements,
--    pinnable), event_stall_layouts (floor-plan image per event) and
--    event_stalls (structured stall list with optional x/y positions so the
--    layout can become clickable later without a schema change).
-- 3. Write access to the board is admins + the event's organiser + users who
--    RSVP'd to that event as a vendor, enforced by can_manage_event_board().
-- 4. get_event_participant_roles() lets the UI badge discussion authors as
--    Organiser/Vendor without exposing events.organiser_id or raw event_rsvps
--    rows (both are hidden from the public by RLS / the events_public view).

-- ---------------------------------------------------------------------------
-- posts: forum repair + event linkage
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists category text;
alter table public.posts add column if not exists views integer not null default 0;
alter table public.posts add column if not exists event_id uuid references public.events(id) on delete cascade;

create index if not exists idx_posts_event_id on public.posts(event_id) where event_id is not null;

-- Views are incremented by readers, who may not be the author — the posts
-- UPDATE policy only allows authors, so the counter goes through a definer fn.
create or replace function public.increment_post_views(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts set views = views + 1 where id = p_post_id;
$$;

revoke all on function public.increment_post_views(uuid) from public;
grant execute on function public.increment_post_views(uuid) to anon, authenticated;

-- Admins can remove abusive replies anywhere on the forum (the existing
-- comments policies only let authors delete their own).
drop policy if exists "Admins can delete any comment" on public.comments;
create policy "Admins can delete any comment"
  on public.comments for delete
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- Board write permission: admin, event organiser, or vendor RSVP'd to the event
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_event_board(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_admin = true
    )
    or exists (
      select 1 from public.events
      where id = p_event_id and organiser_id = (select auth.uid())
    )
    or exists (
      select 1 from public.event_rsvps
      where event_id = p_event_id
        and user_id = (select auth.uid())
        and role = 'vendor'
    );
$$;

revoke all on function public.can_manage_event_board(uuid) from public;
grant execute on function public.can_manage_event_board(uuid) to authenticated;

-- Organiser/vendor badges for a set of users on one event. Only answers for
-- the user ids handed in (authors already shown publicly on the page), so it
-- doesn't enumerate an event's vendors or expose organiser contact details.
create or replace function public.get_event_participant_roles(p_event_id uuid, p_user_ids uuid[])
returns table (user_id uuid, role text)
language sql
stable
security definer
set search_path = public
as $$
  select e.organiser_id, 'organiser'::text
  from public.events e
  where e.id = p_event_id and e.organiser_id = any(p_user_ids)
  union
  select r.user_id, 'vendor'::text
  from public.event_rsvps r
  where r.event_id = p_event_id and r.role = 'vendor' and r.user_id = any(p_user_ids);
$$;

revoke all on function public.get_event_participant_roles(uuid, uuid[]) from public;
grant execute on function public.get_event_participant_roles(uuid, uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- event_board_posts: announcements on an event's information board
-- ---------------------------------------------------------------------------
create table if not exists public.event_board_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text not null,
  is_pinned boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_board_posts_event_id on public.event_board_posts(event_id);
create index if not exists idx_event_board_posts_author_id on public.event_board_posts(author_id);

drop trigger if exists event_board_posts_updated_at on public.event_board_posts;
create trigger event_board_posts_updated_at
  before update on public.event_board_posts
  for each row execute function public.set_updated_at();

alter table public.event_board_posts enable row level security;

-- Event pages are public, so the board is publicly readable.
drop policy if exists "Anyone can view visible board posts" on public.event_board_posts;
create policy "Anyone can view visible board posts"
  on public.event_board_posts for select
  using (is_visible = true);

drop policy if exists "Managers can create board posts" on public.event_board_posts;
create policy "Managers can create board posts"
  on public.event_board_posts for insert
  with check (
    (select auth.uid()) = author_id
    and public.can_manage_event_board(event_id)
  );

drop policy if exists "Authors and admins can update board posts" on public.event_board_posts;
create policy "Authors and admins can update board posts"
  on public.event_board_posts for update
  using (
    (select auth.uid()) = author_id
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );

drop policy if exists "Authors and admins can delete board posts" on public.event_board_posts;
create policy "Authors and admins can delete board posts"
  on public.event_board_posts for delete
  using (
    (select auth.uid()) = author_id
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- event_stall_layouts: one floor-plan image per event
-- ---------------------------------------------------------------------------
create table if not exists public.event_stall_layouts (
  event_id uuid primary key references public.events(id) on delete cascade,
  image_url text,
  caption text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists event_stall_layouts_updated_at on public.event_stall_layouts;
create trigger event_stall_layouts_updated_at
  before update on public.event_stall_layouts
  for each row execute function public.set_updated_at();

alter table public.event_stall_layouts enable row level security;

drop policy if exists "Anyone can view stall layouts" on public.event_stall_layouts;
create policy "Anyone can view stall layouts"
  on public.event_stall_layouts for select
  using (true);

drop policy if exists "Managers can create stall layouts" on public.event_stall_layouts;
create policy "Managers can create stall layouts"
  on public.event_stall_layouts for insert
  with check (public.can_manage_event_board(event_id));

drop policy if exists "Managers can update stall layouts" on public.event_stall_layouts;
create policy "Managers can update stall layouts"
  on public.event_stall_layouts for update
  using (public.can_manage_event_board(event_id));

drop policy if exists "Managers can delete stall layouts" on public.event_stall_layouts;
create policy "Managers can delete stall layouts"
  on public.event_stall_layouts for delete
  using (public.can_manage_event_board(event_id));

-- ---------------------------------------------------------------------------
-- event_stalls: structured stall list; pos_x/pos_y are % coordinates on the
-- layout image (0-100), nullable until placed — the hook for future clickable
-- floor plans.
-- ---------------------------------------------------------------------------
create table if not exists public.event_stalls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  name text,
  description text,
  vendor_id uuid references public.profiles(id) on delete set null,
  pos_x numeric check (pos_x is null or (pos_x >= 0 and pos_x <= 100)),
  pos_y numeric check (pos_y is null or (pos_y >= 0 and pos_y <= 100)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_stalls_event_id on public.event_stalls(event_id);
create index if not exists idx_event_stalls_vendor_id on public.event_stalls(vendor_id);

drop trigger if exists event_stalls_updated_at on public.event_stalls;
create trigger event_stalls_updated_at
  before update on public.event_stalls
  for each row execute function public.set_updated_at();

alter table public.event_stalls enable row level security;

drop policy if exists "Anyone can view stalls" on public.event_stalls;
create policy "Anyone can view stalls"
  on public.event_stalls for select
  using (true);

drop policy if exists "Managers can create stalls" on public.event_stalls;
create policy "Managers can create stalls"
  on public.event_stalls for insert
  with check (public.can_manage_event_board(event_id));

drop policy if exists "Managers can update stalls" on public.event_stalls;
create policy "Managers can update stalls"
  on public.event_stalls for update
  using (public.can_manage_event_board(event_id));

drop policy if exists "Managers can delete stalls" on public.event_stalls;
create policy "Managers can delete stalls"
  on public.event_stalls for delete
  using (public.can_manage_event_board(event_id));
