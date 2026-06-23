// Shared human-readable labels for the structured card-attribute detail fields
// captured on the Add/Edit Card page (Autograph, Patch, Relic, Numbering,
// Short Print). Keep these maps in sync with the option lists in
// pages/AddEditCardPage.jsx so every display surface renders the same wording.

export const AUTO_TYPE_LABELS = {
  on_card:     'On-Card',
  sticker:     'Sticker',
  cut:         'Cut Signature',
  relic_patch: 'Relic & Patch',
  in_person:   'In-Person / TTM',
  redemption:  'Redemption',
  book:        'Book Card',
};

// Index 0 unused — count is 1-based (1 = Solo … 4 = Quad)
export const SIGNER_LABELS = [null, 'Solo', 'Dual', 'Triple', 'Quad'];

export const PATCH_TYPE_LABELS = {
  game_used:    'Game-Used',
  player_worn:  'Player-Worn',
  event_worn:   'Event-Worn',
  rookie_patch: 'Rookie Patch Auto (RPA)',
  prime:        'Prime / Multi-Colour',
  laundry_tag:  'Laundry Tag',
  nameplate:    'Nameplate Letter',
  manufactured: 'Manufactured',
};

export const PIECE_LABELS = [null, 'Single', 'Dual', 'Triple', 'Quad'];

export const RELIC_MATERIAL_LABELS = {
  jersey:  'Jersey / Swatch',
  bat:     'Bat',
  ball:    'Ball',
  glove:   'Glove',
  cleat:   'Cleat / Shoe',
  base:    'Base',
  cap:     'Cap / Hat',
  pylon:   'Pylon',
  net:     'Net',
  stadium: 'Stadium / Seat',
  dirt:    'Dirt / Soil',
  other:   'Other',
};

export const RELIC_SOURCE_LABELS = {
  game_used:    'Game-Used',
  player_worn:  'Player-Worn',
  event_used:   'Event-Used',
  manufactured: 'Manufactured',
};

export const SP_VARIATION_LABELS = {
  photo:       'Photo Variation',
  image:       'Image Variation',
  jersey:      'Jersey / Colour',
  throwback:   'Throwback',
  celebration: 'Celebration',
  nickname:    'Nickname / Name',
  logo:        'Logo / Mascot',
  sp_base:     'Short-Printed Base',
  other:       'Other',
};

export const SP_TIER_LABELS = {
  sp:    'SP',
  ssp:   'SSP',
  ultra: 'Ultra / Case Hit',
};

export const ROOKIE_TYPE_LABELS = {
  true_rc:       'True RC',
  rc_logo:       'RC Logo Card',
  first_bowman:  '1st Bowman / Prospect',
  pre_rookie:    'Pre-Rookie (PRC)',
  xrc:           'Extended RC (XRC)',
  rpa:           'Rookie Patch Auto (RPA)',
  rated_rookie:  'Rated Rookie',
  rookie_ticket: 'Rookie Ticket',
  other:         'Other Rookie',
};

export const REFRACTOR_TYPE_LABELS = {
  base:         'Base Refractor',
  xfractor:     'X-Fractor',
  atomic:       'Atomic Refractor',
  prism:        'Prism Refractor',
  pulsar:       'Pulsar Refractor',
  mojo:         'Mojo Refractor',
  wave:         'Wave Refractor',
  mini_diamond: 'Mini-Diamond Refractor',
  speckle:      'Speckle Refractor',
  shimmer:      'Shimmer Refractor',
  raywave:      'RayWave Refractor',
  negative:     'Negative Refractor',
  sepia:        'Sepia Refractor',
  superfractor: 'Superfractor (1/1)',
  other:        'Other Refractor',
};

export const REFRACTOR_COLOR_LABELS = {
  standard: 'Standard',
  green:    'Green',
  purple:   'Purple',
  blue:     'Blue',
  aqua:     'Aqua',
  pink:     'Pink',
  yellow:   'Yellow',
  gold:     'Gold',
  orange:   'Orange',
  black:    'Black',
  red:      'Red',
};

// ─── Compact, single-string summaries ───────────────────────────────────────

/** e.g. "Dual On-Card Auto" — falls back to "Auto" when no detail is set. */
export const formatAutograph = (item) => {
  if (!item?.is_auto) return null;
  return [
    item.auto_signers > 1 ? SIGNER_LABELS[item.auto_signers] : null,
    AUTO_TYPE_LABELS[item.auto_type] ?? null,
    'Auto',
  ].filter(Boolean).join(' ');
};

/** e.g. "Dual Game-Used Patch" */
export const formatPatch = (item) => {
  const parts = [
    item?.patch_pieces > 1 ? PIECE_LABELS[item.patch_pieces] : null,
    PATCH_TYPE_LABELS[item?.patch_type] ?? null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' ')} Patch` : null;
};

/** e.g. "Game-Used Jersey / Swatch" */
export const formatRelic = (item) => {
  const parts = [
    RELIC_SOURCE_LABELS[item?.relic_source] ?? null,
    RELIC_MATERIAL_LABELS[item?.relic_material] ?? null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' ')} Relic` : null;
};

/** e.g. "SSP — Photo Variation" */
export const formatShortPrint = (item) => {
  const tier = SP_TIER_LABELS[item?.sp_tier] ?? null;
  const variation = SP_VARIATION_LABELS[item?.sp_variation] ?? null;
  if (tier && variation) return `${tier} — ${variation}`;
  return tier || variation || null;
};

