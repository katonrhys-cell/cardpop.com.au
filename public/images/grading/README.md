# Grading company logos

Official logo files for the grading companies named across the Grading Hub, read by
`components/grading/GraderLogo.jsx` through `data/gradingCompanies.js`. **Only the company's
own published artwork goes here, unaltered** — if a file is missing the UI shows a plain
wordmark in the brand colour rather than an approximation of the mark.

| File | Company | Where the official file comes from |
|---|---|---|
| `psa.svg` | PSA (Professional Sports Authenticator) | Brand guidelines / logo downloads at https://www.psacard.com/logo |
| `bgs.svg` | Beckett Grading Services | https://www.beckett.com/grading (site header logo), or Beckett's press/brand kit |
| `cgc.svg` | CGC Cards (Certified Guaranty Company) | https://www.cgccards.com (site header logo), or the CCG press kit |
| `ace.svg` | ACE Grading | https://www.acegrading.com (site header logo) |
| `sgc.svg` | SGC (Sportscard Guaranty Corporation) | https://www.gosgc.com (site header logo) |
| `sgc-white.svg` | SGC — light-on-dark version, shown in dark mode | SGC publishes a white logo on gosgc.com |
| `tag.svg` | TAG Grading | https://taggrading.com (site header logo) |

After dropping a file in, open it and copy the mark's primary fill into
`brand.primary` for that company in `data/gradingCompanies.js`, pick a readable
`brand.onDark`, and flip `verified` to `true` with the source noted. SVG is preferred (it
scales and carries the exact colours); a PNG at 2× display size is fine if a company only
publishes raster artwork — update the `logo` path to match.

Each company's name and logo are its trademark, used here to identify that company's
service. Keep the marks unmodified (no recolouring, stretching or cropping) and don't use
them to imply partnership or endorsement — check each company's logo-use guidelines (PSA
publishes one at the link above).
