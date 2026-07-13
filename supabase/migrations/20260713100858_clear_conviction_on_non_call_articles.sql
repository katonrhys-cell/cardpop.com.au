-- Align existing articles with the CardPop Conviction Rating rules.
--
-- A conviction rating only belongs on an article that actually makes a *call*
-- of its category's type (Buy / Keeper / Grade / Impact). Three published
-- articles carried a rating but are really guides or platform content, so the
-- meter over-claimed a "call" they don't make. Clear their rating + type so
-- they read as educational (a read-time cue) — the same treatment as Beginner
-- Guides.
--
--   * psa-grading-guide-for-australian-collectors-2026
--       A how-to grading guide, not a grade-worthiness call on a specific card.
--   * what-not-joining-a-3-collector-marketplace-is-costing-you-after-ebays-2026-fee-restructure
--       A marketplace/fees piece — there is no card to "buy" here.
--   * is-importing-psa-cards-worth-it-in-australia-2026
--       An import cost breakdown, not a buy thesis.
--
-- Idempotent and non-destructive to display: once cleared, these ratings render
-- nowhere (resolveConviction returns null without a type).

update public.blog_articles
set conviction_rating = null,
    conviction_type = null
where slug in (
    'psa-grading-guide-for-australian-collectors-2026',
    'what-not-joining-a-3-collector-marketplace-is-costing-you-after-ebays-2026-fee-restructure',
    'is-importing-psa-cards-worth-it-in-australia-2026'
  )
  and (conviction_rating is not null or conviction_type is not null);
