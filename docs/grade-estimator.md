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
(`src/constants/prompts.js`) and to `GRADERS` in `GradeEstimatorPage.jsx`; the results
grid renders whatever keys the prompt returns that `GRADERS` lists.
