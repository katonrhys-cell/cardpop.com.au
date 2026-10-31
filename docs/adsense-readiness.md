# AdSense readiness — "Low value content"

Google AdSense rejected `cardpop.com.au` for **Low value content** on
2026-10-18. This page records what the reviewer actually saw, what was changed
in the code, and what has to be done outside the repo before re-submitting.

## What the review tests

The rejection text asks for three things, and AdSense's reviewer checks them
with a crawler that **does not execute JavaScript** and starts at the homepage:

| Google's words | What it means for a client-rendered SPA |
|---|---|
| "Provides authentic, high-quality information, tools, or services" | The HTML a bot receives must *contain* the information. A hero and a spinner is a blank page to it. |
| "Exhibits ongoing curation and structural maintenance" | New dated content appearing regularly, no stale "launching soon" pages, a sitemap that doesn't point at empty pages. |
| "Generates and sustains genuine user interest" | Real listings, events, discussions, reviews — and traffic. Overstated claims ("thousands of collectors") count against trust. |

## What the reviewer saw before this change

- **`/` was not prerendered.** Every content route is served to bots from
  `api/prerender.js` via the user-agent rewrites in `vercel.json` — except the
  homepage. A bot got `tools/home-shell.html`: header, hero headline, cookie
  banner, nothing else. The AdSense reviewer's first and most-weighted page was,
  to it, a headline with no body.
- **The blog had not published since 6 August.** Every scheduled GitHub Actions
  job had failed since 2026-09-13 because the `CRON_SECRET` Actions secret was
  never added after the move off Vercel Cron (each run fails in under three
  seconds, "CRON_SECRET is empty"). The blog topic queue had also been drained
  on 5 August with nothing queued behind it. Price pages (`/prices/…`, in the
  sitemap as `changefreq daily`) were showing data up to five weeks old.
- **The sitemap advertised empty pages**: `/community/forum` (0 posts),
  `/community/profiles` (a list of usernames), `/community/leaderboard`,
  `/community/map`, `/community/whatnot` (4 rows), and `/launch` — a
  "launching late 2026, join the waitlist" page on a live site.
- **Copy claimed scale the site doesn't have**: "Browse thousands of … cards"
  (26 active listings), "home to thousands of Australian collectors" (68
  profiles), on the marketplace meta description, `index.html`, the profiles
  page, the community hub, the grading page and empty collection pages.
- **Six of the sixteen articles are machine-drafted** (`auto_generated`) with
  no disclosure on the page.

## What changed in the repo

1. **Crawlers get a full homepage.** `vercel.json` rewrites `/` for bot
   user-agents to `api/prerender.js`, whose `renderHome()` returns the same
   sections `HomePage.jsx` renders — what CardPop is, how it works, trust
   signals, categories, the newest listings, the latest articles, upcoming
   events, the price guides and the full site navigation (About, Contact,
   FAQ, Privacy, Terms…) — with `WebSite`/`Organization` JSON-LD. The title
   is identical to `index.html`'s. The homepage rewrite's UA list deliberately
   omits `chrome-lighthouse` so PageSpeed Insights keeps measuring the real
   page. Test: `tests/backend/prerender.test.js` → "prerender homepage".
2. **Empty pages say so.** `/community/forum` and `/community/profiles`
   carry `noindex, follow` (prerender and SPA) until they have content;
   `/launch` is always `noindex`. The sitemap no longer lists `/launch`,
   `/community/profiles`, `/community/leaderboard`, `/community/map` or
   `/community/whatnot`, and lists `/community/forum` only once a discussion
   exists. Test: `tests/backend/sitemap.test.js` → "sitemap leaves thin pages
   out".
3. **Honest copy.** Every "thousands of …" claim is gone.
4. **AI-assisted articles are disclosed.** `utils/articleProvenance.js`
   supplies one sentence, rendered under the byline on the article page and in
   the prerender when `blog_articles.auto_generated` is true.
5. **The topic queue is refilled.** `supabase/migrations/…_seed_blog_article_topics_wave2.sql`
   queues twelve briefs anchored on tracked cards with 60+ days of snapshots —
   about a fortnight of nightly drafts once the cron runs again.
6. **Failing schedules send an email.** The Cloudflare scheduler Worker
   (`cloudflare/scheduler/worker.js`) emails `admin@cardpop.com.au` when any
   run fails, once `RESEND_API_KEY` is set on it (`docs/scheduled-jobs.md`).

## What must be done outside the repo (in order)

1. **Add the `CRON_SECRET` secret to the scheduler Worker** —
   `npx wrangler secret put CRON_SECRET --config cloudflare/scheduler/wrangler.toml`,
   value identical to the `CRON_SECRET` environment variable in Vercel. Then
   run the `daily` and `blog` schedules by hand (`POST /run/daily` and
   `POST /run/blog` on the Worker with that bearer — `docs/scheduled-jobs.md`)
   and confirm both reports are green. Nothing scheduled runs until this is
   done.
2. **Review and publish the drafts.** The generator stores drafts unpublished.
   Read each in Admin → Blog, edit where it is wrong or flat, and publish. A
   cadence of two or three dated articles a week for the next month is the
   single strongest "ongoing curation" signal available.
3. **Put real names on articles.** `blog_articles.author` is "CardPop
   Research" on most pieces. A named author with a short bio on `/about`
   (E-E-A-T) is what Google's quality guidance asks for; the generated drafts
   take their author from `blog_article_topics.author`.
4. **Search Console → Pages.** Check "Crawled – currently not indexed" and
   "Soft 404" for the URLs above; use *Validate fix* once the deploy is live.
   Request indexing of `/` so the new render is crawled promptly.
5. **Wait at least two weeks** of the above before re-submitting. AdSense
   re-reviews are rate-limited and a second "low value content" verdict on an
   unchanged site is common. Re-submit when: `/` returns real content to
   `curl -A Googlebot https://cardpop.com.au/`, the blog shows new dated
   articles, the price pages show today's date, and the sitemap has no empty
   pages.

## Keeping it fixed

- A new public route gets a prerender renderer and a sitemap entry **only if it
  carries content without JavaScript**. A page that is a tool, a form or a
  directory of names stays out of the sitemap and takes `noindex` when empty.
- Never write a number the database doesn't back ("thousands of", "Australia's
  largest"). `tests/backend/prerender.test.js` fails on "thousands of" in the
  homepage render.
- Ads only load on content pages (`lib/adsense.js` → `NO_AD_PREFIXES`); the
  homepage and every buying surface stay ad-free.
- If the blog generator's queue runs dry again, queue briefs through
  `POST /hcgi/api/blog/topics` or a seed migration; `docs/blog-automation.md`.
