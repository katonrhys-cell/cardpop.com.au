// Every professional grader and grade a card can carry — the ONE list the add-card form,
// the marketplace filters, the server-side vault whitelist and the photo/CardSight readers
// share, so what a seller can enter is exactly what a buyer can filter on.
//
// Dependency-free on purpose (the Express API imports it too). The `value` is what is
// stored in the `grading_company` Postgres enum, so adding a grader means adding it here
// AND in a new `alter type grading_company add value if not exists …` migration — a test
// (tests/frontend/gradeOptions.test.js) fails if the two drift.
//
// The list is eBay's "Professional grader" picker plus ACE, which eBay omits. `legacy`
// marks graders that no longer take new submissions: their slabs still circulate and sell,
// so they stay selectable. Order is the six graders the Grading Hub covers, then the rest.
export const GRADERS = [
  { value: 'psa',        label: 'PSA',          full: 'Professional Sports Authenticator' },
  { value: 'bgs',        label: 'BGS',          full: 'Beckett Grading Services',          match: ['beckett grading', 'beckett'] },
  { value: 'cgc',        label: 'CGC',          full: 'Certified Guaranty Company' },
  { value: 'ace',        label: 'ACE',          full: 'ACE Grading' },
  { value: 'sgc',        label: 'SGC',          full: 'Sportscard Guaranty Corporation' },
  { value: 'tag',        label: 'TAG',          full: 'Technical Authentication & Grading' },
  { value: 'bccg',       label: 'BCCG',         full: 'Beckett Collectors Club Grading',   match: ['beckett collectors club'] },
  { value: 'bvg',        label: 'BVG',          full: 'Beckett Vintage Grading',           match: ['beckett vintage'] },
  { value: 'csg',        label: 'CSG',          full: 'Certified Sports Guaranty',         legacy: true },
  { value: 'ksa',        label: 'KSA',          full: 'K Sportscard Authentication' },
  { value: 'gma',        label: 'GMA',          full: 'Gem Mint Authentication',           legacy: true },
  { value: 'hga',        label: 'HGA',          full: 'Hybrid Grading Approach' },
  { value: 'isa',        label: 'ISA',          full: 'International Sports Authentication' },
  { value: 'gsg',        label: 'GSG',          full: 'Gold Standard Grading' },
  { value: 'pgs',        label: 'PGS',          full: 'Platin Grading Service' },
  { value: 'mnt',        label: 'MNT',          full: 'MNT Grading' },
  { value: 'rare',       label: 'Rare',         full: 'Rare Edition',                      match: ['rare edition'] },
  { value: 'rcg',        label: 'RCG',          full: 'Revolution Card Grading' },
  { value: 'cga',        label: 'CGA',          full: 'Card Grading Australia' },
  { value: 'tcg',        label: 'TCG',          full: 'Trading Card Grading' },
  { value: 'ags',        label: 'AGS',          full: 'Automated Grading Systems' },
  { value: 'dsg',        label: 'DSG',          full: 'Diamond Service Grading' },
  { value: 'majesty',    label: 'Majesty',      full: 'Majesty Grading Company',           match: ['majesty'] },
  { value: 'graad',      label: 'GRAAD',        full: 'GRAAD' },
  { value: 'arena',      label: 'Arena Club',   full: 'Arena Club',                        match: ['arena club', 'arena'] },
  { value: 'aigrading',  label: 'AiGrading',    full: 'AiGrading',                         match: ['aigrading', 'ai grading'] },
  { value: 'other',      label: 'Other',        full: 'Other grading service' },
];

export const GRADER_VALUES = GRADERS.map((g) => g.value);

// `raw` is the ungraded sentinel — valid in the column, never offered as a grader.
export const GRADING_COMPANY_VALUES = ['raw', ...GRADER_VALUES];

export function graderLabel(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'raw') return 'Raw (ungraded)';
  if (v === 'beckett') return 'BGS'; // older rows
  return GRADERS.find((g) => g.value === v)?.label || (value ? String(value).toUpperCase() : '');
}

// The numeric scale, 10 down to 1 in half steps (every grader's own subset sits inside it).
export const NUMERIC_GRADES = Array.from({ length: 19 }, (_, i) => String(10 - i / 2));

// Non-numeric grades graders put on a slab for a card they won't number.
export const SPECIAL_GRADES = [
  'Authentic',
  'Authentic Altered',
  'Authentic - Trimmed',
  'Authentic - Coloured',
  'Sample',
];

export const ALL_GRADES = [...NUMERIC_GRADES, ...SPECIAL_GRADES];

// What a filter bar offers: the numbers a collector actually shops by, then the specials.
export const GRADE_VALUES = ALL_GRADES;

// Free text ("PSA", "Beckett Collectors Club", "BGS 9.5", "AiGrading") → a grader value, or
// null. Longer / more specific names are tried first so "Beckett Vintage" is BVG, not BGS,
// and every match is whole-word so "TAG" never fires inside "vintage" or "tagged".
const MATCHERS = GRADERS.filter((g) => g.value !== 'other')
  .flatMap((g) => [g.value, ...(g.match || [])].map((term) => ({ value: g.value, term })))
  .sort((a, b) => b.term.length - a.term.length)
  .map(({ value, term }) => ({
    value,
    re: new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i'),
  }));

export function graderFromText(text) {
  const s = String(text || '');
  if (!s.trim()) return null;
  return MATCHERS.find((m) => m.re.test(s))?.value || null;
}
