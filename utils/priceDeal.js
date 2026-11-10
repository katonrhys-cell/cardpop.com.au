// Dependency-free "is this a genuine markdown?" maths shared by the shop grid
// cards and product pages, so the badge, the saving and the struck-through RRP
// always agree. A deal only exists when the manufacturer RRP is really higher
// than the selling price — never invent one (consumer-law: no false was-prices).

const toPositive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * @param {number|string|null|undefined} price  what the shopper pays
 * @param {number|string|null|undefined} rrp    manufacturer RRP (retail_price_aud)
 * @returns {{ rrp:number, price:number, saving:number, pct:number } | null}
 */
export function getPriceDeal(price, rrp) {
  const p = toPositive(price);
  const r = toPositive(rrp);
  if (p == null || r == null || r <= p) return null;
  const saving = Math.round((r - p) * 100) / 100;
  const pct = Math.round((1 - p / r) * 100);
  if (pct < 1) return null;
  return { rrp: r, price: p, saving, pct };
}

// "$3" for whole dollars, "$3.50" otherwise — short enough for a badge.
export function formatSaving(amount) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}
