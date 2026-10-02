// Finance & tax arithmetic for the admin portal — pure functions, no React,
// no Supabase, so every figure the Finance & Tax page shows is unit-testable.
//
// Scope: CardPop's OWN books. Two revenue streams:
//   • Shop sales — CardPop is the supplier. Each order line carries the
//     product id, quantity, GST-inclusive unit price and the GST inside it.
//     Cost of goods comes from the wholesale cost snapshotted onto the line at
//     checkout (unit_cost_ex_gst_aud), falling back to the current
//     shop_product_costs row for orders placed before snapshots existed.
//   • Marketplace — CardPop supplies a service (commission + processing fee);
//     the card itself is the seller's supply. platform_gst_aud is the GST
//     inside CardPop's fees; seller_gst_aud is GST CardPop withholds from the
//     seller's payout and remits on their behalf (see docs/order-pricing.md).
//
// Every selling price on CardPop is GST-inclusive, so "ex GST" = inc ÷ 1.1 at
// the 10% rate and the GST component = inc × 1/11. Costs are stored both ways
// as the supplier quotes them; when only one is present the other is derived
// at the rate in force.
//
// These are management figures to hand to an accountant, not a BAS lodgement.
// In particular GST credits are shown on the cost of goods SOLD in the period
// (a margin view); the credit actually arises when stock is PURCHASED, which
// this app does not record.

import { startOfDay, endOfDay, format } from 'date-fns';
import { isPaidOrder, isSettledRefund } from './revenue.js';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const toCents = (v) => Math.round(num(v) * 100);
const fromCents = (c) => Math.round(c) / 100;

export const GST_RATE_PCT = 10;

/** GST component inside a GST-inclusive amount, in cents. */
export const gstInsideCents = (incCents, ratePct = GST_RATE_PCT) =>
  Math.round(incCents * ratePct / (100 + ratePct));

// ─── Periods (Australian financial year: 1 July → 30 June) ───────────────────

/** FY containing `date`: FY2026-27 runs 2026-07-01 → 2027-06-30. */
export const financialYearOf = (date) => {
  const d = new Date(date);
  const startYear = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    key: `fy${startYear}`,
    label: `FY${startYear}-${String(startYear + 1).slice(2)}`,
    start: startOfDay(new Date(startYear, 6, 1)),
    end: endOfDay(new Date(startYear + 1, 5, 30)),
  };
};

const QUARTERS = [
  { n: 1, startMonth: 6, months: 'Jul–Sep' },
  { n: 2, startMonth: 9, months: 'Oct–Dec' },
  { n: 3, startMonth: 0, months: 'Jan–Mar' },
  { n: 4, startMonth: 3, months: 'Apr–Jun' },
];

/** BAS quarter containing `date` (Q1 = Jul–Sep of the FY). */
export const basQuarterOf = (date) => {
  const d = new Date(date);
  const fy = financialYearOf(d);
  const startYear = Number(fy.key.slice(2));
  const m = d.getMonth();
  const q = m >= 6 && m <= 8 ? QUARTERS[0] : m >= 9 ? QUARTERS[1] : m <= 2 ? QUARTERS[2] : QUARTERS[3];
  const calYear = q.startMonth >= 6 ? startYear : startYear + 1;
  const start = startOfDay(new Date(calYear, q.startMonth, 1));
  const end = endOfDay(new Date(calYear, q.startMonth + 3, 0));
  return { key: `${fy.key}q${q.n}`, label: `Q${q.n} ${fy.label} (${q.months} ${calYear})`, start, end, fy };
};

/**
 * Period options for the picker: this and last FY, the four BAS quarters of
 * the current FY up to now, the previous quarter, and all time.
 */
export const periodOptions = (now = new Date()) => {
  const fy = financialYearOf(now);
  const lastFy = financialYearOf(new Date(fy.start.getFullYear() - 1, 6, 1));
  const thisQ = basQuarterOf(now);
  const prevQ = basQuarterOf(new Date(thisQ.start.getTime() - 24 * 3600 * 1000));
  const opts = [
    { value: 'all', label: 'All time', start: null, end: null },
    { value: fy.key, label: `${fy.label} (this financial year)`, start: fy.start, end: fy.end },
    { value: lastFy.key, label: `${lastFy.label} (last financial year)`, start: lastFy.start, end: lastFy.end },
    { value: thisQ.key, label: `${thisQ.label} — current BAS quarter`, start: thisQ.start, end: thisQ.end },
    { value: prevQ.key, label: `${prevQ.label} — previous BAS quarter`, start: prevQ.start, end: prevQ.end },
  ];
  const seen = new Set();
  return opts.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
};

