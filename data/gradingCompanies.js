// The grading companies the estimator (and the rest of the Grading Hub) talks about,
// with each company's own branding — the one place the page reads a colour or a logo from.
//
// Logos are the companies' OFFICIAL files, dropped in `public/images/grading/<key>.svg`
// exactly as published (see the README in that folder for where each comes from). Nothing
// here redraws a mark: when the file is missing the UI falls back to a plain wordmark in
// the brand colour. `logoDark` is optional — a second file for dark backgrounds where the
// company publishes one (SGC's white logo, for instance).
//
// `brand.primary` is the colour the wordmark/tint/border are built from and should be the
// exact hex sampled from the official logo file. `brand.onDark` is the ink used for the
// fallback wordmark in dark mode (near-black marks need a light ink there). `verified`
// says whether the hex has been checked against the company's own asset — a `false` entry
// is the best available reference and must be confirmed from the SVG before it is relied on.
export const GRADING_COMPANIES = [
  {
    key: 'PSA',
    name: 'PSA',
    full: 'Professional Sports Authenticator',
    website: 'https://www.psacard.com',
    logo: '/images/grading/psa.png',
    brand: {
      primary: '#0350A1',
      accent: '#E72332',
      onDark: '#6FA3E8',
      verified: true,
      source: 'Sampled from the PSA logo (blue P/A, red S) supplied for the site, 2026-11-04.',
    },
    // PSA's label: a red frame around white stock, black card details top-left, the grade
    // word above the number at the right ("MINT / 9"), the PSA mark along the bottom. One
    // look for every grade.
    label: { tiers: { default: 'psa' } },
  },
  {
    key: 'BGS',
    name: 'BGS',
    full: 'Beckett Grading Services',
    website: 'https://www.beckett.com/grading',
    logo: '/images/grading/bgs.png',
    logoDark: '/images/grading/bgs-white.png',
    wordmark: 'BECKETT',
    logoScale: 1.8, // the laurel crest is near-square, so it needs more height than a wordmark to read
    brand: {
      primary: '#000000',
      onDark: '#FFFFFF',
      verified: true,
      source: "Beckett's 2025 heritage identity: the laurel-wreath B and BECKETT wordmark in white on black (black on light stock).",
    },
    // Beckett's 2025 label: the laurel B + BECKETT block on the left, the four sub-grades
    // in a row, the grade printed straight onto the stock on the right. Silver below 9.5,
    // gold for 9.5 and 10, and the Black Label (gold grade on black) for a 10 with four 10s.
    label: { tiers: { default: 'silver', gold: 'gold', black: 'bgsBlack' }, showSubGrades: true },
  },
  {
    key: 'CGC',
    name: 'CGC',
    full: 'Certified Guaranty Company',
    website: 'https://www.cgccards.com',
    logo: '/images/grading/cgc.png',
    brand: {
      primary: '#BF3B2F',
      onDark: '#E8584A',
      verified: true,
      source: 'Sampled from the CGC scales-and-wordmark logo supplied for the site, 2026-11-04.',
    },
    // CGC Cards: black label with white text and the grade boxed on the right; a Pristine
    // 10 is the gold label. Approximation — check against a slab before relying on it.
    label: { tiers: { default: 'black', perfect: 'gold' } },
  },
  {
    key: 'ACE',
    name: 'ACE',
    full: 'ACE Grading',
    website: 'https://www.acegrading.com',
    logo: '/images/grading/ace.svg',
    brand: {
      primary: '#C5A66C',
      secondary: '#090F1B',
      onDark: '#CBAA6D',
      verified: true,
      source: 'Sampled from acegrading.com (gold shield mark on the navy site, navy Standard label with gold Gem Mint panel), 2026-11-04.',
    },
    // ACE's Standard label: navy, white card name with the set line in gold, and the grade
    // on an angled panel at the right — "a classic look, with a gold highlight for Gem Mint
    // 10s" (acegrading.com); the panel is light stock below a 10.
    label: { tiers: { default: 'ace', perfect: 'aceGold' } },
  },
  {
    key: 'SGC',
    name: 'SGC',
    full: 'Sportscard Guaranty Corporation',
    website: 'https://www.gosgc.com',
    logo: '/images/grading/sgc.svg',
    logoDark: '/images/grading/sgc-white.svg',
    brand: {
      primary: '#000000',
      onDark: '#FFFFFF',
      accent: '#C9A227',
      verified: false,
      source: 'SGC identity is black with gold (and a purple heritage colour) per its brand agency; gold hex is a reference value — confirm from the official SVG.',
    },
    // SGC's "tuxedo" label: black, white text, the grade large on the right.
    label: { tiers: { default: 'black' } },
  },
  {
    key: 'TAG',
    name: 'TAG',
    full: 'TAG Grading',
    website: 'https://taggrading.com',
    logo: '/images/grading/tag.png',
    logoDark: '/images/grading/tag-white.png',
    brand: {
      primary: '#0A0A0A',
      onDark: '#FFFFFF',
      verified: true,
      source: 'TAG is a black-and-white identity: the boxed serif TAG mark, white on black, from the artwork supplied 2026-11-04.',
    },
    // TAG's label: black with a thin white inset frame, the boxed TAG mark centred at the
    // top breaking the frame line, card details left, the grade at the right with its word
    // beneath — all white on black, every grade. From slab photos supplied 2026-11-04.
    label: { tiers: { default: 'tag' } },
  },
];

