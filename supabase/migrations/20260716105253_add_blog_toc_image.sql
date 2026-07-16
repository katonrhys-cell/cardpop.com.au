-- Optional card/slab image shown in the empty right-hand side of the
-- "On this page" table-of-contents panel on blog articles. Distinct from
-- featured_image_url (the 16:9 hero banner): this slot suits portrait card
-- images (e.g. PSA slabs) that would crop badly as a hero. Managed from the
-- admin Article editor; rendered by pages/blog/BlogArticlePage.jsx.
alter table public.blog_articles
  add column if not exists toc_image_url text,
  add column if not exists toc_image_alt text;

comment on column public.blog_articles.toc_image_url is
  'Optional portrait card image displayed beside the article table of contents ("On this page" panel).';
comment on column public.blog_articles.toc_image_alt is
  'Alt text for toc_image_url; falls back to the article title when null.';
