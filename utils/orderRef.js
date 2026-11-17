// The reference people see for an order — dependency-free, so the SPA, the
// Express API, the email templates and the invoice PDF all print the same thing.
//
// Every order carries a sequential number from the database (`orders.order_number`,
// `CP-000123`, assigned by trg_orders_assign_order_number — see
// docs/order-numbers.md). Anything that has the row prints that. The short form
// of the UUID (`0F0F0F0F`) is only the fall-back for the window where the
// migration hasn't landed yet, or where a query didn't select the column — it is
// what every screen used before order numbers existed.

/** First 8 characters of an order id, upper-cased: `0f0f0f0f-0f0f-…` → `0F0F0F0F`. */
export const shortOrderId = (id) => String(id ?? '').replace(/-/g, '').slice(0, 8).toUpperCase();

/**
 * The order's reference.
 * @param {{ order_number?: string|null, id?: string|null, order_id?: string|null }} order
 *   a row from `orders` (or anything carrying `order_number` plus `id`/`order_id`)
 * @returns {string} `CP-000123`, else the short id, else `''`
 */
export const orderRef = (order) => {
  const number = String(order?.order_number ?? '').trim();
  return number || shortOrderId(order?.id ?? order?.order_id);
};

/**
 * A typed order number → its canonical form, or null when it isn't one.
 * `cp-123` / `CP-000123` / ` cp 123 ` → `CP-000123`. The `CP-` prefix is required:
 * bare digits are too ambiguous in a search box (invoice numbers, amounts…).
 */
export const normaliseOrderNumber = (value) => {
  const m = /^cp[\s-]?(\d{1,9})$/i.exec(String(value ?? '').trim());
  return m ? `CP-${m[1].padStart(6, '0')}` : null;
};