export const filterByPeriod = (rows = [], period, dateKey = 'created_at') => {
  if (!period || (!period.start && !period.end)) return rows || [];
  return (rows || []).filter((r) => {
    const t = new Date(r?.[dateKey]).getTime();
    if (!Number.isFinite(t)) return false;
    if (period.start && t < period.start.getTime()) return false;
    if (period.end && t > period.end.getTime()) return false;
    return true;
  });
};

// ─── Shop line economics ─────────────────────────────────────────────────────

const isShopLine = (line) => line && (line.type === 'shop' || (line.type == null && line.seller_id == null));

/**
 * Revenue, GST, cost and profit for one shop order line.
 *
 * @param {object} line          order_items entry
 * @param {Map|object} costsById shop_product_costs rows keyed by product id
 */
export const shopLineEconomics = (line, costsById = new Map()) => {
  const qty = Math.max(1, parseInt(line?.quantity, 10) || 1);
  const revenueIncCents = toCents(line?.line_total_aud ?? num(line?.unit_price_aud) * qty);
  const gstCents = line?.gst_aud != null ? toCents(line.gst_aud) : gstInsideCents(revenueIncCents);
  const revenueExCents = revenueIncCents - gstCents;

  const get = (id) => (costsById instanceof Map ? costsById.get(id) : costsById?.[id]);
  let unitCostExCents = null;
  let unitCostIncCents = null;
  let costSource = 'missing';
  if (line?.unit_cost_ex_gst_aud != null || line?.unit_cost_inc_gst_aud != null) {
    unitCostExCents = line.unit_cost_ex_gst_aud != null ? toCents(line.unit_cost_ex_gst_aud) : Math.round(toCents(line.unit_cost_inc_gst_aud) * 100 / (100 + GST_RATE_PCT));
    unitCostIncCents = line.unit_cost_inc_gst_aud != null ? toCents(line.unit_cost_inc_gst_aud) : Math.round(unitCostExCents * (100 + GST_RATE_PCT) / 100);
    costSource = 'snapshot';
  } else {
    const c = get(line?.id);
    if (c && (c.wholesale_ex_gst_aud != null || c.wholesale_inc_gst_aud != null)) {
      unitCostExCents = c.wholesale_ex_gst_aud != null ? toCents(c.wholesale_ex_gst_aud) : Math.round(toCents(c.wholesale_inc_gst_aud) * 100 / (100 + GST_RATE_PCT));
      unitCostIncCents = c.wholesale_inc_gst_aud != null ? toCents(c.wholesale_inc_gst_aud) : Math.round(unitCostExCents * (100 + GST_RATE_PCT) / 100);
      costSource = 'current';
    }
  }
  const cogsExCents = unitCostExCents != null ? unitCostExCents * qty : 0;
  const cogsIncCents = unitCostIncCents != null ? unitCostIncCents * qty : 0;
  const grossProfitCents = unitCostExCents != null ? revenueExCents - cogsExCents : null;

  return {
    productId: line?.id ?? null,
    title: line?.title ?? '',
    quantity: qty,
    revenueInc: fromCents(revenueIncCents),
    gst: fromCents(gstCents),
    revenueEx: fromCents(revenueExCents),
    unitCostEx: unitCostExCents != null ? fromCents(unitCostExCents) : null,
    cogsEx: fromCents(cogsExCents),
    gstCreditOnCogs: fromCents(cogsIncCents - cogsExCents),
    grossProfit: grossProfitCents != null ? fromCents(grossProfitCents) : null,
    marginPct: grossProfitCents != null && revenueExCents > 0 ? (grossProfitCents / revenueExCents) * 100 : null,
    costSource,
  };
};

