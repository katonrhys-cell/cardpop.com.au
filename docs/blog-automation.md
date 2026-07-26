# Scheduled blog article generation

A nightly cron drafts one blog article from a queue of planned topics, grounded
in the price snapshots CardPop already collects. Drafts are unpublished by
default and wait for a human to read them.

## Moving parts

| Piece | File |
|---|---|
| Topic queue table | `supabase/migrations/20260726041500_blog_article_topic_queue.sql` |
| Starter topics | `supabase/migrations/20260726054754_seed_blog_article_topics.sql` |
| Cron entrypoint | `api/blog-generate.js` |
| Orchestration | `src/utils/blogArticleGenerator.js` |
| Price facts for the prompt | `src/utils/blogPriceContext.js` |
| Draft quality gate | `src/utils/blogStyleGuard.js` |
| Admin queue API | `src/routes/blog.js` |

## How a run works

1. **Vercel Cron** fires `GET /cron/blog-generate` at 21:00 UTC daily (the
   `crons` entry in `vercel.json`, rewritten to `/api/blog-generate`). Vercel
   attaches `Authorization: Bearer $CRON_SECRET` automatically.
2. **Claim a topic** — the highest-priority row in `blog_article_topics` with
   `status = 'queued'`, skipping any whose planned slug already exists in
   `blog_articles`. The claim flips it to `generating` so a retried invocation
   can't double-write.
3. **Build the factual base** — `blogPriceContext.js` loads the topic's
   `tracked_card_slugs` from `tracked_cards` and their `card_price_snapshots`,
   and reduces them to a compact summary: latest raw/graded averages, the
   high/low across the window, percentage change, and observation counts.
   If any referenced card has fewer than `min_snapshot_days` of history the
   topic goes **back to `queued`** and the run moves on to the next candidate —
   so one topic waiting on data can't stall the whole queue.
4. **Generate** — one Claude call with the price summary, the brief, and the
   house style rules, constrained by a JSON schema (structured outputs) so the
   response parses without repair.
5. **Check the draft** — `blogStyleGuard.js` rejects it if any of these fail:
   - banned AI-tell vocabulary (`delve`, `tapestry`, `it's not just X, it's Y`, …)
   - too little sentence-length variance (the flat-rhythm giveaway)
   - under the word floor, or missing the required structure
   - **any dollar figure in the body that doesn't trace to a real snapshot** —
     this is the one that matters, because a plausible invented price is worse
     than no article
   A failed check triggers **one** retry with the specific violations quoted
   back. A second failure marks the topic `failed` and the run raises.
6. **Store** — insert into `blog_articles` with `auto_generated = true` and
   `generation_model` recorded. `is_published` is `false` unless
   `BLOG_AUTOPUBLISH=true`. The topic is marked `generated` and linked to the
   article.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Unset = the endpoint returns 503 and writes nothing |
| `CRON_SECRET` | yes | Already set for the prices cron. **Fail-closed**: if unset the endpoint refuses every request rather than being publicly triggerable |
| `BLOG_AUTOPUBLISH` | no | `true` publishes immediately; default holds drafts for review |

## Managing the queue

Admin-only, under `/hcgi/api/blog/topics` (`authMiddleware` + `isAdminUser`):

```
GET  /hcgi/api/blog/topics              # list, newest first
POST /hcgi/api/blog/topics              # add a topic
POST /hcgi/api/blog/topics/:id/preview  # generate a draft and return it WITHOUT storing
POST /hcgi/api/blog/topics/:id/requeue  # put a failed/skipped topic back to 'queued'
```

A topic is a brief, not a script — `title_hint` and `brief` steer the angle,
`tracked_card_slugs` decides what the article is allowed to quote prices for.
Lower `priority` runs first.

`preview` is the one to use while tuning a brief: it runs the full generate +
style-guard cycle and hands back the draft (and how many attempts it took)
without touching `blog_articles` or the topic's status.

## Reviewing drafts

Generated articles appear in the admin blog list with `auto_generated = true`.
Read before publishing — the style guard enforces that the *numbers* are real
and the *prose* isn't obviously machine-written, but it cannot check whether
the argument is any good.

## Adding topics via migration

The starter set is seeded by migration so a fresh environment isn't empty.
Ongoing topics should go through the admin API instead — they're content, not
schema. If you do seed more in a migration, use `on conflict (slug) do nothing`
and verify every `tracked_card_slugs` entry exists in `tracked_cards` first; a
slug typo doesn't fail the migration, it just produces a topic that can never
satisfy its data gate.
