export const VARIANT_GROUPS = [
  {
    label: 'Finish',
    variants: ['Base', 'Holo', 'Reverse Holo', 'Refractor', 'Chrome', 'Prizm', 'Parallel', 'Rainbow', 'Gold', 'Silver', 'Foil'],
  },
  {
    label: 'Attributes',
    variants: ['Rookie Card (RC)', 'Auto', 'Patch', 'Relic / Jersey', 'Numbered', 'Short Print (SP)'],
  },
  {
    label: 'Art Style',
    variants: ['Full Art', 'Alt Art', 'Extended Art', 'Showcase', 'Borderless'],
  },
  {
    label: 'Edition',
    variants: ['1st Edition', 'Shadowless', 'Promo', 'Error / Misprint'],
  },
];

export const CARD_VARIANTS = VARIANT_GROUPS.flatMap(g => g.variants);

// Variants that render a special overlay badge on card images
export const VARIANT_BADGES = {
  'Rookie Card (RC)': { label: 'RC',     bg: 'bg-amber-400',  text: 'text-amber-900' },
  'Auto':             { label: 'AUTO',   bg: 'bg-blue-500',   text: 'text-white' },
  '1st Edition':      { label: '1st Ed', bg: 'bg-violet-600', text: 'text-white' },
};