/** Every shop line across paid orders, each tagged with its order. */
export const shopSalesLines = (orders = [], costsById = new Map()) => {
  const out = [];
  for (const o of orders || []) {
    if (!isPaidOrder(o)) continue;
    for (const line of Array.isArray(o.order_items) ? o.order_items : []) {
      if (!isShopLine(line)) continue;
      out.push({ orderId: o.id, orderRef: String(o.id || '').slice(0, 8).toUpperCase(), orderDate: o.created_at, orderStatus: o.status, ...shopLineEconomics(line, costsById) });
    }
  }
  return out;
};

/**
 * The CardPop Shop's share of an order's shipping, in cents: shipping_aud
 * minus the marketplace sellers' postage carried on listing lines.
 */
export const shopShippingCents = (order) => {
  const lines = Array.isArray(order?.order_items) ? order.order_items : [];
  const sellerPostage = lines
    .filter((l) => l && !isShopLine(l))
    .reduce((s, l) => s + toCents(l.shipping_aud), 0);
  return Math.max(0, toCents(order?.shipping_aud) - sellerPostage);
};

/**
 * Commission CardPop deducts from the seller's payout on an order, in cents.
 * Commission is earned twice — charged to the buyer (platform_fee_aud) AND
 * deducted from the seller (see cartService / checkoutService, and
 * platform_gst_aud, which is the GST inside 2 × commission + processing fee).
 * Cart orders carry it per listing line (commission_aud); single-item orders
 * deduct the same commission the buyer was charged.
 */
export const sellerCommissionCents = (order) => {
  const lines = Array.isArray(order?.order_items) ? order.order_items : [];
  const listingLines = lines.filter((l) => l && !isShopLine(l));
  if (listingLines.some((l) => l.commission_aud != null)) {
    return listingLines.reduce((s, l) => s + toCents(l.commission_aud), 0);
  }
  if (listingLines.length > 0 || (lines.length === 0 && order?.seller_id)) {
    // platform_fee_aud bundles any legacy GST added on top; the seller's
    // deduction is the commission alone.
    return Math.max(0, toCents(order?.platform_fee_aud) - toCents(order?.gst_aud));
  }
  return 0;
};

/** Shop P&L for a set of (already period-filtered) orders. */
export const summariseShopSales = (orders = [], costsById = new Map(), refunds = []) => {
  const lines = shopSalesLines(orders, costsById);
  const t = lines.reduce((acc, l) => {
    acc.revenueInc += toCents(l.revenueInc);
    acc.gst += toCents(l.gst);
    acc.revenueEx += toCents(l.revenueEx);
    acc.cogsEx += toCents(l.cogsEx);
    acc.gstCredits += toCents(l.gstCreditOnCogs);
    acc.units += l.quantity;
    if (l.costSource === 'missing') acc.missing += 1;
    if (l.costSource === 'current') acc.currentCost += 1;
    return acc;
  }, { revenueInc: 0, gst: 0, revenueEx: 0, cogsEx: 0, gstCredits: 0, units: 0, missing: 0, currentCost: 0 });

  // Shipping charged on shop orders is CardPop revenue too, GST-inclusive.
  // On a mixed cart order.shipping_aud = the shop's flat rate + each
  // marketplace seller's postage, and the seller's postage (recorded as
  // shipping_aud on that seller's parcel-defining listing line) is passed
  // through to the seller — so it is taken back out here.
  const shopOrders = (orders || []).filter((o) => isPaidOrder(o) && (Array.isArray(o.order_items) ? o.order_items : []).some(isShopLine));
  const shippingInc = shopOrders.reduce((s, o) => s + shopShippingCents(o), 0);
  const shippingGst = gstInsideCents(shippingInc);
  const orderIds = new Set(shopOrders.map((o) => o.id));
  const refunded = (refunds || []).filter((r) => isSettledRefund(r) && orderIds.has(r.order_id)).reduce((s, r) => s + toCents(r.refund_amount_aud), 0);

  const grossProfit = t.revenueEx - t.cogsEx;
  return {
    orderCount: shopOrders.length,
    lineCount: lines.length,
    unitsSold: t.units,
    salesInc: fromCents(t.revenueInc),
    gstOnSales: fromCents(t.gst),
    salesEx: fromCents(t.revenueEx),
    shippingInc: fromCents(shippingInc),
    shippingGst: fromCents(shippingGst),
    shippingEx: fromCents(shippingInc - shippingGst),
    cogsEx: fromCents(t.cogsEx),
    gstCreditsOnCogs: fromCents(t.gstCredits),
    grossProfit: fromCents(grossProfit),
    marginPct: t.revenueEx > 0 ? (grossProfit / t.revenueEx) * 100 : null,
    linesMissingCost: t.missing,
    linesUsingCurrentCost: t.currentCost,
    refunded: fromCents(refunded),
    lines,
  };
};

