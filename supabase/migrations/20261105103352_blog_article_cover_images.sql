-- Cover images for the blog articles that had none.
-- Rendered by scripts/render-blog-cover-images.mjs into public/images/blog/<slug>.jpg
-- (served by the site itself). Only fills a blank featured_image_url, so an image
-- an admin has since set in the article editor is never overwritten. Idempotent.
update public.blog_articles a
   set featured_image_url = 'https://cardpop.com.au/images/blog/' || a.slug || '.jpg'
 where (a.featured_image_url is null or btrim(a.featured_image_url) = '')
   and a.slug in (
     'afl-rookie-cards-price-check-2026',
     'base-set-big-three-price-check-australia',
     'best-lebron-james-cards-to-buy-in-2026-cardpop-investment-report',
     'charizard-price-guide-australia-2026',
     'evolving-skies-eeveelution-alt-arts-price-guide',
     'modern-charizard-chase-cards-ranked-by-price',
     'nrl-rookie-cards-price-check-2026',
     'one-piece-alt-art-price-check-2026',
     'pokemon-alt-art-price-check-2026',
     'prismatic-evolutions-sir-price-check',
     'raw-vs-psa-10-price-gap-nba-rookies',
     'vault-the-great-chase-edition-1-melbourne-card-collectible-show-cardpop-australia-review',
     'why-philadelphia-76ers-could-land-lebron-james-2026'
   );
