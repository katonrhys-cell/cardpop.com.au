# Email assets

## `launch-welcome.pdf` — free collector's guide

The pre-launch welcome email (`sendLaunchWelcome` in `src/utils/emailService.js`)
attaches this PDF as **The-Basketball-Card-Collecting-Bible-2026-CardPop.pdf**.

The committed `launch-welcome.pdf` is a designed, print-ready export of the blog
article `/blog/the-basketball-card-collecting-bible-2026-edition` — branded hero
cover, market-stat band, parallel-scarcity spectrum, colour-coded PSA grade
scale, and a closing CTA page. It is read from disk and attached inline, and
`vercel.json` includes `src/emails/assets/**` in the `api/index.js` function
bundle so the file ships with the serverless function.

Two ways to supply the PDF — the first one found wins:

1. **Hosted URL:** set the `LAUNCH_WELCOME_PDF_URL` env var to a publicly
   reachable PDF URL. Resend fetches it at send time and this committed file is
   ignored. Handy for swapping the guide without a redeploy.
2. **Committed file (current setup):** the `launch-welcome.pdf` in this folder.

If **neither** is present the welcome email still sends — just without the
attachment (logged at debug level), and the email copy omits the "attached
guide" line automatically (`hasGuide` flag in `launchWelcomeEmail`).

### Regenerating the PDF

The generator lives in `scripts/guide-pdf/`:

- `bible-content.html` — the article body (kept in sync with the blog post).
- `hero.png` — the cover artwork.
- `render-guide.mjs` — a Playwright script that assembles the branded document
  and renders the PDF (it recompresses the hero to a lean JPEG so the file stays
  a comfortable email attachment — currently ~600 KB).

```bash
# Uses the repo's Playwright; point CHROME_PATH at a browser if the matching
# build isn't installed (e.g. a sandbox's pre-installed Chromium).
node scripts/guide-pdf/render-guide.mjs            # writes src/emails/assets/launch-welcome.pdf
```

Edit `bible-content.html` (or drop in a new `hero.png`) and re-run to refresh.
