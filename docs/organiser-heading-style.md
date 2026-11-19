# Organiser heading matched to the logo

An organiser page (`/events/organisers/<slug>`) shows the organiser's name as
its heading. An admin can set that heading in type that looks like the
lettering in the organiser's logo.

## Using it

1. Open the organiser page and click **Edit page** (signed in as an admin).
2. Under **Logo**, choose a logo. As soon as an image is picked, the
   **Heading style (from the logo)** box reads it (a few seconds) and shows:
   - **Heading preview** — the organiser's name set to match the logo;
   - **Font in the logo** — the typeface(s) the logo's lettering is set in, as
     best they can be identified;
   - one font picker per part of the name, to swap a font by hand.
3. **Save changes** to put the heading live. **Plain heading** goes back to the
   site's normal heading; **Match heading to logo** / **Read the logo again**
   reads the logo already saved on the page.

Only admins see the box. Video logos can't be read.

## How it works

| Piece | Where |
|---|---|
| Font list, normaliser, CSS, font URL | `utils/organiserHeadingStyle.js` |
| Heading on the page and in the preview | `components/events/OrganiserHeading.jsx` |
| Editor box | `components/events/OrganiserHeadingStyleField.jsx` |
| Logo downsized in the browser (768 px JPEG, under the 256 KB body limit) | `utils/logoForReading.js` |
| `POST /organiser-heading/from-logo` (`requireAdmin`) | `src/routes/organiser-heading.js` |
| The Claude vision call | `src/utils/organiserHeadingReader.js` |
| `event_organisers.heading_style` | `20261118234000_organiser_heading_style.sql` |

The route sends the logo inline to Claude (never stored), which answers under a
JSON schema: the typeface names it sees, and for each run of the name's words
the closest font from `HEADING_FONTS`, whether it is capitals, how widely the
letters are spaced, and any outline colour. The call is recorded in the AI
usage ledger as `organiser_heading_style` and traced like every other Claude
call. It needs `ANTHROPIC_API_KEY` (503 without it).

## Rules

- **The style can't change the words.** `cleanHeadingStyle(style, name)` keeps
  a style only when its segments, in order, spell the organiser's name (letters
  and digits compared, so "Comic & Toy" can't stand in for "Comic and Toy"),
  and the page prints the name's own text. A renamed organiser falls back to
  the plain heading until the logo is read again.
- **Only listed fonts load.** A segment's font is a key of `HEADING_FONTS`; the
  page loads those families from Google Fonts (already in the CSP), subset to
  the characters in the name. To add a font, add it to that list.
- **Colours stay the page's own**, so the heading reads in light and dark mode.
  The only colour carried over is an outline / drop-shadow colour, drawn as a
  small offset shadow.
- The match is to the closest *available* font, not the logo's exact file — a
  logo set in a paid typeface gets its nearest free look-alike.
- The page owner could write the column directly (it is an ordinary profile
  column), but it passes through the same normaliser, so the worst case is a
  different listed font on their own heading.
- The prerendered page for crawlers shows the plain name.
