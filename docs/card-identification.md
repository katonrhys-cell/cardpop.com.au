# Card identification

How a photo becomes filled-in listing fields, and why the steps run in this
order. Touches `pages/AddEditCardPage.jsx` (`handleAnalyzeWithAI`),
`hooks/useCardOCR.js`, `hooks/useCardSight.js`, `src/routes/card-ocr.js` and
`src/routes/cardsight.js`.

## The pipeline

```
photo(s)
  │
  ├─0─ Rectify        detectAndCropCard → card warped flat, background removed
  │
  ├─1─ OCR            POST /card-ocr/scan      Claude reads the card
  │        └─ grounded against the public TCG catalogue (/catalog/search)
  │
  ├─2─ Category       collection = seller's pick || OCR's collectionType
  │
  ├─3─ Catalog match  POST /cardsight/identify?collection=…   ONE segment
  │
  └─4─ Overlay        CardSight fields applied only on a clean exact hit
```

### 0. Rectify the card out of the photo

`prepareAnalysisImage` (`utils/analysisImage.js`) runs the existing OpenCV
detection over the front photo and, when it finds a card-shaped quad, warps it
flat to the standard 1200×1680.

This is about pixels-on-card, not tidiness. Vision APIs downscale what they are
sent — Anthropic caps the long edge around 1568px — so the card's *share* of
that budget decides whether the collector number and copyright line are legible.
A 3000×4000 photo with the card filling 60% of the frame arrives as roughly
900×1250 pixels of card; the same card cropped and warped arrives intact. It
also removes background and corrects tilt.

Both models get the rectified image. **The seller's own photo is never
touched** — this is analysis input only, separate from the manual "Format
Photo" crop, which does replace the stored image.

Every failure path keeps the original: nothing detected, OpenCV failing to
load, a warp smaller than 600px on its long edge, or the whole step exceeding
8 seconds. It can improve the input or leave it alone, never block a scan.

Only the front is *rectified* — cropping the extra angles too would double the
wait for a secondary read — but **every** image is resized before it is sent.

### The payload cap (why identification used to fail outright)

Vercel refuses a serverless request body over **4.5 MB** with a 413
(`FUNCTION_PAYLOAD_TOO_LARGE`) before Express ever runs. The form used to post
raw camera files: up to 5 MB each, up to three of them. Ordinary phone photos
therefore failed identification completely, and the seller saw Vercel's raw
`FUNCTION_PAYLOAD_TOO_LARGE` plus a request id.

`prepareAnalysisImages` now resizes every image to a 1600px long edge at JPEG
q0.85 (~300-500 KB each) and, if the body would still exceed a 3.5 MB budget,
drops trailing angles — never the front, which is the read that matters. Note
this costs nothing in accuracy: the models downscale to roughly that size
anyway, which is the same argument that motivates rectification.

JPEG rather than the compressor's default WebP, because these images go to two
third-party APIs and JPEG is what both unambiguously accept.

A 413 that still gets through is reported as "those photos are too large to
analyse together" rather than the raw Vercel body.

**Cost.** OpenCV is a lazily-loaded ~3.5 MB (gzipped) wasm chunk, and this puts
it on the default path for every seller rather than only those who use the
manual crop. First scan on a cold cache pays that download inside the 8-second
budget; later scans are cached. Set `VITE_OCR_AUTOCROP=false` at build time to
send the original photo straight to the models.

### 1. OCR first

`useCardOCR` streams the images to `/card-ocr/scan`, which asks Claude for a
structured read of the card (name, set, collector number, year, condition,
grading slab, rarity). A cheap model handles it and `escalationReason` decides
whether to spend a second, stronger pass.

That decision is made on **the fields the rest of the pipeline consumes**, not
on the model's opinion of its own work — self-reported confidence is weakly
calibrated and used to be almost the only signal, so a read could arrive with no
category, no set and no number and still be accepted because it had a name and
said "medium". Escalation now fires on:

| Reason | Why it matters |
|---|---|
| `unparseable` | no JSON in the reply |
| `no-name` | nothing to search the catalogue with |
| `no-category` | `collectionType` picks the CardSight segment; without it, identify falls back to the ten-segment fan-out |
| `low-confidence` | the model said so |
| `uncertain-set` | `candidateSets` is non-empty — the prompt tells it to shortlist rather than guess, so a shortlist *is* the uncertainty signal |
| `no-identity` | neither set nor collector number, so the catalogue has nothing to corroborate a name against |

