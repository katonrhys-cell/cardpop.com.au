# Card identification

How a photo becomes filled-in listing fields, and why the steps run in this
order. Touches `pages/AddEditCardPage.jsx` (`handleAnalyzeWithAI`),
`hooks/useCardOCR.js`, `hooks/useCardSight.js`, `src/routes/card-ocr.js` and
`src/routes/cardsight.js`.

## The pipeline

```
photo(s)
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

### 1. OCR first

`useCardOCR` streams the images to `/card-ocr/scan`, which asks Claude for a
structured read of the card (name, set, collector number, year, condition,
grading slab, rarity). A cheap model handles it; `shouldEscalate` retries with a
stronger one when the JSON is unreadable, has no name, or self-reports low
confidence.

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
