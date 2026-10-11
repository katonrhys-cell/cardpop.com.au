// Weekly supplier price watch for shop products.
//
// Each shop product can carry the supplier page it is ordered from
// (shop_product_costs.supplier_url, admin-only). A daily cron calls
// runSupplierPriceWatch(), which re-checks every product whose last check is
// at least a week old — so each product is checked once a week, a week after
// its own last check, rather than all at once. Admin → Products' "Check price
// now" calls it for one product with force: true.
//
// For each due page: fetch it through the SSRF-safe fetcher, read the price
// (src/utils/supplierPrice.js), store it on the cost row, append a history
// row, and bell every admin when the price moved or the page stopped being
// readable. Products that share one supplier page (colours of one Temu
// listing) are fetched once per run.
//
// It only reports. It never changes a selling price or a stored cost: what to
// do about a supplier price rise is a pricing decision for a person.
// Runbook: docs/supplier-price-watch.md.
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { fetchWebpageContent } from '../utils/safeFetch.js';
import { readSupplierPrice, priceChanged } from '../utils/supplierPrice.js';

export const CHECK_INTERVAL_DAYS = 7;
export const NOTIFICATION_TYPE = 'supplier_price_change';
// The cron lands on api/index.js, whose function budget is 40s: stop starting
// new pages with enough time left to finish the one in flight and reply.
const DEFAULT_BUDGET_MS = 25000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_PRODUCTS_PER_RUN = 200;

const LOG = '[SUPPLIER_PRICE]';
const FAILING = new Set(['unreadable', 'error']);
const fmt = (n) => `$${Number(n).toFixed(2)}`;