A read missing *only* the collector number is accepted: many numbers are on the
back, which the auto-run doesn't have, and the set still gives the catalogue
something to check.

The escalation result is only taken when it actually read a card — a flaky or
truncated second call must not replace a usable first one.

The result is then grounded against the public card catalogue
(`resolveAgainstCatalogue` → `/catalog/search`, covering Pokemon / Magic /
Yu-Gi-Oh) — see "Grounding rules" below, which govern when that lookup is
allowed to overwrite anything.

**OCR runs first because it is the only step that can name the category.**
Everything downstream depends on that.

### Grounding rules

The collector number is the discriminating field. A card *name* can match
hundreds of printings; "4/102" pins down one. Two rules follow.

**Query with it.** `/catalog/search` accepts a `number` param and pushes it into
the upstream query (`number:"4"` for the Pokémon API, `cn:4` for Scryfall). The
search runs in two passes — precise first, then name-only if that found nothing,
so a misread number degrades to the old behaviour instead of returning nothing.
The response's `precise` flag says which pass produced the results. YGOPRODeck
has no number filter and always runs name-only.

**Require corroboration before overwriting.** A candidate is accepted only when:

- its collector number agrees with the printed one, **and** the name matches; or
- no number was read, the name matches, **and** the set or year also agrees.

A candidate whose number *positively disagrees* is disqualified outright — it is
a different printing. An absent number is merely unknown and does not
disqualify. Nothing is ever matched on non-name evidence alone.

This bar exists because the previous one (name match alone) actively corrupted
correct reads: for any card with multiple printings, an arbitrary candidate from
the name search replaced the set, number and year that OCR had read correctly
off the card. Grounding made the answer worse than no grounding.

**What the overlay may change.** The catalogue is authoritative for set name,
year and rarity — often absent or ambiguous on the card. The **collector number
is not overwritten**: it is printed on the card and was read directly, so the
catalogue only supplies one when OCR couldn't read it.

`catalogueMatch.verified` lists the fields that actually agreed (`['name',
'number', 'set', 'year']`), and the UI badge renders exactly that instead of
claiming a blanket "set & card number verified". Sources that carry nothing to
verify — the Yu-Gi-Oh adapter returns null set/number/year — therefore produce
no match and no badge, rather than a false one.

**Shortlisted sets count, but separately.** When the model wouldn't commit to a
set it returns up to three in `candidateSets`. A candidate whose set matches one
of those corroborates the match — that's the case with the least evidence going,
and the catalogue independently landing on one of the model's own guesses is
real agreement — but it is recorded as `likely set` rather than `set`, ranks
below an outright set match, and shows as such in the badge.

**Set names are compared on whole words, not substrings.** Set names nest:
plain containment makes "Base Set" match "Base Set 2", and "Sword & Shield"
match "Sword & Shield Promo" — different sets that would then corroborate each
other. A shorter name matches a longer one only when every extra word is
non-distinguishing (`set`, `series`, `edition`, `collection`, …), so
"Base" still matches "Base Set" but "Base Set" no longer matches "Base Set 2".

### 2. Choosing the category

```js
const collection = formData.collection || ocrResult?.collectionType || '';
```

A collection the seller picked themselves always wins — OCR is a guess about
their card, they are not.

### 3. CardSight, narrowed to one segment

`getSegmentsForCollection` (`src/utils/collectionSegmentMap.js`) turns the
collection name into segments, with three deliberately distinct outcomes:

| Collection | Segments | Behaviour |
|---|---|---|
| Covered (Pokemon, NBA, NHL, …) | exactly one | one CardSight call |
| Known but uncovered (Magic, One Piece, AFL, NRL, Boxing, F1, …) | `[]` | **skipped entirely**, responds `unsupportedCollection: true` |
| Unknown / blank | all ten | fan out, then rank |

The uncovered case matters more than it looks. **Every CardSight segment answers
with its best guess _within that segment_** — ask the baseball segment about a
One Piece card and you get a baseball card back, with a confident-looking
label. Searching a catalog that cannot contain the card can only produce a wrong
answer, so the route bails out before spending the quota.

