# Grade Estimator

`/grading/estimator` (`pages/grading/GradeEstimatorPage.jsx`) gives a signed-in member a
preliminary grade for a card across **PSA, BGS, CGC, ACE, SGC and TAG**, worked out from
the card's condition in the photos they upload. It is a guide, not a grade — the page
carries the disclaimer and the prompt is told to be conservative.

## Flow

1. The member picks a front photo (required) and a back photo (recommended). The preview
   is a `blob:` object URL, so the Content-Security-Policy's `img-src` must list `blob:`
   (both CSP headers in `vercel.json`) — without it the browser blocks the preview and the
   slot shows the image's alt text instead.
2. `hooks/useGradeEstimator.js` shrinks each photo in the browser
   (`utils/compressImage.js`, 2000 px, JPEG) before posting, because Vercel rejects a
   request body over 4.5 MB before Express runs.
3. The hook posts to **`/grade-estimate/estimate`** — the estimator's own serverless
   function (`api/grade-estimate.js`, `maxDuration` 300 s in `vercel.json`, reached by
   the `/grade-estimate/:path*` rewrite), *not* `/hcgi/api`. A Sonnet vision call that
   writes six graders' worth of JSON is regularly 30–60 s, and the shared `api/index.js`
   function caps at 40 s: inside it every estimate died on the clock and the page read
   "That estimate took too long". The function hosts the same router
   (`src/routes/grade-estimator.js`: auth + the integrated-AI rate limit + the upload
   guard) and bundles sharp like `api/index.js` does.
4. The route compresses the buffers again server-side and sends them **inline as base64
   image blocks** straight to the Anthropic Messages API as a **stream**
   (`streamGradeEstimate()` in `src/utils/gradeEstimator.js`, `claude-sonnet-4-6`, 150 s
   budget `OUTBOUND_TIMEOUT_MS.anthropicGrade` covering the whole stream). The photos are
   never stored. The response headers are flushed at once with an SSE comment, and each
   text delta is forwarded as a `content` event as the model writes it — Cloudflare drops
   an origin response that is silent for 100 s, and the member sees the answer arrive
   rather than a spinner.
5. The route answers as SSE (`content`… → `completed`, or one `error`), which the hook
   concatenates and parses into the JSON the page renders: four condition rows (centering,
   corners, edges, surface), strengths/issues, then one card per grader with the estimate,
   range, label, confidence and notes (BGS also carries sub-grades).

## Configuration

Needs `ANTHROPIC_API_KEY` (shared with card OCR, the blog generator and the event scan).
Unset = the route answers 503 "not configured" and the page shows that instead of a
generic failure.

Before this the route went through the Hostinger-era "integrated AI" proxy
(`INTEGRATED_AI_API_URL`, `src/api/integrated-ai.js`), which has no value in the Vercel
project — so every estimate died on `fetch('undefined/generate')` and surfaced as
`Request failed (500): {"message":"Something went wrong!"}`. The AI chat route still uses
that proxy.

## Failure copy

Provider errors never reach the browser verbatim (they can carry the account's credit
balance or key state): `describeGradeFailure()` maps them to member-facing copy the same
way `describeOcrFailure()` does for card scans, and the full error goes to the logs under
`[GRADE_ESTIMATOR]`.

## Adding a grading company

Add it to the scale reference and the JSON schema in `GradeEstimatorPrompt`
(`src/constants/prompts.js`) and to `GRADING_COMPANIES` in `data/gradingCompanies.js`; the
results grid renders whatever keys the prompt returns that the list carries.

## Company branding (logos and colours)

Every grader card, and the "Grading Services Covered" strip, is themed from
`data/gradingCompanies.js` — one entry per company with its `brand.primary` hex (the tint,
border and fallback wordmark are derived from it via `graderStyle()`), an optional
`brand.onDark` ink for dark mode, and the path of the company's **official logo file** in
`public/images/grading/` (`logo`, plus `logoDark` where the company publishes a
light-on-dark version). `components/grading/GraderLogo.jsx` shows that file and falls back
to a plain wordmark in the brand colour if it is missing or fails to load — it never redraws
a mark, so a missing file can't ship as a near-miss logo. The folder's README lists where
each official file comes from; drop the file in, sample its primary fill into
`brand.primary`, and set `verified: true`. Marks are the companies' trademarks: keep them
unmodified and use them only to identify the service (PSA publishes logo-use guidelines at
psacard.com/logo).

**The estimate is drawn as that company's slab label.** `components/grading/SlabLabel.jsx`
renders the grade box the way the top of the slab looks — PSA's red-framed white label
with the grade word above the number and the blue/red mark along the bottom, Beckett's silver label (gold from 9.5, the Black Label with the
grade in gold for a 10 with four 10 sub-grades) with the laurel crest and the four
sub-grades in a row, ACE's navy label with the angled grade panel (light stock, gold for a
Gem Mint 10), CGC's black label, SGC's black strip with the mark over a white panel and the grade word
as a badge, TAG's black label with its white inset frame and the mark
centred on the frame's top edge — with the
mark on the left and the grade, its word beneath it, on the right. Which stock a company
prints for a grade is `label.tiers` on its entry, resolved by `slabLabelTier()`, and the
stock colours are `SLAB_LABEL_LOOKS`; both in `data/gradingCompanies.js`. Label stock is
fixed colour (a black label stays black in light mode), so the logo is pinned with
`GraderLogo`'s `tone` / `ink` props rather than following the theme. Every look but CGC's follows
reference artwork supplied on 2026-11-04; CGC's black label is still an approximation —
check it against a real slab.
