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
