// Shared vocabulary for the marketplace filter bar and the add-card form.
// One source of truth so what sellers can enter is exactly what buyers can
// filter on — a filter option with no matching form input (or vice versa) is
// how facets silently rot.

// Printed card languages (vault_items.language)
export const CARD_LANGUAGES = [
  'English', 'Japanese', 'Chinese (Simplified)', 'Chinese (Traditional)',
  'Korean', 'German', 'French', 'Italian', 'Spanish', 'Portuguese', 'Other',
];

// Grading companies — mirrors the grading_company Postgres enum ('raw' is the
// ungraded sentinel and deliberately not listed as a grader option).
export const GRADERS = [
  { value: 'psa', label: 'PSA' },
  { value: 'bgs', label: 'Beckett (BGS)' },
  { value: 'cgc', label: 'CGC' },
  { value: 'sgc', label: 'SGC' },
  { value: 'ace', label: 'ACE' },
  { value: 'other', label: 'Other' },
];

// Common numeric grades (vault_items.grade is free text, but the add form's
// grade chips write exactly these values)
export const GRADE_VALUES = ['10', '9.5', '9', '8.5', '8', '7', '6', '5'];

// Raw-card conditions — mirrors the card_condition Postgres enum
export const CONDITIONS = [
  { value: 'mint', label: 'Mint' },
  { value: 'near_mint', label: 'Near Mint' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'light_played', label: 'Light Played' },
  { value: 'played', label: 'Played' },
  { value: 'poor', label: 'Poor' },
];

// Feature flags → how each is stored on vault_items. `column` features filter
// on a boolean column; `variant` features pattern-match the variant taxonomy
// (lib/cardVariants.js strings — never rename those). `context` limits where
// the option appears: 'sports', 'tcg', or undefined for both.
export const FEATURES = [
  { key: 'foil',      label: 'Foil / Holo',       column: 'is_foil' },
  { key: 'auto',      label: 'Autograph',          column: 'is_auto' },
  { key: 'serial',    label: 'Serial numbered',    column: 'serial_number', kind: 'not_null' },
  { key: 'sealed',    label: 'Sealed',             column: 'is_sealed' },
  { key: 'rookie',    label: 'Rookie card',        column: 'is_rookie',     context: 'sports' },
  { key: 'refractor', label: 'Refractor',          column: 'is_refractor',  context: 'sports' },
  { key: 'firstEd',   label: '1st Edition',        variant: '1st Edition',  context: 'tcg' },
  { key: 'fullArt',   label: 'Full / Alt Art',     variantAny: ['Full Art', 'Alt Art'], context: 'tcg' },
  { key: 'promo',     label: 'Promo',              variant: 'Promo',        context: 'tcg' },
  { key: 'shadowless',label: 'Shadowless',         variant: 'Shadowless',   context: 'tcg' },
];

// Rarity options for the TCG rarity facet — cross-game list of the variant
// strings buyers actually hunt (matched against vault_items.variant)
export const TCG_RARITIES = [
  'Holo', 'Reverse Holo', 'Secret Rare', 'Ultra Rare', 'Super Rare',
  'Hyper Rare', 'Illustration Rare', 'Special Illustration Rare',
  'Mythic Rare', 'Ghost Rare', 'Starlight Rare', 'Prismatic Secret Rare',
  "Collector's Rare", 'Gold Rare', 'Serialized',
];

// Quick price buckets (AUD) for the Price chip — custom min/max still available
export const PRICE_PRESETS = [
  { label: 'Under $50', min: '', max: '50' },
  { label: '$50 – $200', min: '50', max: '200' },
  { label: '$200 – $1,000', min: '200', max: '1000' },
  { label: 'Over $1,000', min: '1000', max: '' },
];
