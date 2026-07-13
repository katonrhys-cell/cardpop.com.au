# Email assets

## `launch-welcome.pdf` — free collector's guide

The pre-launch welcome email (`sendLaunchWelcome` in `src/utils/emailService.js`)
attaches this PDF as **The-Basketball-Card-Collecting-Bible-2026-CardPop.pdf**.

The committed `launch-welcome.pdf` is *The Basketball Card Collecting Bible
(2026 Edition)* — a branded, print-styled export of the blog article
`/blog/the-basketball-card-collecting-bible-2026-edition`. It is read from disk
and attached inline, and `vercel.json` includes `src/emails/assets/**` in the
`api/index.js` function bundle so the file ships with the serverless function.

Two ways to supply the PDF — the first one found wins:

1. **Hosted URL:** set the `LAUNCH_WELCOME_PDF_URL` env var to a publicly
   reachable PDF URL. Resend fetches it at send time and this committed file is
   ignored. Handy for swapping the guide without a redeploy.
2. **Committed file (current setup):** the `launch-welcome.pdf` in this folder.

If **neither** is present the welcome email still sends — just without the
attachment (logged at debug level), and the email copy omits the "attached
guide" line automatically (`hasGuide` flag in `launchWelcomeEmail`).

### Regenerating the PDF

The guide is generated from the live blog article with a small Playwright
script (branded cover + print CSS). If the article changes and you want to
refresh the PDF, re-run that render against the article HTML and overwrite
`launch-welcome.pdf`. Keep it lean (well under a few MB) so it stays a
comfortable email attachment.
