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
    logo: '/images/grading/psa.svg',
    brand: {
      primary: '#E4002B',
      onDark: '#FF4D63',
      verified: false,
      source: 'PSA red (the wordmark/red label). Brand guide: psacard.com/logo — take the hex from the official SVG.',
    },
    // PSA's label: red band carrying the PSA mark, white body with black card details and
    // the grade large on the right ("NM-MT 8"). One look for every grade.
    label: { tiers: { default: 'psa' } },
  },
  {
    key: 'BGS',
    name: 'BGS',
    full: 'Beckett Grading Services',
    website: 'https://www.beckett.com/grading',
    logo: '/images/grading/bgs.svg',
    brand: {
      primary: '#0C69A2',
      onDark: '#4FA3DC',
      verified: false,
      source: 'Beckett blue as listed by Brandfetch for beckett.com (unclaimed listing) — confirm from the official SVG.',
    },
    // BGS labels are tiered by grade: silver below 9.5, gold for 9.5 and 10, and the Black
    // Label for a 10 with four 10 sub-grades; the four sub-grades print down the label.
    label: { tiers: { default: 'silver', gold: 'gold', black: 'black' }, showSubGrades: true },
  },
  {
    key: 'CGC',
    name: 'CGC',
    full: 'Certified Guaranty Company',
    website: 'https://www.cgccards.com',
    logo: '/images/grading/cgc.svg',
    brand: {
      primary: '#BF0A19',
      onDark: '#F0414F',
      verified: false,
      source: 'CGC red (CGC describes its own logo as red; hex from Brandfetch for cgccomics.com) — confirm from the official SVG.',
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
      primary: '#1F2937',
      onDark: '#E5E7EB',
      verified: false,
      source: 'Not yet sourced — neutral placeholder until the hex is sampled from the official SVG.',
    },
    // ACE: dark label, grade boxed on the right, gold for a 10. Approximation — ACE's
    // artwork wasn't reachable when this was written; check against a slab.
    label: { tiers: { default: 'black', perfect: 'gold' } },
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
    logo: '/images/grading/tag.svg',
    brand: {
      primary: '#1F2937',
      onDark: '#E5E7EB',
      verified: false,
      source: 'Not yet sourced — neutral placeholder until the hex is sampled from the official SVG.',
    },
    // TAG: white label with a dark band and the grade boxed; a 10 flips to the black
    // label. Approximation — check against a slab.
    label: { tiers: { default: 'tag', perfect: 'black' } },
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
const GOLD = 'linear-gradient(180deg, #f7e2a0 0%, #d9b24a 55%, #b8921f 100%)';
const SILVER = 'linear-gradient(180deg, #f4f4f4 0%, #d2d2d2 55%, #b3b3b3 100%)';

export const SLAB_LABEL_LOOKS = {
  psa: {
    band: { bg: '#E4002B', fg: '#FFFFFF' },
    bg: '#FFFFFF', fg: '#111111', muted: '#555555',
    box: { bg: '#FFFFFF', fg: '#111111', border: '#D9D9D9' },
    dark: false,
  },
  silver: {
    bg: SILVER, fg: '#111111', muted: '#3F3F3F',
    box: { bg: '#FFFFFF', fg: '#111111', border: '#9A9A9A' },
    dark: false,
  },
  gold: {
    bg: GOLD, fg: '#1F1700', muted: '#4A3A08',
    box: { bg: '#FFF8DC', fg: '#1F1700', border: '#9C7A18' },
    dark: false,
  },
  black: {
    bg: '#0B0B0B', fg: '#FFFFFF', muted: '#B5B5B5',
    box: { bg: '#FFFFFF', fg: '#0B0B0B', border: '#0B0B0B' },
    dark: true,
  },
  tag: {
    band: { bg: '#0F172A', fg: '#FFFFFF' },
    bg: '#FFFFFF', fg: '#111111', muted: '#555555',
    box: { bg: '#0F172A', fg: '#FFFFFF', border: '#0F172A' },
    dark: false,
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