/** Cost rows with a supplier link that are due (or the given products, when forced). */
async function loadWatches({ productIds, force, now }) {
  let query = supabase
    .from('shop_product_costs')
    // `!inner` so the archived filter below applies in the database: an archived
    // product used to be fetched and then dropped here, and because the query is
    // ordered oldest-check-first, archived rows (never re-checked, so forever
    // the oldest) would crowd live products out of the 200-row page.
    .select('product_id, supplier, supplier_url, supplier_price_aud, supplier_price_currency, supplier_price_status, supplier_price_checked_at, shop_products!inner(title, sku, status)')
    .not('supplier_url', 'is', null)
    .neq('shop_products.status', 'archived')
    .order('supplier_price_checked_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PRODUCTS_PER_RUN);
  if (productIds?.length) query = query.in('product_id', productIds);
  if (!force) {
    const cutoff = new Date(now.getTime() - CHECK_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`supplier_price_checked_at.is.null,supplier_price_checked_at.lte.${cutoff}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load supplier links: ${error.message}`);
  // Archived products aren't sold any more; the query excludes them, this is
  // the belt to that brace.
  return (data || []).filter((row) => row.shop_products?.status !== 'archived');
}

/** One fetch + read for a supplier page. Never throws. */
async function checkPage(url) {
  try {
    const html = await fetchWebpageContent(url, { timeoutMs: FETCH_TIMEOUT_MS, logPrefix: 'SUPPLIER_PRICE' });
    const result = await readSupplierPrice(html, url);
    if (result.price == null) return { status: 'unreadable', error: result.reason || 'No price found on the page.' };
    return { status: 'ok', price: result.price, currency: result.currency || null, source: result.source };
  } catch (err) {
    return { status: 'error', error: String(err?.message || err).slice(0, 500) };
  }
}

/** What a check means for one product, given what was stored before. */
export function outcomeFor(row, page) {
  if (page.status !== 'ok') {
    return { status: page.status, notify: !FAILING.has(row.supplier_price_status) ? 'failing' : null };
  }
  if (priceChanged(row.supplier_price_aud, page.price)) return { status: 'changed', notify: 'changed' };
  // A first reading, or the same price again, is just "ok".
  return { status: 'ok', notify: null };
}

function notificationFor(row, page, kind) {
  const title = row.shop_products?.title || row.shop_products?.sku || 'A shop product';
  if (kind === 'changed') {
    const was = Number(row.supplier_price_aud);
    const up = page.price > was;
    return {
      title: `Supplier price ${up ? 'rose' : 'dropped'}: ${title}`,
      body: `${row.supplier || 'The supplier'} now lists it at ${fmt(page.price)}${page.currency && page.currency !== 'AUD' ? ` ${page.currency}` : ''} (was ${fmt(was)}). Check your cost and selling price in Admin → Products.`,
    };
  }
  return {
    title: `Can't read supplier price: ${title}`,
    body: `The weekly check couldn't read a price from ${row.supplier || 'the supplier'}'s page: ${page.error || 'unknown error'}. Open the link in Admin → Products to check it by hand.`,
  };
}

async function notifyAdmins(items) {
  if (!items.length) return 0;
  const { data: admins, error } = await supabase.from('profiles').select('id').eq('is_admin', true);
  if (error || !admins?.length) {
    if (error) logger.warn(`${LOG} Could not load admins: ${error.message}`);
    return 0;
  }
  const rows = admins.flatMap((a) => items.map((n) => ({
    user_id: a.id,
    type: NOTIFICATION_TYPE,
    title: n.title,
    body: n.body,
    link: '/admin/products',
    related_id: n.productId,
  })));
  const { error: insErr } = await supabase.from('notifications').insert(rows);
  if (insErr) {
    logger.warn(`${LOG} Could not write admin notifications: ${insErr.message}`);
    return 0;
  }
  return rows.length;
}

/**
 * Check due supplier pages. Returns a summary:
 * { checked, changed, unreadable, errors, skipped, notified, results[] }.
 */
export async function runSupplierPriceWatch({ productIds = null, force = false, budgetMs = DEFAULT_BUDGET_MS, now = new Date() } = {}) {
  const started = Date.now();
  const watches = await loadWatches({ productIds, force, now });

  // Group colours that share one supplier page so it's fetched once.
  const byUrl = new Map();
  for (const row of watches) {
    if (!byUrl.has(row.supplier_url)) byUrl.set(row.supplier_url, []);
    byUrl.get(row.supplier_url).push(row);
  }

  const summary = { checked: 0, changed: 0, unreadable: 0, errors: 0, skipped: 0, notified: 0, results: [] };
  const toNotify = [];

  for (const [url, rows] of byUrl) {
    if (Date.now() - started > budgetMs) {
      summary.skipped += rows.length;
      continue;
    }
    const page = await checkPage(url);
    const checkedAt = new Date().toISOString();

    for (const row of rows) {
      const outcome = outcomeFor(row, page);
      const patch = {
        supplier_price_status: outcome.status,
        supplier_price_checked_at: checkedAt,
        supplier_price_error: page.status === 'ok' ? null : page.error,
      };
      // A failed read keeps the last good price, so the next good read is
      // compared against it.
      if (page.status === 'ok') {
        patch.supplier_price_aud = page.price;
        patch.supplier_price_currency = page.currency;
        if (outcome.status === 'changed') patch.supplier_price_changed_at = checkedAt;
      }

      const { error: upErr } = await supabase.from('shop_product_costs').update(patch).eq('product_id', row.product_id);
      if (upErr) logger.warn(`${LOG} Could not save check for ${row.product_id}: ${upErr.message}`);

      const { error: histErr } = await supabase.from('shop_supplier_price_history').insert({
        product_id: row.product_id,
        checked_at: checkedAt,
        supplier_url: url,
        price_aud: page.status === 'ok' ? page.price : null,
        currency: page.status === 'ok' ? page.currency : null,
        status: outcome.status,
        error: page.status === 'ok' ? null : page.error,
        source: page.source || null,
      });
      if (histErr) logger.warn(`${LOG} Could not log check for ${row.product_id}: ${histErr.message}`);

      summary.checked += 1;
      if (outcome.status === 'changed') summary.changed += 1;
      if (outcome.status === 'unreadable') summary.unreadable += 1;
      if (outcome.status === 'error') summary.errors += 1;
      if (outcome.notify) toNotify.push({ productId: row.product_id, ...notificationFor(row, page, outcome.notify) });

      summary.results.push({
        productId: row.product_id,
        sku: row.shop_products?.sku || null,
        status: outcome.status,
        price: page.status === 'ok' ? page.price : null,
        previousPrice: row.supplier_price_aud != null ? Number(row.supplier_price_aud) : null,
        currency: page.status === 'ok' ? page.currency : null,
        error: page.status === 'ok' ? null : page.error,
        checkedAt,
      });
    }
  }

  summary.notified = await notifyAdmins(toNotify);
  logger.info(`${LOG} ${JSON.stringify({ ...summary, results: undefined })}`);
  return summary;
}
