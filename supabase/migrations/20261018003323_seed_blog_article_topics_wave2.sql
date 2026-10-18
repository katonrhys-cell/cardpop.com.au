-- Second wave of topics for the scheduled blog generator.
--
-- The nightly cron drained the six starter briefs by 5 August 2026 and has had
-- nothing to draw from since, so The Parallel Report stopped gaining articles —
-- the "exhibits ongoing curation" test an ad-network review applies is exactly
-- the one an idle queue fails. These twelve briefs continue the plan in
-- docs/SEO_CONTENT_PLAN.md (price guides, grading economics, Australian-only
-- angles) and anchor on tracked_cards slugs that exist and carry 60+ days of
-- snapshots, so the price gate passes on the first run.
--
-- min_snapshot_days is 30: the cards had ~100 days of history when this was
-- written, so the gate passes now and still refuses to generate from a card
-- whose history is ever reset. Priority orders the queue (lower runs first);
-- one article a night, so this is about a fortnight of drafts. Drafts land
-- unpublished for review unless BLOG_AUTOPUBLISH=true.
--
-- Idempotent: on conflict (slug) do nothing. Editing a brief later is a normal
-- update through the admin API, not a migration.

insert into public.blog_article_topics
  (slug, title_hint, brief, category, keywords, marketplace_keywords, tracked_card_slugs, priority, min_snapshot_days)
