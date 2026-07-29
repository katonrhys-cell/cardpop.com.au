# Card identification fixtures

Real card photos plus the correct answer for each, so changes to the
identification pipeline can be **scored** instead of argued about.

Run the harness:

```bash
node scripts/score-card-identification.mjs
node scripts/score-card-identification.mjs --case charizard-base-set   # one card
node scripts/score-card-identification.mjs --crop                      # also measure rectification
node scripts/score-card-identification.mjs --json > before.json        # for diffing
```

Needs `ANTHROPIC_API_KEY`; `CARDSIGHT_API_KEY` (and the backend Supabase vars it
pulls in) enable the catalog stage, and the run says so when they're absent.

## Adding a card

1. Drop the **original, full-resolution** photo in `images/`.
2. Add an entry to `cases.json`.

```json
{
  "id": "charizard-base-set",
  "image": "charizard-base-set.jpg",
  "expected": {
    "name": "Charizard",
    "setName": "Base Set",
    "cardNumber": "4/102",
    "year": "1999",
    "collection": "Pokemon"
  },
  "notes": "Holo, unlimited. Previously came back as a hockey card."
}
```

Leave any field you're unsure of **out** — a blank expectation is not scored,
so a partial fixture is still useful. `notes` is free text for context, most
usefully what the pipeline currently gets wrong about this card.

### Photos must be originals

Do **not** downscale or pre-crop them. The rectification step
(`utils/analysisImage.js`) is one of the things being measured, and it operates
on the full-resolution photo — a fixture that has already been cropped can't
tell us whether cropping helps.

Take them the way a seller would: hand-held, on whatever surface, tilted,
ordinary lighting. A set of perfectly-framed scans would score well and tell us
nothing about real listings.

### Images are not committed

`images/` is git-ignored. Full-resolution photos are a few MB each and would
bloat the repo, and downscaling them to fit would defeat the purpose.

Keep the image set in the **"cardpop.com.au- site backup"** Google Drive folder
(same convention as `docs/backup-and-restore.md`), under
`card-identification-fixtures/`. `cases.json` **is** committed, so the expected
answers are versioned and reviewable even though the photos travel separately.

## What to include

Aim for a mix that looks like real inventory rather than a clean test set:

- **Cards that currently come back wrong** — the most valuable fixtures by far.
- Both hobbies: Pokémon and sports, since they take different paths (CardSight
  covers ten sports segments plus Pokémon).
- At least a few collections CardSight has **no** catalog for — Magic, One
  Piece, AFL, NRL — which must fall back to OCR and the public TCG catalogue.
- A common name with many printings (Pikachu, Charizard) — the case where
  name-only catalogue matching used to overwrite correct reads.
- A graded slab, where the card sits behind plastic with a label above it.
- A card whose collector number is only on the back.

A dozen is enough to start. Coverage matters more than volume.

## How scoring works

Each asserted field comes back `correct`, `wrong` or `missing`:

- **wrong** — a value was produced and it disagrees with the truth. This is the
  number that matters: it reaches a live listing and misrepresents the sale.
- **missing** — nothing was produced. Costs the seller some typing.
- **correct** — agrees, allowing for the tolerances the pipeline itself uses:
  `4/102` matches `4`; `Base` matches `Base Set` (but not `Base Set 2`); and a
  season prefix is ignored when only one side has it, so `Topps Chrome` matches
  `2025-26 Topps Chrome` but not `1999 Topps Chrome`.

`parallel` is scored too, and strictly — on a modern sports card it is usually
the biggest driver of value, since the base and the Red Laser Holo of the same
player share name, set, number and year. Note that **only CardSight can fill
it**: OCR's `cardType` read goes into the listing notes and never reaches a
field, so expect `missing` unless CardSight returns a trustworthy exact match.

A case is **clean** only when nothing came back wrong. Chase `wrong` to zero
before chasing `correct` upward — filling more fields incorrectly raises
coverage while lowering trust.

## Measuring rectification (`--crop`)

Off by default, and it is the one stage that can't always be measured.

`utils/analysisImage.js` needs a canvas and the OpenCV wasm build, so it can't
run in Node. Approximating it with sharp would measure something production
never does, so `--crop` builds the harness page with Vite and drives the real
module in headless Chromium (`scripts/card-identification/`).

**This does not work everywhere.** Evaluating the ~10 MB OpenCV module *blocks
the renderer's main thread* while Emscripten compiles it — the page can't answer
anything until it finishes, and on constrained hardware it doesn't finish. The
warm-up is bounded at 90s; past that the run continues on the original photos
and prints why. Try it on a real dev machine rather than a container.

That blocking behaviour is worth knowing about beyond the harness: it is the
same work a seller's phone does on their first scan.

## Cost

Every run calls the live Anthropic, catalogue and CardSight APIs once per case
(twice when OCR escalates). A dozen cases is a few cents and counts against the
CardSight quota. It is a manual tool, deliberately not wired into CI.

The script exits non-zero when any field came back wrong, so it can gate a
manual check before a release.
