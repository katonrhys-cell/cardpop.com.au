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