values
  (
    'base-set-big-three-price-check-australia',
    'Charizard, Blastoise, Venusaur: what the Base Set big three cost in Australia',
    'Three cards every lapsed collector remembers. Use the tracked snapshot range for each to lay out what raw and graded copies actually change hands for in AUD, and how the gap between the three has moved across the window. Be direct about condition: most raw Base Set holos are not PSA 9 candidates, and the price of a clean raw copy is not the price of a slab. Close with what a realistic entry point looks like for someone buying one for the shelf rather than for return.',
    'card-spotlight',
    array['base set charizard price australia', 'base set blastoise value', 'base set venusaur price'],
    array['base set charizard', 'base set blastoise', 'base set venusaur'],
    array['charizard-base-set', 'blastoise-base-set', 'venusaur-base-set'],
    10, 30
  ),
  (
    'evolving-skies-eeveelution-alt-arts-price-guide',
    'The Evolving Skies Eeveelution alt arts, priced against each other',
    'Umbreon VMAX is the headline, but Sylveon, Glaceon and Leafeon VMAX alt arts tell the real story of the set. Compare the four across the snapshot window: which held, which drifted, and how wide the raw-to-graded spread is on each. Explain why Umbreon trades in a different bracket without pretending the others are bargains. Cover the Australian angle: postage and grading turnaround make a graded copy of the cheaper three a different proposition to buying raw.',
    'card-spotlight',
    array['umbreon vmax alt art price', 'evolving skies alt art australia', 'sylveon vmax alt art value'],
    array['umbreon vmax', 'sylveon vmax', 'glaceon vmax', 'leafeon vmax'],
    array['umbreon-vmax-alt-art-evolving-skies', 'sylveon-vmax-alt-art-evolving-skies', 'glaceon-vmax-alt-art-evolving-skies', 'leafeon-vmax-alt-art-evolving-skies'],
    11, 30
  ),
  (
    'prismatic-evolutions-sir-price-check',
    'Prismatic Evolutions SIRs: where the chase cards sit now',
    'Umbreon ex, Sylveon ex, Espeon ex and Eevee ex Special Illustration Rares from Prismatic Evolutions. Use the snapshot window to show how each has settled since release hype, and whether the gaps between them are narrowing. Be blunt about pull rates versus price: the set is still being opened, so supply is not fixed. Give a buy-now-or-wait view for an Australian collector, with the exchange rate called out as a factor separate from demand.',
    'card-spotlight',
    array['prismatic evolutions umbreon ex price', 'prismatic evolutions sir value australia', 'eevee ex sir price'],
    array['umbreon ex', 'sylveon ex', 'espeon ex', 'eevee ex', 'prismatic evolutions'],
    array['umbreon-ex-sir-prismatic-evolutions', 'sylveon-ex-sir-prismatic-evolutions', 'espeon-ex-sir-prismatic-evolutions', 'eevee-ex-sir-prismatic-evolutions'],
    12, 30
  ),
  (
    'modern-charizard-chase-cards-ranked-by-price',
    'Every modern Charizard chase card, ranked by what it actually costs',
    'Shiny Charizard GX (Hidden Fates), Charizard VMAX (Champions Path), Charizard VSTAR (Brilliant Stars), Charizard ex SIR (Obsidian Flames) and shiny Charizard ex (Paldean Fates). Rank them by current raw and graded prices from the snapshots, note which moved most across the window, and say which are liquid at those prices and which sit. The reader is deciding which Charizard to own on a budget; give them the ladder in AUD.',
    'card-spotlight',
    array['charizard vmax champions path price', 'shiny charizard gx price australia', 'charizard ex obsidian flames sir value'],
    array['charizard gx', 'charizard vmax', 'charizard vstar', 'charizard ex'],
    array['shiny-charizard-gx-hidden-fates', 'charizard-vmax-champions-path', 'charizard-vstar-brilliant-stars', 'charizard-ex-sir-obsidian-flames', 'charizard-ex-shiny-paldean-fates'],
    13, 30
  ),
  (
    'pikachu-chase-cards-price-check-australia',
    'The Pikachu cards collectors actually pay for',
    'Van Gogh Pikachu with Grey Felt Hat, Pikachu VMAX rainbow rare (Vivid Voltage) and Pikachu ex SIR (Surging Sparks). Three very different routes to the same character: a promo with a story, a rainbow from the VMAX era, and a current-set SIR. Use the snapshot data to compare raw and graded prices, explain why the promo behaves unlike the set cards, and give an Australian buyer a realistic landed price for each.',
    'card-spotlight',
    array['van gogh pikachu price', 'pikachu vmax rainbow rare value', 'pikachu ex surging sparks sir price'],
    array['pikachu', 'van gogh pikachu', 'pikachu vmax'],
    array['pikachu-van-gogh-grey-felt-hat', 'pikachu-vmax-rainbow-vivid-voltage', 'pikachu-ex-sir-surging-sparks'],
    14, 30
  ),
  (
    'gold-star-pokemon-cards-price-guide',
    'Gold Star Pokémon: Rayquaza and Umbreon, priced for Australian collectors',
    'Rayquaza Gold Star (ex Deoxys) and Umbreon Gold Star (POP Series 5) are the two Gold Stars collectors ask about most. Lay out the raw and graded figures from the snapshots and how they moved across the window. Explain condition honestly: these cards are twenty years old, centering is routinely off, and a raw copy at a bargain price usually has a reason. Say what grade tiers the Australian market pays for and where fakes show up.',
    'card-spotlight',
    array['rayquaza gold star price', 'umbreon gold star value', 'gold star pokemon cards australia'],
    array['rayquaza gold star', 'umbreon gold star', 'gold star'],
    array['rayquaza-gold-star-ex-deoxys', 'umbreon-gold-star-pop5'],
    15, 30
  ),
  (
    'vintage-basketball-rookies-australia-jordan-kobe-lebron',
    'Jordan, Kobe, LeBron: vintage rookie prices from an Australian desk',
    '1986 Fleer Michael Jordan, 1996 Topps Kobe Bryant and 2003 Topps LeBron James. Use the snapshot window to show what raw and graded copies actually cost in AUD and how far each moved. These are US-market cards, so be clear about what the exchange rate contributes to the Australian figure, what grading tiers drive the price, and why a raw Jordan is a different purchase to a raw modern card. Give a straight answer on which is the most sensible first vintage buy.',
    'investing-value',
    array['1986 fleer jordan price australia', 'kobe bryant topps rookie value', 'lebron james topps rookie price'],
    array['michael jordan fleer', 'kobe bryant rookie', 'lebron james rookie'],
    array['michael-jordan-fleer-1986', 'kobe-bryant-topps-rookie', 'lebron-james-topps-rookie'],
    16, 30
  ),
  (
    'nba-prizm-rookies-2026-price-check',
    'The current NBA Prizm rookie market, in AUD',
    'Prizm base rookies for Wembanyama, Cooper Flagg, Anthony Edwards, Shai Gilgeous-Alexander, Jayson Tatum and Ja Morant. Compare the snapshot ranges: who moved, who held, and how the raw-to-PSA-10 spread differs between an established star and a current rookie. Cover the Australian reality of buying US sports cards: postage, GST at the border, and the exchange rate. Avoid hype; the brief is what the cards cost and what moved them.',
    'investing-value',
    array['wembanyama prizm rookie price', 'cooper flagg prizm rookie value', 'nba prizm rookie cards australia'],
    array['prizm rookie', 'wembanyama', 'cooper flagg', 'anthony edwards'],
    array['victor-wembanyama-prizm-rookie', 'cooper-flagg-prizm-rookie', 'anthony-edwards-prizm-rookie', 'shai-gilgeous-alexander-prizm-rookie', 'jayson-tatum-prizm-rookie', 'ja-morant-prizm-rookie'],
    17, 30
  ),
  (
    'josh-giddey-and-australian-nba-cards-price-check',
    'Josh Giddey and the Australian NBA card market',
    'Australian collectors pay a home-market premium for Australian players. Use the Giddey Prizm rookie snapshots as the anchor, set against Chet Holmgren, LaMelo Ball and Tyrese Haliburton rookies from the same era for scale. Say plainly whether the local premium shows up in the data or only in asking prices, and what a realistic AUD buy looks like raw and graded. No speculation about careers; prices only.',
    'australia-focus',
    array['josh giddey prizm rookie price', 'josh giddey card value australia', 'australian nba cards'],
    array['josh giddey', 'lamelo ball', 'chet holmgren', 'tyrese haliburton'],
    array['josh-giddey-prizm-rookie', 'chet-holmgren-prizm-rookie', 'lamelo-ball-prizm-rookie', 'tyrese-haliburton-prizm-rookie'],
    18, 30
  ),
  (
    'raw-vs-graded-afl-rookies-is-grading-worth-it',
    'Grading AFL rookies: when the slab pays for itself and when it does not',
    'Take the AFL rookie snapshots for Daicos, Reid, Bontempelli, Cripps and Ablett Jr and do the sums: the raw price, the graded price, and the cost of getting a card graded from Australia (fees, postage, insurance, time). Say for which cards the gap covers the cost and for which it never will. The reader is holding a raw card and deciding whether to submit. Give them the arithmetic, not encouragement.',
    'grading-guides',
    array['is grading afl cards worth it', 'nick daicos rookie card psa 10 price', 'afl card grading australia'],
    array['nick daicos', 'harley reid', 'bontempelli', 'patrick cripps', 'gary ablett'],
    array['nick-daicos-rookie', 'harley-reid-rookie', 'marcus-bontempelli-rookie', 'patrick-cripps-rookie', 'gary-ablett-jr-rookie'],
    19, 30
  ),
  (
    'nrl-rookie-cards-raw-vs-graded-price-gap',
    'NRL rookies: the raw-to-graded price gap, card by card',
    'Trbojevic, Latrell Mitchell, Payne Haas, Walsh and Ponga rookies. Lay out raw against graded from the snapshots and how each moved across the window, then explain why NRL graded premiums behave differently to NBA ones: smaller population reports, a mostly domestic buyer pool, and fewer graded copies to set a market. Finish with a clear view on which of these a collector should grade and which to leave raw.',
    'grading-guides',
    array['nrl rookie cards graded value', 'reece walsh rookie card price', 'nrl card grading worth it'],
    array['tom trbojevic', 'latrell mitchell', 'payne haas', 'reece walsh', 'kalyn ponga'],
    array['tom-trbojevic-rookie', 'latrell-mitchell-rookie', 'payne-haas-rookie', 'reece-walsh-rookie', 'kalyn-ponga-rookie'],
    20, 30
  ),
  (
    'one-piece-op01-chase-cards-two-years-on',
    'One Piece OP01 chase cards two years on',
    'Yamato alt art, Nami alt art, Zoro alt art and the Luffy leader parallel from Romance Dawn, with the OP09 manga Shanks as the comparison for what a newer chase does. Use the snapshot ranges to show how the OP01 cards have settled, which are still moving and what the raw-to-graded spread looks like. Address the Australian supply question directly: English OP01 is reprint-affected, and that shows in price. Prices only, no product-launch chatter.',
    'card-spotlight',
    array['one piece op01 alt art prices', 'yamato alt art op01 value', 'romance dawn chase cards australia'],
    array['one piece', 'yamato alt art', 'nami alt art', 'zoro alt art', 'luffy leader parallel'],
    array['yamato-alt-art-op01', 'nami-alt-art-op01', 'roronoa-zoro-alt-art-op01', 'monkey-d-luffy-leader-parallel-op01', 'shanks-op09-manga'],
    21, 30
  )
on conflict (slug) do nothing;
