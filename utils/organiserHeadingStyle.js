// The organiser page heading "in the style of the logo"
// (event_organisers.heading_style). Dependency-free: shared by the page, the
// editor preview and the API route that reads a logo
// (src/utils/organiserHeadingReader.js). docs/organiser-heading-style.md
//
// A style never carries the heading's words. It is a list of segments that
// must spell the organiser's own name, each with a font from the list below,
// so a saved style can only change how the real name looks — never what it
// says — and the only font files a page can load are the ones named here.

/** Fonts the heading can use: key → Google Fonts family + what it looks like. */
export const HEADING_FONTS = Object.freeze({
  'league-gothic': { family: 'League Gothic', fallback: 'sans-serif', look: 'tall, narrow gothic sans capitals' },
  'bebas-neue': { family: 'Bebas Neue', fallback: 'sans-serif', look: 'condensed all-caps sans, a little wider than League Gothic' },
  anton: { family: 'Anton', fallback: 'sans-serif', look: 'heavy condensed impact-style sans' },
  oswald: { family: 'Oswald', fallback: 'sans-serif', weight: 600, look: 'condensed sans with lower case' },
  'barlow-condensed': { family: 'Barlow Condensed', fallback: 'sans-serif', weight: 700, look: 'neat condensed sans, slightly rounded' },
  montserrat: { family: 'Montserrat', fallback: 'sans-serif', weight: 800, look: 'wide geometric sans' },
  poppins: { family: 'Poppins', fallback: 'sans-serif', weight: 700, look: 'round geometric sans' },
  'archivo-black': { family: 'Archivo Black', fallback: 'sans-serif', look: 'very heavy grotesque sans' },
  'russo-one': { family: 'Russo One', fallback: 'sans-serif', look: 'blocky, squared sporty sans' },
  orbitron: { family: 'Orbitron', fallback: 'sans-serif', weight: 800, look: 'futuristic, squared sci-fi letters' },
  'press-start-2p': { family: 'Press Start 2P', fallback: 'monospace', look: 'pixel / 8-bit arcade letters' },
  bangers: { family: 'Bangers', fallback: 'cursive', look: 'slanted comic-book capitals' },
  'luckiest-guy': { family: 'Luckiest Guy', fallback: 'cursive', look: 'fat, bouncy cartoon capitals' },
  bungee: { family: 'Bungee', fallback: 'sans-serif', look: 'chunky signage capitals' },
  righteous: { family: 'Righteous', fallback: 'sans-serif', look: 'rounded retro / art-deco sans' },
  fredoka: { family: 'Fredoka', fallback: 'sans-serif', weight: 700, look: 'soft, fully rounded friendly sans' },
  'permanent-marker': { family: 'Permanent Marker', fallback: 'cursive', look: 'thick felt-marker handwriting' },
  creepster: { family: 'Creepster', fallback: 'cursive', look: 'dripping horror lettering' },
  'black-ops-one': { family: 'Black Ops One', fallback: 'sans-serif', look: 'military stencil' },
  'special-elite': { family: 'Special Elite', fallback: 'monospace', look: 'worn typewriter' },
  rye: { family: 'Rye', fallback: 'serif', look: 'wild-west / saloon slab with spurs' },
  'alfa-slab-one': { family: 'Alfa Slab One', fallback: 'serif', look: 'very heavy slab serif' },
  'roboto-slab': { family: 'Roboto Slab', fallback: 'serif', weight: 700, look: 'plain slab serif' },
  'playfair-display': { family: 'Playfair Display', fallback: 'serif', weight: 800, look: 'high-contrast elegant serif' },
  cinzel: { family: 'Cinzel', fallback: 'serif', weight: 700, look: 'classical Roman inscription capitals' },
  'abril-fatface': { family: 'Abril Fatface', fallback: 'serif', look: 'fat poster didone serif' },
  lobster: { family: 'Lobster', fallback: 'cursive', look: 'bold connected brush script' },
  pacifico: { family: 'Pacifico', fallback: 'cursive', look: 'rounded surf-style script' },
});
export const HEADING_FONT_KEYS = Object.freeze(Object.keys(HEADING_FONTS));

export const HEADING_TRACKING = Object.freeze({ normal: '0', wide: '0.12em', wider: '0.28em' });
export const HEADING_CASES = Object.freeze(['as-typed', 'upper', 'lower']);
export const MAX_HEADING_SEGMENTS = 6;
export const MAX_SOURCE_FONT_CHARS = 80;

