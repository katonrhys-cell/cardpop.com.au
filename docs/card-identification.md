# Card identification

How a photo becomes filled-in listing fields, and why the steps run in this
order. Touches `pages/AddEditCardPage.jsx` (`handleAnalyzeWithAI`),
`hooks/useCardOCR.js`, `hooks/useCardSight.js`, `src/routes/card-ocr.js` and
`src/routes/cardsight.js`.

## The pipeline

```
Identify button  (never an upload side-effect — see below)
  │
photo(s)          front + up to two more angles, ANALYSIS_IMAGE_LIMIT total
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

### Why it is a button

Identification used to fire automatically the moment a seller dropped their
first photo onto a new card. It no longer does: `handleImageChange` stores the
photo and nothing else, and the only trigger is the **Identify Card** button.

The auto-run's problem was structural, not cosmetic. Firing on the first upload
means the read is always **front-only**, and the front is the weaker half of the
card — the set code, collector number and release year are frequently printed
only on the back. The pipeline has accepted several images the whole time; the
auto-run simply guaranteed it never got them, because it ran before the seller
had a chance to add any.

The clearest evidence was the flow's own fallback: read the front, notice the
year is missing, then show the back-photo prompt (`utils/backPhotoPrompt.js`)
asking the seller to add the back and identify *again*. Two model calls, a
re-shoot and a second wait, to reach what one call with two photos answers
directly.

So the button is now the trigger, and it states what the next read will actually
see (`identifyCallToAction` in `utils/listingFlow.js`):

| Photos loaded | Button | Hint |
|---|---|---|
| Front only, no read yet | `Identify Card` | asks for the back **first**, naming why |
| 2-3, no read yet | `Identify Card from N photos` | reads them together |
| More photos added since the last read | `Identify Again with N photos` | ringed, because the read is now stale |
| Unchanged since the last read | `Identify Again` | states the count the last read used |

`analysisPhotoCount` and `ANALYSIS_IMAGE_LIMIT` (also `utils/listingFlow.js`) are
what keep that copy honest — the same constant caps `prepareAnalysisImages` and
`useCardOCR`, so the button can't promise a photo the request would drop.

The back-photo prompt stays, and stays correct: a front-only read is now a
choice the seller made rather than one the flow made for them, so it is still
worth telling them what the back would have added.

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

Every image is rectified — the extra angles are usually the back, where the
set code, collector number and copyright line live, so they benefit at least
as much as the front. The front gets the full 8-second budget (it may pay the
library load); each extra angle gets a tighter 4-second, fail-safe pass of its
own. And **every** image is resized before it is sent.

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

**Cost.** OpenCV is a lazily-loaded ~3.5 MB (gzipped) script asset (a classic
`<script>` tag, not an `import()` — its Emscripten build carries a legacy
thenable that hangs every promise-interop path; see `utils/opencvLoader.js`),
and this puts it on the default path for every seller rather than only those
who use the manual crop. `handleImageChange` warms the load the moment a photo
is selected, so by the time the seller hits Identify the library is normally
resident and the 8-second budget is spent on detection rather than download.
Set `VITE_OCR_AUTOCROP=false` at build time to send the original photo straight
to the models.

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

The result is then grounded against the card catalogue
(`groundAgainstCatalogue` → `/catalog/search`). The search fans out to the
public APIs (Pokemon / Magic / Yu-Gi-Oh) **and to CardPop's own
`card_catalogue`** (`src/utils/internalCatalogue.js`) — the database
accumulated from every scan, and the only source that exists for sports cards,
One Piece, AFL and the other hobbies no public API covers. See "Grounding
rules" below, which govern when that lookup is allowed to overwrite anything.

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
catalogue only supplies one when OCR couldn't read it. An internal-catalogue
match can additionally fill `insertName` (sports-card identity the public
adapters have no concept of) — again only when OCR read nothing.

**Internal candidates must be human-confirmed.** Only `card_catalogue` rows
with `confirmations >= 1` — a seller saved the identification untouched — are
eligible as grounding candidates. An unconfirmed row is just an earlier model
read, and letting it corroborate a new read would be the pipeline confirming
itself: one bad read could snowball into a permanently "verified" wrong answer.
The corroboration bar (name + number, or name + set/year) is the same as for
public candidates; internal ones get no shortcut.

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

Making the scan manual also removed the auto-run's own cost, which was easy to
miss: every new card with a photo spent a scan, including the ones a seller
abandoned, and every card the front-only read couldn't finish spent a second one
on the re-run. A deliberate scan carries more images per call but there are
fewer wasted calls to pay for.

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

## Every scan is recorded

`POST /card-scans` logs each identification to `card_scans`, and
`PATCH /card-scans/:id` attaches what the seller actually saved. Both are
fire-and-forget from the form: logging is bookkeeping behind a scan that already
succeeded, so a failure there must never surface to the seller.

Two things get captured, and the second is the more valuable:

- **What the pipeline read**, plus how it got there — model escalation and its
  reason, which fields the catalogue corroborated, CardSight's confidence and
  ambiguity, how many images the read had. Aggregated this is a production
  accuracy signal: the fixture harness measures seven cards, this measures every
  scan a seller runs. `escalation_reason` is indexed for exactly that — a gate
  that fires on every scan is costing a second model call for nothing.
- **What the seller changed.** An edit after an identification is ground truth,
  and it is the only ground truth that arrives for free.

### The catalogue

`card_catalogue` is the deduplicated result: one row per distinct card,
accumulating observations, so CardPop ends up with its own card database rather
than depending on third-party catalogues to recognise a card. It is a **shared**
table — `vault_items` already holds a seller's own cards — readable by anyone and
written only by the backend, so no seller can corrupt it.

That loop is closed: `/catalog/search` reads the confirmed entries back as a
grounding source (`src/utils/internalCatalogue.js`), so every seller-confirmed
identification makes the next scan of that card more accurate — including for
the hobbies where it is the only catalogue there is.

Identity comes from `utils/catalogueKey.js`. What counts as a distinct card is
what counts as a distinct thing to sell, so the **parallel and insert are part of
the key**: a base card and its Red Laser share name, set, number and year and are
worth very different amounts.

`buildCatalogueKey` returns **null** when a read isn't specific enough, and that
null matters more than the happy path. A scan that produced only a player name
can't be told apart from a hundred other printings, and writing it to the
catalogue would create an entry later scans wrongly merge into — poisoning the
record permanently. Such scans are still logged; they just don't earn an entry.
Keys that had to fall back to the name are marked `strong_key = false`.

`observations` counts every scan resolving to a key; `confirmations` counts only
those a seller then saved without correcting the identity fields. **An entry with
many observations and no confirmations is one the pipeline keeps producing and
sellers keep fixing** — the most useful thing in the table.

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