/** Marketplace (service) revenue and the GST split for paid orders. */
export const summariseMarketplace = (orders = []) => {
  const paid = (orders || []).filter(isPaidOrder);
  const t = paid.reduce((acc, o) => {
    const lines = Array.isArray(o.order_items) ? o.order_items : [];
    const hasListing = lines.some((l) => l && !isShopLine(l)) || (lines.length === 0 && o.seller_id);
    if (hasListing) acc.orders += 1;
    acc.buyerCommissionInc += toCents(o.platform_fee_aud);
    acc.sellerCommissionInc += sellerCommissionCents(o);
    acc.processingFeeInc += toCents(o.processing_fee_aud);
    acc.platformGst += toCents(o.platform_gst_aud);
    acc.sellerGst += toCents(o.seller_gst_aud);
    acc.sellerProceeds += toCents(o.seller_proceeds_aud);
    acc.gstAddedOnTop += toCents(o.gst_aud);
    return acc;
  }, { orders: 0, buyerCommissionInc: 0, sellerCommissionInc: 0, processingFeeInc: 0, platformGst: 0, sellerGst: 0, sellerProceeds: 0, gstAddedOnTop: 0 });
  // Commission is earned on both sides: charged to the buyer (platform_fee_aud)
  // and deducted from the seller's payout. Both, and the processing fee, are
  // GST-inclusive; platform_gst_aud is the GST inside all three, so revenue
  // has to include the seller-side commission for feesEx to be consistent.
  const commissionInc = t.buyerCommissionInc + t.sellerCommissionInc;
  const feesInc = commissionInc + t.processingFeeInc;
  return {
    orderCount: t.orders,
    buyerCommissionInc: fromCents(t.buyerCommissionInc),
    sellerCommissionInc: fromCents(t.sellerCommissionInc),
    commissionInc: fromCents(commissionInc),
    processingFeeInc: fromCents(t.processingFeeInc),
    feesInc: fromCents(feesInc),
    platformGst: fromCents(t.platformGst),
    feesEx: fromCents(feesInc - t.platformGst),
    sellerGstRemitted: fromCents(t.sellerGst),
    sellerProceeds: fromCents(t.sellerProceeds),
    legacyGstAddedOnTop: fromCents(t.gstAddedOnTop),
  };
};

/**
 * BAS-style summary from the two streams. Labels follow the ATO form so the
 * accountant can map them; figures are management estimates (see header).
 */
export const basSummary = (shop, marketplace) => {
  const g1 = toCents(shop.salesInc) + toCents(shop.shippingInc) + toCents(marketplace.feesInc);
  const oneA = toCents(shop.gstOnSales) + toCents(shop.shippingGst) + toCents(marketplace.platformGst) + toCents(marketplace.legacyGstAddedOnTop);
  const oneB = toCents(shop.gstCreditsOnCogs);
  const sellerGst = toCents(marketplace.sellerGstRemitted);
  return {
    g1TotalSalesInc: fromCents(g1),
    oneAGstOnSales: fromCents(oneA),
    oneBGstCreditsEstimate: fromCents(oneB),
    sellerGstRemittedOnBehalf: fromCents(sellerGst),
    netGstOwnSupplies: fromCents(oneA - oneB),
    netGstPayableIncludingSellers: fromCents(oneA - oneB + sellerGst),
  };
};

// ─── Inventory ───────────────────────────────────────────────────────────────

