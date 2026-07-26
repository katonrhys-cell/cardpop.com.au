-- Starter topics for the scheduled blog generator.
--
-- Without queued topics the nightly cron has nothing to draw from, so this
-- seeds six briefs that cover the categories already in use on the blog and
-- anchor on tracked_cards slugs that exist and carry price history.
--
-- min_snapshot_days is 14 against the ~22 days of snapshots these cards have,
-- so the data gate passes on the first run but still refuses to generate if a
-- card's history is ever reset.
--
-- Idempotent: re-running does nothing. Editing a brief later is a normal
-- update through the admin API, not a migration.

insert into public.blog_article_topics
  (slug, title_hint, brief, category, keywords, marketplace_keywords, tracked_card_slugs, priority, min_snapshot_days)
values
  (
    'charizard-price-guide-australia-2026',
    'What Charizard actually costs in Australia right now',
    'Walk through the Charizard market from Base Set to the modern Special Illustration Rares, using the tracked snapshot range for each. Be blunt about the spread between raw and graded, and about how much of the Australian price is exchange rate rather than demand. Say plainly which of these are liquid and which sit unsold for months.',
    'card-spotlight',
    array['charizard price australia', 'charizard card value', 'base set charizard'],
    array['charizard', 'charizard ex', 'charizard vmax'],
    array[
      'charizard-base-set',
      'celebrations-charizard',
      'charizard-ex-sir-151',
      'shining-charizard-neo-destiny',
      'shiny-charizard-vmax-shining-fates'
    ],
    10,
    14
  ),
  (
    'pokemon-alt-art-price-check-2026',
    'Where the Pokemon alternate arts have landed',
    'The alt art chase cards from Evolving Skies through Silver Tempest defined the last cycle. Compare where they sit now against the snapshot window. Cover why the Eeveelution alt arts hold differently to the legendaries, and what a realistic Australian buy price looks like once postage and grading are counted.',
    'card-spotlight',
    array['pokemon alt art price', 'umbreon vmax alt art', 'evolving skies alt art'],
    array['alt art', 'umbreon vmax', 'charizard v alt art'],
    array[
      'umbreon-vmax-alt-art-evolving-skies',
      'charizard-v-alt-art-brilliant-stars',
      'giratina-v-alt-art-lost-origin',
      'lugia-v-alt-art-silver-tempest',
      'rayquaza-vmax-alt-art-evolving-skies'
    ],
    20,
    14
  ),
  (
    'afl-rookie-cards-price-check-2026',
    'The AFL rookie card market, priced honestly',
    'AFL cards are a thin market compared to Pokemon or NBA, and the article should say so. Use the tracked rookies to show the gap between the established names and the current draft-year hype. Be direct that low sale counts make any single price a weak signal, and explain what that means for someone deciding whether to buy or hold.',
    'australia-focus',
    array['afl rookie cards', 'afl card values australia', 'afl trading cards'],
    array['afl rookie', 'afl cards'],
    array[
      'nick-daicos-rookie',
      'harley-reid-rookie',
      'marcus-bontempelli-rookie',
      'dustin-martin-rookie',
      'sam-darcy-rookie'
    ],
    30,
    14
  ),
  (
    'nrl-rookie-cards-price-check-2026',
    'What NRL rookie cards are actually selling for',
    'Same treatment as the AFL piece but for NRL. Use the tracked rookies to separate the players whose cards have a real secondary market from those that only move at release. Note where sale counts are too low to draw a conclusion rather than filling the gap with a guess.',
    'australia-focus',
    array['nrl rookie cards', 'nrl card values', 'rugby league trading cards'],
    array['nrl rookie', 'nrl cards'],
    array[
      'nathan-cleary-rookie',
      'reece-walsh-rookie',
      'joseph-suaalii-rookie',
      'kalyn-ponga-rookie',
      'sam-walker-rookie'
    ],
    40,
    14
  ),
  (
    'raw-vs-psa-10-price-gap-nba-rookies',
    'The raw-to-PSA-10 gap on NBA rookies, with the sums done',
    'Use the tracked Prizm rookies to show the actual multiple between raw and graded prices across the snapshot window. Then subtract what an Australian submission really costs — postage both ways, insurance, the exchange rate — and show which cards clear that bar and which do not. The point is that most do not.',
    'grading-guides',
    array['psa 10 price gap', 'is grading worth it australia', 'prizm rookie psa'],
    array['prizm rookie', 'psa 10'],
    array[
      'victor-wembanyama-prizm-rookie',
      'luka-doncic-prizm-rookie',
      'anthony-edwards-prizm-rookie',
      'shai-gilgeous-alexander-prizm-rookie',
      'cooper-flagg-prizm-rookie'
    ],
    50,
    14
  ),
  (
    'one-piece-alt-art-price-check-2026',
    'One Piece alternate arts after the rush',
    'One Piece TCG ran hot then cooled. Use the tracked alt arts and secret rares to show where prices have settled against the snapshot window. Cover the supply difference between the early OP01 prints and the later sets, and be honest that Australian stock is thin enough that listed prices often overstate what people pay.',
    'card-spotlight',
    array['one piece tcg prices', 'one piece alt art', 'one piece card value'],
    array['one piece alt art', 'one piece secret rare'],
    array[
      'roronoa-zoro-alt-art-op01',
      'nami-alt-art-op01',
      'shanks-op01-120',
      'portgas-d-ace-alt-art-op02',
      'luffy-gear-5-op05'
    ],
    60,
    14
  )
on conflict (slug) do nothing;
