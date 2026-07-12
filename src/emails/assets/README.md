# Email assets

## `launch-welcome.pdf` — pre-launch early-access guide

The pre-launch welcome email (`sendLaunchWelcome` in `src/utils/emailService.js`)
attaches a PDF as **CardPop-Early-Access.pdf**. There are two ways to supply it —
the first one found wins:

1. **Hosted URL (recommended for production):** set the `LAUNCH_WELCOME_PDF_URL`
   env var to a publicly reachable PDF URL (e.g. a Supabase Storage public URL or
   any CDN link). Resend fetches it at send time — nothing needs to be committed.

2. **Committed file:** drop the PDF in this folder as **`launch-welcome.pdf`**.
   It's read from disk and attached inline.

If **neither** is present the welcome email still sends — just without the
attachment (logged at debug level). So the flow works end-to-end today; add the
real PDF whenever it's ready, no code change required.
