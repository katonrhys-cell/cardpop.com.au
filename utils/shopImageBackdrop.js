// Which shop photos were shot on a solid black studio background.
//
// A grid card shows the whole photo (object-contain) inside a 4:5 tile, so a
// square photo leaves a strip of the tile's own pale background above and
// below it. For a black studio shot that reads as a black square floating in
// a white card; the tile should be black too, so the photo's background runs
// edge to edge.
//
// The Acryshield studio renders are numbered (`etb-blue-1.jpg`,
// `booster-box-2.jpg`, `single-card-case-1.jpg`); the same folder's unnumbered
// files (`etb.jpg`, `stackable/stackable-base.jpg`) are light-grey lifestyle
// shots and keep the normal tile.

const DARK_BACKDROP_PATTERNS = [
  /\/images\/shop\/acryshield\/(?:[^/?#]+\/)*[^/?#]+-\d+\.(?:jpe?g|png|webp)(?:[?#]|$)/i,
];

/** True when the photo at `url` has a solid black background. */
export function hasDarkBackdrop(url) {
  if (typeof url !== 'string' || !url) return false;
  return DARK_BACKDROP_PATTERNS.some((re) => re.test(url));
}
