// Extra ticket prices on an event (events.ticket_prices), on top of the
// general-admission entry fee and presale price. Dependency-free so the event
// form, the event page, lib/eventSeo.js and api/prerender.js all read the same
// shapes and labels.
//
// Stored shape: [{ type, price_aud, group_size? }] — `group_size` only on
// `group` rows (how many people the price covers). Every type but `group`
// appears at most once; group rows are ordered by size.

export const TICKET_PRICE_TYPES = [
  { type: 'child',    label: 'Child' },
  { type: 'vip',      label: 'VIP' },
  { type: 'ga_early', label: 'GA Early Access' },
  { type: 'ga_late',  label: 'GA Late Access' },
  { type: 'group',    label: 'Group' },
];

const LABELS = Object.fromEntries(TICKET_PRICE_TYPES.map(t => [t.type, t.label]));
const ORDER = Object.fromEntries(TICKET_PRICE_TYPES.map((t, i) => [t.type, i]));

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
    if (!LABELS[type]) continue;
    const price_aud = toPrice(row.price_aud);
    if (price_aud === null) continue;
    if (type === 'group') {
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
export const ticketPriceLabel = (row) => (row.type === 'group' ? `Group of ${row.group_size}` : LABELS[row.type] || 'Ticket');

const money = (n) => (n === 0 ? 'Free' : `$${n.toFixed(2)}`);

// [{ label, price }] ready to render, e.g. { label: 'Group of 4', price: '$40.00' }.
export const ticketPriceLines = (rows) =>
  cleanTicketPrices(rows).map(row => ({ label: ticketPriceLabel(row), price: money(row.price_aud) }));

// schema.org Offer names, used by the event JSON-LD.
export const ticketPriceOfferName = (row) => (row.type === 'group'
  ? `Group ticket (${row.group_size} people)`
  : `${LABELS[row.type]} ticket`);

// What's wrong with the form's rows before they're saved, or null. The form
// keeps a row per ticked option even while its price is blank, so this is
// what stops a ticked option from silently disappearing on save.
export const ticketPricesFormError = (rows) => {
  if (!Array.isArray(rows)) return null;
  const groupSizes = new Set();
  for (const row of rows) {
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
