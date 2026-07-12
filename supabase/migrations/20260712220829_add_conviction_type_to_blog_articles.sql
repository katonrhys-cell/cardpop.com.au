-- Add an explicit conviction TYPE to blog articles.
--
-- The CardPop Conviction Rating is a 1–5 strength meter (blog_articles.conviction_rating).
-- What that strength is ABOUT depends on the article's subject: a buy call, a
-- keeper call, a grade call or a market-impact call. Historically the meter
-- inferred this from the free-text `category`, which is fragile. This column
-- pins the type so the meter renders consistently even if the category
-- vocabulary drifts. Rendering still falls back to the category mapping, then
-- to 'buy', when this is null (see utils/convictionRating.js).
--
-- Idempotent + backward-compatible: nullable, no default, safe to land before
-- the app that writes it.

alter table public.blog_articles
  add column if not exists conviction_type text;

-- Constrain to the four supported types (allow null = no rating / unset).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blog_articles_conviction_type_check'
  ) then
    alter table public.blog_articles
      add constraint blog_articles_conviction_type_check
      check (conviction_type is null or conviction_type in ('buy', 'keeper', 'grade', 'impact'));
  end if;
end $$;

-- Backfill existing rated rows from their category so old articles get a type.
update public.blog_articles
set conviction_type = case category
    when 'investing-value' then 'buy'
    when 'australia-focus' then 'buy'
    when 'card-spotlight'  then 'keeper'
    when 'grading-guides'  then 'grade'
    when 'news-releases'   then 'impact'
    else 'buy'
  end
where conviction_rating is not null
  and conviction_type is null;

comment on column public.blog_articles.conviction_type is
  'CardPop Conviction Rating type: buy | keeper | grade | impact. Sets what the 1–5 conviction_rating is about. Fixed by category in the editor.';