export const GRADING_COMPANY_KEYS = GRADING_COMPANIES.map((g) => g.key);

export function findGradingCompany(key) {
  const k = String(key || '').toUpperCase();
  return GRADING_COMPANIES.find((g) => g.key === k) || null;
}

const HEX = /^#([0-9a-f]{6})$/i;

// Append an alpha byte to a 6-digit hex (`#RRGGBB` + `AA`), so a tint or a border can be
// derived from the one brand colour without a second palette entry.
export function withAlpha(hex, alpha) {
  if (!HEX.test(hex || '')) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

// CSS custom properties a grader-themed element reads (`text-[var(--grader-ink)]`,
// `bg-[var(--grader-tint)]`, `border-[var(--grader-border)]`…). Inline so the hex stays in
// data, not in a Tailwind class Tailwind would have to see at build time.
export function graderStyle(grader) {
  const primary = grader?.brand?.primary || '#1F2937';
  const onDark = grader?.brand?.onDark || primary;
  return {
    '--grader-ink': primary,
    '--grader-ink-dark': onDark,
    '--grader-tint': withAlpha(primary, 0.08),
    '--grader-tint-dark': withAlpha(onDark, 0.14),
    '--grader-border': withAlpha(primary, 0.3),
    '--grader-border-dark': withAlpha(onDark, 0.35),
  };
}

// ─── Slab label looks ─────────────────────────────────────────────────────────
// The "top of the slab" each company prints: background, ink, muted ink, the grade box and
// (where the company prints one) a band above the body that carries the mark. Colours are
// label stock, not brand colours — a silver BGS label is silver whatever Beckett's logo is.
const GOLD = 'linear-gradient(180deg, #D9C99A 0%, #AEA07E 55%, #8E7F5C 100%)';
const SILVER = 'linear-gradient(180deg, #E8E8EB 0%, #CCCCD0 55%, #B0B0B4 100%)';

// `band` is a rule printed above the body and `frame` a border around the whole label;
// `box` is the grade panel on the right — `bg: 'transparent'` prints the grade straight onto
// the stock the way Beckett does, `slant` cuts its left edge on the diagonal the way ACE
// does, `wordAbove` puts the grade word over the number the way PSA does. `logoAt` moves
// the mark to a row under the details (`bottom`, PSA) or centred on the top edge of the
// `inset` frame (`top`, TAG).
export const SLAB_LABEL_LOOKS = {
  // PSA: a red frame around a white label, the card details top-left, the grade word
  // above the number at the right, the PSA mark along the bottom.
  psa: {
    frame: '#E72332',
    bg: '#FFFFFF', fg: '#111111', muted: '#555555',
    box: { bg: 'transparent', fg: '#111111', border: 'transparent', wordAbove: true, align: 'end' },
    logoAt: 'bottom',
    dark: false,
  },
  silver: {
    bg: SILVER, fg: '#202023', muted: '#4A4A4E',
    box: { bg: 'transparent', fg: '#202023', border: '#9A9A9E' },
    dark: false,
  },
  gold: {
    bg: GOLD, fg: '#1B1712', muted: '#3F3522',
    box: { bg: 'transparent', fg: '#1B1712', border: '#7A6B48' },
    dark: false,
  },
  bgsBlack: {
    bg: '#0B0B0B', fg: '#FFFFFF', muted: '#B5B5B5',
    box: { bg: 'transparent', fg: '#C8B573', border: '#2A2A2A' },
    dark: true,
  },
  black: {
    bg: '#0B0B0B', fg: '#FFFFFF', muted: '#B5B5B5',
    box: { bg: '#FFFFFF', fg: '#0B0B0B', border: '#0B0B0B' },
    dark: true,
  },
  ace: {
    bg: '#090F1B', fg: '#FFFFFF', muted: '#C5A66C',
    box: { bg: '#D9DADC', fg: '#090F1B', border: '#090F1B', slant: true },
    dark: true,
  },
  aceGold: {
    bg: '#090F1B', fg: '#FFFFFF', muted: '#C5A66C',
    box: { bg: '#CBAA6D', fg: '#090F1B', border: '#090F1B', slant: true },
    dark: true,
  },
  // TAG: black, a thin white inset frame, the mark centred on the frame's top edge.
  tag: {
    bg: '#0A0A0A', fg: '#FFFFFF', muted: '#CFCFCF',
    box: { bg: 'transparent', fg: '#FFFFFF', border: 'transparent', align: 'end' },
    inset: '#FFFFFF',
    logoAt: 'top',
    dark: true,
  },
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Which label a company would print for this estimate: `black` for a BGS 10 with four 10
// sub-grades, `gold` for a BGS 9.5+, `perfect` for a 10 elsewhere, else the default.
export function slabLabelTier(grader, { estimate, subGrades } = {}) {
  const tiers = grader?.label?.tiers || { default: 'black' };
  const g = num(estimate);
  if (g != null) {
    const subs = subGrades ? Object.values(subGrades).map(num) : [];
    if (tiers.black && g >= 10 && subs.length >= 4 && subs.every((v) => v != null && v >= 10)) return tiers.black;
    if (tiers.gold && g >= 9.5) return tiers.gold;
    if (tiers.perfect && g >= 10) return tiers.perfect;
  }
  return tiers.default;
}

export function slabLabelLook(grader, result) {
  return SLAB_LABEL_LOOKS[slabLabelTier(grader, result)] || SLAB_LABEL_LOOKS.black;
}
