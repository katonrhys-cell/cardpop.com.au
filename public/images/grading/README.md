# Grading company logos

Official logo files for the grading companies named across the Grading Hub, read by
`components/grading/GraderLogo.jsx` through `data/gradingCompanies.js`. **Only the company's
own published artwork goes here, unaltered** — if a file is missing the UI shows a plain
wordmark in the brand colour rather than an approximation of the mark.

| File | Company | Status |
|---|---|---|
| `psa.png` | PSA (Professional Sports Authenticator) | In place — the blue/red PSA mark, cut from the logo image supplied on 2026-11-04 (white knocked out to transparent). Replace with the SVG from https://www.psacard.com/logo when it can be fetched |
| `bgs.png` / `bgs-white.png` | Beckett Grading Services | In place — Beckett's 2025 laurel-wreath B + BECKETT crest, black and white versions cut from the announcement artwork supplied on 2026-11-04. Replace with Beckett's own file (press/brand kit) when available |
| `cgc.png` | CGC Cards (Certified Guaranty Company) | In place — the red scales + CGC® mark, cut from the logo image supplied on 2026-11-04. Replace with the vector from https://www.cgccards.com when available |
| `ace.svg` | ACE Grading | **Missing** — the gold shield "A" at https://www.acegrading.com; the copies supplied so far were too small to use. Wordmark fallback until then |
| `sgc.png` / `sgc-white.png` | SGC (Sportscard Guaranty Corporation) | In place — the SGC wordmark (what the slab label prints), black and white versions cut from the clean white-on-black artwork supplied on 2026-11-04. Replace with SGC's own file (gosgc.com publishes a white logo) when available |
| `tag.png` / `tag-white.png` | TAG Grading | In place — the boxed serif TAG mark, black and white versions cut from the official lockup (white on black, with tagline) supplied on 2026-11-04. Replace with TAG's own file when available |

When a file lands or is replaced: point `logo` (and `logoDark` for a light-on-dark version)
at it in `data/gradingCompanies.js`, sample the mark's primary fill into `brand.primary`,
pick a readable `brand.onDark`, and set `verified: true` with the source noted. Tall,
near-square marks (the Beckett crest) take `logoScale` so they get more height than a
wordmark. SVG is preferred; a PNG with a transparent background at 2× display size is fine.

Each company's name and logo are its trademark, used here to identify that company's
service. Keep the marks unmodified (no recolouring, stretching or cropping of the mark
itself) and don't use them to imply partnership or endorsement — check each company's
logo-use guidelines (PSA publishes one at the link above).