// Only returns a value when a specific rookie designation is recorded — the
// plain "is a rookie" case is already covered by the Attributes badges.
/** e.g. "True RC" or "Rookie Patch Auto (RPA) · RC logo" */
export const formatRookie = (item) => {
  const type = ROOKIE_TYPE_LABELS[item?.rookie_type];
  if (!type) return null;
  return item?.rookie_logo === 'yes' ? `${type} · RC logo` : type;
};

// Only returns a value when a specific refractor type/colour is recorded — the
// plain "is a refractor" case is already covered by the Finish badges.
/** e.g. "Gold Refractor", "X-Fractor" or "Superfractor (1/1)" */
export const formatRefractor = (item) => {
  const type = REFRACTOR_TYPE_LABELS[item?.refractor_type];
  const color = REFRACTOR_COLOR_LABELS[item?.refractor_color];
  // "Base Refractor" + a colour reads better as e.g. "Gold Refractor"
  if (color && color !== 'Standard') {
    if (item?.refractor_type === 'base' || !type) return `${color} Refractor`;
    return `${color} ${type}`;
  }
  return type || null;
};

// Short badge label for a refractor card. Returns the most specific wording
// available — e.g. "Gold Refractor", "Superfractor (1/1)" or "X-Fractor" — and
// falls back to a plain "Refractor" when only the finish is recorded. Returns
// null when the item is not a refractor at all. Accepts either snake_case DB
// rows or camelCase shop products, with `variant` as a string or array.
export const getRefractorLabel = (item) => {
  if (!item) return null;
  const variants = typeof item.variant === 'string'
    ? item.variant.split(',').map(s => s.trim())
    : Array.isArray(item.variant) ? item.variant
    : Array.isArray(item.cardVariants) ? item.cardVariants
    : (typeof item.cardVariant === 'string' ? item.cardVariant.split(',').map(s => s.trim()) : []);
  const isRefractor = !!item.is_refractor || !!item.isRefractor
    || variants.includes('Refractor')
    || !!item.refractor_type || !!item.refractor_color;
  if (!isRefractor) return null;
  return formatRefractor(item) || 'Refractor';
};

// Tailwind utility cluster (border + background + text colour) for a refractor
// badge, keyed off its colour parallel. Premium colours get a solid fill so
// they stand out; the rest get a subtle colour-matched tint. Strings are
// static literals so Tailwind's JIT picks them up.
const REFRACTOR_BADGE_CLASSES = {
  gold:   'border-amber-500 bg-amber-400 text-black shadow-sm',
  red:    'border-red-600 bg-red-500 text-white shadow-sm',
  orange: 'border-orange-600 bg-orange-500 text-white shadow-sm',
  black:  'border-neutral-600 bg-neutral-900 text-white shadow-sm',
  green:  'border-green-500/60 bg-green-400/15 text-green-700 dark:text-green-300',
  blue:   'border-blue-500/60 bg-blue-400/15 text-blue-700 dark:text-blue-300',
  purple: 'border-purple-500/60 bg-purple-400/15 text-purple-700 dark:text-purple-300',
  aqua:   'border-cyan-500/60 bg-cyan-400/15 text-cyan-700 dark:text-cyan-300',
  pink:   'border-pink-500/60 bg-pink-400/15 text-pink-700 dark:text-pink-300',
  yellow: 'border-yellow-500/60 bg-yellow-300/30 text-yellow-800 dark:text-yellow-300',
};

const REFRACTOR_BADGE_DEFAULT = 'border-indigo-400/50 bg-indigo-400/10 text-indigo-700 dark:text-indigo-300';

/**
 * Styling classes for a refractor badge. Superfractors (1/1) get a gold
 * gradient, colour parallels get their matching style, and everything else
 * falls back to the standard indigo refractor look.
 */
export const getRefractorBadgeClass = (item) => {
  if (item?.refractor_type === 'superfractor') {
    return 'border-amber-500 bg-gradient-to-r from-yellow-300 to-amber-500 text-black shadow-sm';
  }
  return REFRACTOR_BADGE_CLASSES[item?.refractor_color] || REFRACTOR_BADGE_DEFAULT;
};

/** e.g. "One-of-One (1/1)" or "99 copies" */
export const formatPrintRun = (item) => {
  const run = item?.serial_print_run;
  if (!run) return null;
  if (run === 1) return 'One-of-One (1/1)';
  return `${run} copies`;
};

/**
 * Build an ordered list of { label, value } rows for the structured attribute
 * details present on a vault item. Used by the listing detail page.
 */
export const getCardAttributeRows = (item) => {
  if (!item) return [];
  const rows = [];
  const rookie = formatRookie(item);
  if (rookie) rows.push({ label: 'Rookie', value: rookie });
  const refractor = formatRefractor(item);
  if (refractor) rows.push({ label: 'Refractor', value: refractor });
  const auto = formatAutograph(item);
  if (auto) rows.push({ label: 'Autograph', value: auto });
  const patch = formatPatch(item);
  if (patch) rows.push({ label: 'Patch', value: patch });
  const relic = formatRelic(item);
  if (relic) rows.push({ label: 'Relic', value: relic });
  const printRun = formatPrintRun(item);
  if (printRun) rows.push({ label: 'Print Run', value: printRun });
  const sp = formatShortPrint(item);
  if (sp) rows.push({ label: 'Short Print', value: sp });
  return rows;
};
