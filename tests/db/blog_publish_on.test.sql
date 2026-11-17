-- blog_articles.publish_on: a scheduled draft keeps its date; publishing by
-- any route clears it; re-applying the migration is a no-op.
\set ON_ERROR_STOP on
insert into public.blog_articles (id, slug, is_published, publish_on) values
  ('00000000-0000-0000-0000-000000000001', 'draft', false, '2030-01-05'),
  ('00000000-0000-0000-0000-000000000002', 'born-live', true, '2030-01-05');
do $$
begin
  if (select publish_on from public.blog_articles where slug = 'draft') <> date '2030-01-05' then
    raise exception 'a draft lost its schedule';
  end if;
  if (select publish_on from public.blog_articles where slug = 'born-live') is not null then
    raise exception 'an article inserted as published kept a schedule';
  end if;
end $$;

update public.blog_articles set is_published = true where slug = 'draft';
do $$
begin
  if (select publish_on from public.blog_articles where slug = 'draft') is not null then
    raise exception 'publishing did not clear the schedule';
  end if;
end $$;

-- Scheduling an already-published article is refused quietly (stays null).
update public.blog_articles set publish_on = '2030-02-01' where slug = 'draft';
do $$
begin
  if (select publish_on from public.blog_articles where slug = 'draft') is not null then
    raise exception 'a published article accepted a schedule';
  end if;
end $$;

-- Back to draft: it can be scheduled again.
update public.blog_articles set is_published = false where slug = 'draft';
update public.blog_articles set publish_on = '2030-02-01' where slug = 'draft';
do $$
begin
  if (select publish_on from public.blog_articles where slug = 'draft') <> date '2030-02-01' then
    raise exception 'an unpublished article could not be rescheduled';
  end if;
end $$;
select 'blog_publish_on: ok' as result;
