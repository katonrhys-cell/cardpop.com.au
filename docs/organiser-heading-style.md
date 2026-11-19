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
   - the logo beside the preview, so the two can be compared by eye;
   - **Lines** — stacked like the logo, or all on one line;
   - per part of the name: a font picker, **Slanted**, and **Logo colours**
     (untick to drop that part's colours and outline).
3. **Save changes** to put the heading live. **Plain heading** goes back to the
   site's normal heading; **Match heading to logo** / **Read the logo again**
   reads the logo already saved on the page.

Only admins see the box. Video logos can't be read.

## How it works

| Piece | Where |
|---|---|
| Font list, normaliser, CSS, font files | `utils/organiserHeadingStyle.js`, `public/fonts/heading/<key>.woff2` |
| Heading on the page and in the preview | `components/events/OrganiserHeading.jsx` |
| Editor box | `components/events/OrganiserHeadingStyleField.jsx` |
| Logo downsized in the browser (768 px JPEG, under the 256 KB body limit) | `utils/logoForReading.js` |
| `POST /organiser-heading/from-logo` (`requireAdmin`) | `src/routes/organiser-heading.js` |
| The Claude vision call | `src/utils/organiserHeadingReader.js` |
| `event_organisers.heading_style` | `20261118234000_organiser_heading_style.sql` |

The route sends the logo inline to Claude (never stored), which answers under a
JSON schema: the typeface names it sees, whether the name is stacked over
several lines, and for each run of the name's words (normally one per line) the
closest font from `HEADING_FONTS`, capitals, letter spacing, relative size,
slant, and its colours — letter fill, thin outline, and offset shadow. The call is recorded in the AI
usage ledger as `organiser_heading_style` and traced like every other Claude
call. It needs `ANTHROPIC_API_KEY` (503 without it).

## Rules

- **The style can't change the words.** `cleanHeadingStyle(style, name)` keeps
  a style only when its segments, in order, spell the organiser's name (letters
  and digits compared, so "Comic & Toy" can't stand in for "Comic and Toy"),
  and the page prints the name's own text. A renamed organiser falls back to
  the plain heading until the logo is read again.
- **Only listed fonts load, from this site.** A segment's font is a key of
  `HEADING_FONTS`, and `OrganiserHeading` loads `/fonts/heading/<key>.woff2`
  through the FontFace API. The first version loaded them from Google Fonts,
  and Safari's Private Browsing blocked that host, so every page showed the
  system font. To add a font, add it to the list and drop its Latin woff2 into
  `public/fonts/heading/` (a test checks every key has a file).
- **Letter colours only with an outline.** White or black letters alone would
  vanish on one of the two themes, so `cleanHeadingStyle()` keeps a `fill`
  only when the segment also has an `outline`; without one the letters take
  the page's text colour. The shadow is drawn as a hard offset shadow.
- `accent` (the first version's shadow colour) is still read as `shadow`.
- The match is to the closest *available* font, not the logo's exact file — a
  logo set in a paid typeface gets its nearest free look-alike.
- The page owner could write the column directly (it is an ordinary profile
  column), but it passes through the same normaliser, so the worst case is a
  different listed font on their own heading.
- The prerendered page for crawlers shows the plain name.
