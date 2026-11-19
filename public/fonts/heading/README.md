# Organiser heading fonts

The Latin subset of each font in `HEADING_FONTS` (`utils/organiserHeadingStyle.js`),
one `<key>.woff2` per font, downloaded from Google Fonts and served from this site so
the organiser heading never depends on a third-party font host. Every font here is
licensed under the SIL Open Font License 1.1 (Roboto Slab: Apache License 2.0), which
permits self-hosting and redistribution. Adding a font = add it to `HEADING_FONTS` and
drop its Latin woff2 here under the same key (a test checks each key has a file).