const HEX = /^#[0-9a-f]{6}$/i;
const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const letters = (s) => squash(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Split `name` into the pieces the segments name, using the name's own
 * characters. Returns null unless the segments, in order, spell the whole name
 * (compared on letters and digits only, so "Comic & Toy" still can't stand in
 * for "Comic and Toy").
 */
function alignSegments(name, texts) {
  const words = squash(name).split(' ').filter(Boolean);
  const out = [];
  let w = 0;
  for (const text of texts) {
    const want = letters(text);
    if (!want) return null;
    const taken = [];
    let got = '';
    while (w < words.length && got.length < want.length) {
      taken.push(words[w]);
      got += letters(words[w]);
      w += 1;
    }
    if (got !== want) return null;
    out.push(taken.join(' '));
  }
  // Words with no letters (a lone "&" or "-") ride along with the last piece.
  while (w < words.length && !letters(words[w])) { out[out.length - 1] += ` ${words[w]}`; w += 1; }
  return w === words.length && out.length ? out : null;
}

/**
 * The one normaliser. Returns a safe style for `name`, or null when there is
 * none (nothing saved, an unknown shape, or segments that don't spell the
 * name — e.g. the organiser was renamed after the style was saved).
 *
 * { segments: [{ text, font, italic, case, tracking, accent }], source_fonts: [string] }
 */
export function cleanHeadingStyle(raw, name) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.segments)) return null;
  const list = raw.segments.filter((s) => s && typeof s === 'object').slice(0, MAX_HEADING_SEGMENTS);
  const texts = alignSegments(name, list.map((s) => s.text));
  if (!texts) return null;
  const segments = list.map((s, i) => ({
    text: texts[i],
    font: HEADING_FONT_KEYS.includes(s.font) ? s.font : null,
    italic: s.italic === true,
    case: HEADING_CASES.includes(s.case) ? s.case : 'as-typed',
    tracking: s.tracking in HEADING_TRACKING ? s.tracking : 'normal',
    accent: typeof s.accent === 'string' && HEX.test(s.accent.trim()) ? s.accent.trim().toLowerCase() : null,
  }));
  if (!segments.some((s) => s.font)) return null;
  const source_fonts = (Array.isArray(raw.source_fonts) ? raw.source_fonts : [])
    .map((f) => squash(f).replace(/[<>]/g, '').slice(0, MAX_SOURCE_FONT_CHARS))
    .filter(Boolean)
    .slice(0, MAX_HEADING_SEGMENTS);
  return { segments, source_fonts };
}

/** Inline CSS for one segment. Colours stay the page's own so it reads in both themes. */
export function headingSegmentCss(segment) {
  const font = HEADING_FONTS[segment?.font];
  const css = {};
  if (font) {
    css.fontFamily = `'${font.family}', var(--font-heading, ${font.fallback}), ${font.fallback}`;
    css.fontWeight = font.weight || 400;
  }
  if (segment?.italic) css.fontStyle = 'italic';
  if (segment?.case === 'upper') css.textTransform = 'uppercase';
  if (segment?.case === 'lower') css.textTransform = 'lowercase';
  const tracking = HEADING_TRACKING[segment?.tracking];
  // The negative margin takes back the gap letter-spacing leaves after the last letter.
  if (tracking && tracking !== '0') { css.letterSpacing = tracking; css.marginRight = `-${tracking}`; }
  // The logo's outline / drop-shadow colour, as a hard offset shadow.
  if (segment?.accent) css.textShadow = `0.045em 0.045em 0 ${segment.accent}`;
  return css;
}

/**
 * The Google Fonts stylesheet for a style, subset to the heading's own
 * characters (`text=`) so it is a few kilobytes. null when no font is needed.
 */
export function headingFontsHref(style) {
  const keys = [...new Set((style?.segments || []).map((s) => s.font).filter((k) => HEADING_FONTS[k]))];
  if (!keys.length) return null;
  const chars = [...new Set((style.segments.map((s) => s.text).join('') + ' ')
    .split('').flatMap((c) => [c, c.toUpperCase(), c.toLowerCase()]))].sort().join('');
  const families = keys.map((k) => {
    const { family, weight } = HEADING_FONTS[k];
    return `family=${family.replace(/ /g, '+')}${weight ? `:wght@${weight}` : ''}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap&text=${encodeURIComponent(chars)}`;
}