/** Stock on hand valued at wholesale cost (ex GST) and at selling price. */
export const inventoryValuation = (products = [], costsById = new Map()) => {
  const get = (id) => (costsById instanceof Map ? costsById.get(id) : costsById?.[id]);
  const rows = (products || []).map((p) => {
    const qty = Math.max(0, parseInt(p.stock_quantity, 10) || 0);
    const c = get(p.id);
    const unitCostEx = c?.wholesale_ex_gst_aud != null ? num(c.wholesale_ex_gst_aud) : (c?.wholesale_inc_gst_aud != null ? num(c.wholesale_inc_gst_aud) / (1 + GST_RATE_PCT / 100) : null);
    const priceInc = num(p.price_aud);
    return {
      productId: p.id, sku: p.sku, title: p.title, status: p.status, quantity: qty,
      unitCostEx: unitCostEx != null ? Math.round(unitCostEx * 100) / 100 : null,
      costValueEx: unitCostEx != null ? fromCents(Math.round(unitCostEx * 100) * qty) : null,
      retailValueInc: fromCents(toCents(priceInc) * qty),
      retailValueEx: fromCents((toCents(priceInc) - gstInsideCents(toCents(priceInc))) * qty),
      hasCost: unitCostEx != null,
    };
  });
  const totals = rows.reduce((acc, r) => {
    acc.units += r.quantity;
    acc.costValueEx += toCents(r.costValueEx);
    acc.retailValueInc += toCents(r.retailValueInc);
    acc.retailValueEx += toCents(r.retailValueEx);
    if (!r.hasCost && r.quantity > 0) acc.missingCostWithStock += 1;
    return acc;
  }, { units: 0, costValueEx: 0, retailValueInc: 0, retailValueEx: 0, missingCostWithStock: 0 });
  return {
    rows: rows.sort((a, b) => (b.costValueEx ?? 0) - (a.costValueEx ?? 0)),
    units: totals.units,
    costValueEx: fromCents(totals.costValueEx),
    retailValueInc: fromCents(totals.retailValueInc),
    retailValueEx: fromCents(totals.retailValueEx),
    potentialGrossProfit: fromCents(totals.retailValueEx - totals.costValueEx),
    missingCostWithStock: totals.missingCostWithStock,
  };
};

// ─── Loading ─────────────────────────────────────────────────────────────────

/**
 * Read every row of a query, page by page. PostgREST caps an unranged select
 * (1000 rows by default), which silently truncated the report. `makeQuery`
 * builds a fresh, stably ordered query; it is called once per page with
 * .range(from, to) applied here. Resolves to { data, error }.
 */
export const fetchAllPages = async (makeQuery, pageSize = 1000, maxPages = 1000) => {
  const all = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return { data: all, error: null };
};

// ─── CSV export ──────────────────────────────────────────────────────────────

const csvCell = (v) => {
  if (v == null) return '';
  let s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v);
  // Spreadsheet formula injection: user-supplied text (names, titles) that
  // starts with = + - @ would run as a formula when the CSV is opened.
  // Plain numeric strings (e.g. a negative margin '-5.3') are left alone.
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows, columns) => {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [header, ...body].join('\n') + '\n';
};

export const SALES_CSV_COLUMNS = [
  { label: 'Order date', value: (r) => (r.orderDate ? format(new Date(r.orderDate), 'yyyy-MM-dd') : '') },
  { label: 'Order ref', key: 'orderRef' },
  { label: 'Order status', key: 'orderStatus' },
  { label: 'Product', key: 'title' },
  { label: 'Product id', key: 'productId' },
  { label: 'Qty', key: 'quantity' },
  { label: 'Sale inc GST', key: 'revenueInc' },
  { label: 'GST on sale', key: 'gst' },
  { label: 'Sale ex GST', key: 'revenueEx' },
  { label: 'Unit cost ex GST', key: 'unitCostEx' },
  { label: 'COGS ex GST', key: 'cogsEx' },
  { label: 'GST credit on COGS', key: 'gstCreditOnCogs' },
  { label: 'Gross profit ex GST', key: 'grossProfit' },
  { label: 'Margin %', value: (r) => (r.marginPct == null ? '' : r.marginPct.toFixed(1)) },
  { label: 'Cost source', key: 'costSource' },
];

export const INVENTORY_CSV_COLUMNS = [
  { label: 'SKU', key: 'sku' },
  { label: 'Product', key: 'title' },
  { label: 'Status', key: 'status' },
  { label: 'Qty on hand', key: 'quantity' },
  { label: 'Unit cost ex GST', key: 'unitCostEx' },
  { label: 'Stock value at cost ex GST', key: 'costValueEx' },
  { label: 'Stock value at retail inc GST', key: 'retailValueInc' },
];
