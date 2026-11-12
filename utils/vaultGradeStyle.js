// How a vault card's Condition / Grade chip should look.
//
// A graded card is drawn in the style of the label its company prints on the slab, picked
// from the company and the grade text the owner entered (the vault stores them as free text,
// no label-colour column): PSA's red-framed white label, BGS silver / gold / Black Label,
// CGC black (gold for a Pristine 10), ACE navy (gold 10), SGC's black-and-white tuxedo, TAG's
// black label. The label stock itself comes from `SLAB_LABEL_LOOKS` in
// `data/gradingCompanies.js`, so the estimator and the vault never drift apart.
//
// Raw cards get a plain condition tone: green → amber → red as the card gets more worn.
import { findGradingCompany, SLAB_LABEL_LOOKS } from '@/data/gradingCompanies.js';

// The vault form writes `bgs` for Beckett; older rows may say `beckett`.
const COMPANY_ALIASES = { beckett: 'BGS', bgs: 'BGS', psa: 'PSA', cgc: 'CGC', ace: 'ACE', sgc: 'SGC', tag: 'TAG' };

export function normaliseGradingCompany(value) {
  return COMPANY_ALIASES[String(value || '').trim().toLowerCase()] || null;
}

function gradeNumber(text) {
  const m = String(text || '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Which slab label a card in this company + grade would carry. Returns
 * `{ grader, tier, look }`, or null for an unknown company ("other", raw).
 *
 * Words win over numbers, because the owner can type exactly what the slab says:
 *   BGS  — "Black Label" → black; "Pristine"/"Gold" or 9.5+ → gold; else silver.
 *   CGC  — "Pristine"/"Gold" → gold; every other grade is the black label.
 *   ACE  — "Gold" or a 10 → gold; else navy.
 */
export function vaultSlabStyle(gradingCompany, grade) {
  const key = normaliseGradingCompany(gradingCompany);
  const grader = key && findGradingCompany(key);
  if (!grader) return null;

  const tiers = grader.label?.tiers || {};
  const text = String(grade || '').toLowerCase();
  const n = gradeNumber(text);
  const wantsBlack = /black/.test(text);
  const wantsGold = /pristine|gold|perfect/.test(text);

  let tier = tiers.default;
  if (key === 'BGS') {
    if (wantsBlack) tier = tiers.black;
    else if (wantsGold || (n != null && n >= 9.5)) tier = tiers.gold;
  } else if (key === 'CGC') {
    if (wantsGold) tier = tiers.perfect;
  } else if (key === 'ACE') {
    if (wantsGold || (n != null && n >= 10)) tier = tiers.perfect;
  }

  return { grader, tier, look: SLAB_LABEL_LOOKS[tier] || SLAB_LABEL_LOOKS[tiers.default] };
}

// Raw condition tones. Tailwind classes (light + dark) — status colours, not brand colours.
const TONE = {
  green: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
  teal:  'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800',
  amber: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
  orange: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800',
  red:   'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800',
  grey:  'bg-muted text-muted-foreground border-border',
};

const CONDITION_TONE = {
  mint: 'green',
  near_mint: 'teal',
  excellent: 'amber',
  light_played: 'amber',
  good: 'orange',
  played: 'red',
  poor: 'red',
};

export function conditionToneClass(condition) {
  return TONE[CONDITION_TONE[String(condition || '').toLowerCase()]] || TONE.grey;
}
