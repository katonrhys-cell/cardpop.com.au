// Extra ticket prices on an event (events.ticket_prices), on top of the
// general-admission entry fee and presale price. Dependency-free so the event
// form, the event page, lib/eventSeo.js and api/prerender.js all read the same
// shapes and labels.
//
// Stored shape: [{ type, price_aud, group_size?, label?, sold_out?, waitlist_url? }]
// — `group_size` only on `group` rows (how many people the price covers).
// `custom` rows carry an organiser-typed `label` ("Player Entry", "Spectator
// Pass" …) for a ticket type the fixed list doesn't cover, and may be marked
// `sold_out` with an optional `waitlist_url`. Every type but `group` and
// `custom` appears at most once; group rows are ordered by size, custom rows
// keep the order the organiser gave them.

export const TICKET_PRICE_TYPES = [
  { type: 'child',    label: 'Child' },
  { type: 'vip',      label: 'VIP' },
  { type: 'ga_early', label: 'GA Early Access' },
  { type: 'ga_late',  label: 'GA Late Access' },
  { type: 'group',    label: 'Group' },
];

// Organiser-named ticket types (free text) — not part of the tick-list above.
export const CUSTOM_TICKET_TYPE = 'custom';
export const MAX_CUSTOM_TICKETS = 10;
export const MAX_CUSTOM_LABEL = 80;

const LABELS = Object.fromEntries(TICKET_PRICE_TYPES.map(t => [t.type, t.label]));
const ORDER = { ...Object.fromEntries(TICKET_PRICE_TYPES.map((t, i) => [t.type, i])), [CUSTOM_TICKET_TYPE]: TICKET_PRICE_TYPES.length };

const toLabel = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_LABEL) : '');
// http(s) only — the link is rendered as an href.
const toWaitlistUrl = (v) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
};

export const MAX_GROUP_PRICES = 10;
export const MAX_GROUP_SIZE = 1000;

const toPrice = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

const toGroupSize = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 2 && n <= MAX_GROUP_SIZE ? n : null;
};

/**
 * Normalise whatever the form or the DB holds into the stored shape: unknown
 * types, rows without a valid price (and group rows without a valid size)
 * are dropped, duplicates keep the first, and the result is in display order.
 */
export const cleanTicketPrices = (rows) => {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const type = row?.type;
    if (type !== CUSTOM_TICKET_TYPE && !LABELS[type]) continue;
    const price_aud = toPrice(row.price_aud);
    if (price_aud === null) continue;
    if (type === CUSTOM_TICKET_TYPE) {
      const label = toLabel(row.label);
      const key = `custom:${label.toLowerCase()}`;
      if (!label || seen.has(key)) continue;
      if (out.filter(r => r.type === CUSTOM_TICKET_TYPE).length >= MAX_CUSTOM_TICKETS) continue;
      seen.add(key);
      const waitlist_url = toWaitlistUrl(row.waitlist_url);
      const sold_out = row.sold_out === true;
      out.push({ type, label, price_aud, ...(sold_out ? { sold_out } : {}), ...(sold_out && waitlist_url ? { waitlist_url } : {}) });
    } else if (type === 'group') {
      const group_size = toGroupSize(row.group_size);
      if (group_size === null || seen.has(`group:${group_size}`)) continue;
      if (out.filter(r => r.type === 'group').length >= MAX_GROUP_PRICES) continue;
      seen.add(`group:${group_size}`);
      out.push({ type, price_aud, group_size });
    } else {
      if (seen.has(type)) continue;
      seen.add(type);
      out.push({ type, price_aud });
    }
  }
  return out.sort((a, b) => (ORDER[a.type] - ORDER[b.type]) || ((a.group_size || 0) - (b.group_size || 0)));
};

// "Child", "VIP", "Group of 4" …
export const ticketPriceLabel = (row) => (row.type === CUSTOM_TICKET_TYPE ? row.label : row.type === 'group' ? `Group of ${row.group_size}` : LABELS[row.type] || 'Ticket');

const money = (n) => (n === 0 ? 'Free' : `$${n.toFixed(2)}`);

// [{ label, price, soldOut, waitlistUrl }] ready to render, e.g.
// { label: 'Group of 4', price: '$40.00', soldOut: false, waitlistUrl: null }.
export const ticketPriceLines = (rows) =>
  cleanTicketPrices(rows).map(row => ({
    label: ticketPriceLabel(row),
    price: money(row.price_aud),
    soldOut: row.sold_out === true,
    waitlistUrl: row.waitlist_url || null,
  }));

// schema.org Offer names, used by the event JSON-LD.
export const ticketPriceOfferName = (row) => (row.type === CUSTOM_TICKET_TYPE ? row.label : row.type === 'group'
  ? `Group ticket (${row.group_size} people)`
  : `${LABELS[row.type]} ticket`);

// What's wrong with the form's rows before they're saved, or null. The form
// keeps a row per ticked option even while its price is blank, so this is
// what stops a ticked option from silently disappearing on save.
export const ticketPricesFormError = (rows) => {
  if (!Array.isArray(rows)) return null;
  const groupSizes = new Set();
  const customLabels = new Set();
  for (const row of rows) {
    if (row.type === CUSTOM_TICKET_TYPE) {
      const name = toLabel(row.label);
      if (!name) return 'Give each custom ticket a name, or remove it.';
      if (toPrice(row.price_aud) === null) return `Enter a price for the ${name} ticket, or remove it.`;
      if (customLabels.has(name.toLowerCase())) return `There are two custom tickets called "${name}".`;
      customLabels.add(name.toLowerCase());
      const url = typeof row.waitlist_url === 'string' ? row.waitlist_url.trim() : '';
      if (row.sold_out && url && !toWaitlistUrl(url)) return `The waitlist link for ${name} must start with http:// or https://.`;
      continue;
    }
    const label = row.type === 'group' ? 'Group' : LABELS[row.type] || 'Ticket';
    if (toPrice(row.price_aud) === null) return `Enter a price for the ${label} ticket, or untick it.`;
    if (row.type === 'group') {
      const size = toGroupSize(row.group_size);
      if (size === null) return `Group prices need a number of people between 2 and ${MAX_GROUP_SIZE}.`;
      if (groupSizes.has(size)) return `There are two group prices for ${size} people.`;
      groupSizes.add(size);
    }
  }
  return null;
};
