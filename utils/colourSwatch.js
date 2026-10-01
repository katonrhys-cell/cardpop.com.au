/**
 * Swatch colours for shop colour names.
 *
 * `colour_hex` on a product/variant row wins when set; otherwise the colour
 * NAME is looked up here so every chip gets a dot even when the row was
 * imported without a hex. Values are display-only approximations of the
 * Palms Off Gaming render colours — they tint a dot, nothing more.
 */
export const COLOUR_HEX = {
  black: '#1B1B1D',
  white: '#FFFFFF',
  grey: '#8A8D91',
  gray: '#8A8D91',
  silver: '#C0C3C7',
  navy: '#1E2A4A',
  blue: '#2E6FD9',
  turquoise: '#2FB3AE',
  jade: '#00A86B',
  green: '#2E8B3E',
  yellow: '#E8B93B',
  orange: '#EE7A1F',
  red: '#C8202F',
  rose: '#E8A2B0',
  pink: '#E56BA3',
  purple: '#7A4FB5',
};

// "Clear" has no colour of its own — draw it as a translucent checkerboard so
// it reads as see-through rather than as a missing dot.
const CLEAR_BACKGROUND = {
  backgroundColor: 'rgba(255,255,255,0.35)',
  backgroundImage:
    'linear-gradient(45deg, rgba(0,0,0,0.18) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.18) 75%),'
    + 'linear-gradient(45deg, rgba(0,0,0,0.18) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.18) 75%)',
  backgroundSize: '6px 6px',
  backgroundPosition: '0 0, 3px 3px',
};

const norm = (name) => String(name || '').trim().toLowerCase();

const isClear = (name) => ['clear', 'transparent'].includes(norm(name));

/** Hex for a colour: the row's own hex, else the name's palette entry, else null. */
export function colourHex(name, hex) {
  const own = String(hex || '').trim();
  if (own) return own;
  return COLOUR_HEX[norm(name)] || null;
}

/** Inline style for a swatch dot, or null when the colour is unknown. */
export function swatchStyle(name, hex) {
  if (!String(hex || '').trim() && isClear(name)) return CLEAR_BACKGROUND;
  const resolved = colourHex(name, hex);
  return resolved ? { backgroundColor: resolved } : null;
}