Names are matched loosely (case, accents and punctuation ignored), and aliases
exist for the display names the form writes back after an identify
(`"NBA Basketball"` → `basketball`) so a re-scan doesn't fall through to the
fan-out.

### Ranking the fan-out

When no category is known, all ten segments are queried and their detections
merged. Ordering is explicit in `rankCandidates`:

1. **Match specificity** — exact card id > set-level > neither
2. **Confidence tier** — High > Medium > Low

Do not replace this with the SDK's `getHighestConfidenceDetection`. It sorts on
the confidence enum alone, and since that enum has only three levels, most
cross-segment scans tie — leaving the winner to be decided by the order the
segments happen to sit in the fan-out array (basketball first, pokemon fifth).
That is what made scans return confident cards from the wrong sport.

When a runner-up from a *different* segment ranks equally, the response is
flagged `ambiguous` and carries ranked `alternatives` so the seller can correct
the pick in place.

### 4. Overlaying the catalog record

CardSight overwrites the OCR-derived fields only when the match is
**trustworthy** — an exact hit, not ambiguous, not low confidence. Otherwise the
OCR fields stand and CardSight's guess is shown as a suggestion in the results
panel. This is what stops a weak cross-category match from quietly replacing
what was actually read off the card.

## Confidence is an enum, not a number

CardSight reports `confidence` as `"High" | "Medium" | "Low"` (documented bands:
High 90-100%, Medium 75-89%, Low 50-74%). It is **not** a 0..1 score.

Everything that renders or thresholds it must go through
`utils/cardsightConfidence.js`, shared by the route and the form. Treating the
enum as a number produces `NaN` from `confidence * 100`, and every numeric
comparison (`'High' >= 0.95`) silently evaluates false — which pinned every
match, including exact ones, to the lowest band while the heading said "Exact".

The route sends `confidence` (raw enum, for compatibility) alongside
`confidenceLabel` and `confidenceScore`; consumers should read the derived
fields.

## Cost

Per scan: **1 Claude OCR call + at most 1 CardSight call.** Before OCR-first
routing it was 10 CardSight calls on every scan (the blind fan-out) plus an OCR
call whenever that missed. The fan-out now only happens when the category can't
be determined at all.

## Measuring it

`scripts/score-card-identification.mjs` runs labelled fixtures through the real
pipeline and reports per-field accuracy. Fixtures and usage:
`tests/fixtures/card-identification/README.md`.

It imports the same modules the app does — prompt and escalation policy
(`src/utils/cardOcr.js`), grounding rules (`utils/catalogueGrounding.js`),
segment map, and CardSight ranking (`src/utils/cardsightRanking.js`) — so it
measures production behaviour rather than a re-implementation. Those modules were
pulled out of the scan route and the React hook for exactly this reason; keep new
decision logic out of the route handler and the hook so it stays measurable.

The one thing the script does re-implement is the **orchestration order**, which
lives in `handleAnalyzeWithAI` (`pages/AddEditCardPage.jsx`) and is welded to
React state. If you reorder the stages there, reorder them in the script too.

Scoring splits every field into `correct` / `wrong` / `missing`, because **wrong
is much worse than missing**: a blank field costs a seller some typing, a
confidently wrong one reaches a live listing. Drive `wrong` to zero before
chasing `correct` upward — filling more fields incorrectly improves coverage
while lowering trust.

## Debugging a bad identification

`/cardsight/identify` logs the winning segment, candidate count and ambiguity:

```
[CARDSIGHT] Identified card <id> (<name>) confidence=High segment=pokemon ambiguous=false candidates=3 collection=Pokemon
```

- `segment` unexpected → the category was wrong; check what OCR returned for
  `collectionType` and whether the collection name is in `COLLECTION_SEGMENT_MAP`.
- `ambiguous=true` → a cross-segment collision; the seller sees alternatives.
- `candidates` high with a blank `collection` → the fan-out ran, meaning OCR
  couldn't name the category.
- `Skipping identify — "X" is not in the CardSight catalog` → working as
  intended; the OCR + public-catalogue path is the answer for that hobby.

## Env

`ANTHROPIC_API_KEY` (OCR) and `CARDSIGHT_API_KEY` (catalog + pricing). Without
the latter, `/cardsight/identify` returns 503 and the flow degrades to OCR only,
which still fills the form.
