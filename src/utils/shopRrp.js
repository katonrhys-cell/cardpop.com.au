/**
 * RRP (recommended retail price) helpers for shop_products.
 *
 * Pure functions shared by scripts/apply-shop-rrp.mjs and its tests. They
 * turn a `sku,title,rrp_aud` CSV into a per-product update plan without
 * touching the database, so the plan can be printed (dry run) or applied.
 */

/** Minimal RFC-4180-ish line splitter: handles quoted fields with commas and "" escapes. */
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const moneyCell = (raw) => String(raw ?? '').trim().replace(/^\$|^A\$|^AUD\s*/i, '').replace(/,/g, '');

/**
 * Parse the RRP CSV. Header must include `sku` and `rrp_aud` (any order,
 * extra columns ignored). Blank rrp cells are skipped rather than errors so
 * the committed template can be filled in progressively.
 *
 * Optional cost columns — `wholesale_ex_gst_aud`, `wholesale_inc_gst_aud`,
 * `supplier_sku` — are read when present; a row with a cost but no RRP is
 * still returned (rrp null) so costs can be recorded independently.
 *
 * @returns {{ rows: Array<{sku: string, rrp: number|null, wholesaleEx?: number|null, wholesaleInc?: number|null, supplierSku?: string|null, line: number}>, skipped: string[], errors: string[] }}
 */
export function parseRrpCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const rows = [];
  const skipped = [];
  const errors = [];
  if (lines.length === 0) return { rows, skipped, errors: ['CSV is empty'] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const skuIdx = header.indexOf('sku');
  const rrpIdx = header.indexOf('rrp_aud');
  if (skuIdx === -1 || rrpIdx === -1) {
    return { rows, skipped, errors: ['CSV header must include "sku" and "rrp_aud" columns'] };
  }

  const exIdx = header.indexOf('wholesale_ex_gst_aud');
  const incIdx = header.indexOf('wholesale_inc_gst_aud');
  const supIdx = header.indexOf('supplier_sku');
  const hasCosts = exIdx !== -1 || incIdx !== -1;

  const parseMoney = (idx, cells, label, sku, lineNo) => {
    if (idx === -1) return undefined;
    const raw = moneyCell(cells[idx]);
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) { errors.push(`line ${lineNo}: invalid ${label} "${cells[idx]}" for ${sku}`); return NaN; }
    return Math.round(n * 100) / 100;
  };

  const seen = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const sku = (cells[skuIdx] || '').toUpperCase();
    const raw = moneyCell(cells[rrpIdx]);
    const lineNo = i + 1;
    if (!sku) { errors.push(`line ${lineNo}: missing sku`); continue; }
    if (seen.has(sku)) { errors.push(`line ${lineNo}: duplicate sku ${sku}`); continue; }
    seen.add(sku);

    let rrp = null;
    if (raw !== '') {
      rrp = Number(raw);
      if (!Number.isFinite(rrp) || rrp < 0) { errors.push(`line ${lineNo}: invalid rrp_aud "${cells[rrpIdx]}" for ${sku}`); continue; }
      rrp = Math.round(rrp * 100) / 100;
    }

    const row = { sku, rrp, line: lineNo };
    if (hasCosts) {
      const ex = parseMoney(exIdx, cells, 'wholesale_ex_gst_aud', sku, lineNo);
      const inc = parseMoney(incIdx, cells, 'wholesale_inc_gst_aud', sku, lineNo);
      if (Number.isNaN(ex) || Number.isNaN(inc)) continue;
      row.wholesaleEx = ex ?? null;
      row.wholesaleInc = inc ?? null;
      row.supplierSku = supIdx !== -1 ? ((cells[supIdx] || '').toUpperCase() || null) : null;
    }

    if (rrp === null && !(hasCosts && (row.wholesaleEx != null || row.wholesaleInc != null))) { skipped.push(sku); continue; }
    rows.push(row);
  }
  return { rows, skipped, errors };
}

const money = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);

/**
 * Work out what each CSV row would change on its matching product.
 *
 * @param {Array<{sku: string, rrp: number}>} rows      parsed CSV rows
 * @param {Array<object>} products                     shop_products rows (id, sku, title, price_aud, retail_price_aud)
 * @param {{ setPrice?: boolean, onlyUnpriced?: boolean }} opts
 *   setPrice     — also set price_aud to the RRP (the "sell at RRP" pass).
 *   onlyUnpriced — with setPrice, leave products that already have a non-zero
 *                  price alone (protects hand-set prices).
 * @returns {{ updates: Array<{id, sku, title, before:{price,rrp}, after:{price,rrp}}>, unchanged: string[], unknown: string[] }}
 */
export function planRrpUpdates(rows, products, opts = {}) {
  const { setPrice = false, onlyUnpriced = false } = opts;
  const bySku = new Map();
  for (const p of products) {
    if (p?.sku) bySku.set(String(p.sku).toUpperCase(), p);
  }
  const updates = [];
  const unchanged = [];
  const unknown = [];

  for (const row of rows) {
    if (row.rrp == null) continue; // cost-only row: nothing to do on shop_products
    const p = bySku.get(row.sku);
    if (!p) { unknown.push(row.sku); continue; }
    const beforePrice = money(p.price_aud) ?? 0;
    const beforeRrp = money(p.retail_price_aud);
    const afterRrp = row.rrp;
    let afterPrice = beforePrice;
    if (setPrice && !(onlyUnpriced && beforePrice > 0)) afterPrice = row.rrp;

    if (beforeRrp === afterRrp && beforePrice === afterPrice) { unchanged.push(row.sku); continue; }
    updates.push({
      id: p.id,
      sku: row.sku,
      title: p.title,
      before: { price: beforePrice, rrp: beforeRrp },
      after: { price: afterPrice, rrp: afterRrp },
    });
  }
  return { updates, unchanged, unknown };
}

/** Column patch for one planned update — what the script sends to Supabase. */
export function updatePatch(update) {
  const patch = { retail_price_aud: update.after.rrp, updated_at: new Date().toISOString() };
  if (update.after.price !== update.before.price) patch.price_aud = update.after.price;
  return patch;
}

/**
 * Plan shop_product_costs upserts from rows that carry a cost. A row whose
 * SKU has no product is reported in `unknown`; a row identical to the
 * existing cost record is `unchanged`.
 *
 * @param {Array<object>} rows          parsed CSV rows (with wholesaleEx/Inc)
 * @param {Array<object>} products      shop_products rows (id, sku)
 * @param {Array<object>} existingCosts shop_product_costs rows (product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier_sku)
 * @param {{ supplier?: string, source?: string }} meta
 */
export function planCostUpserts(rows, products, existingCosts = [], meta = {}) {
  const bySku = new Map();
  for (const p of products) if (p?.sku) bySku.set(String(p.sku).toUpperCase(), p);
  const existing = new Map(existingCosts.map((c) => [c.product_id, c]));
  const upserts = [];
  const unchanged = [];
  const unknown = [];
  for (const row of rows) {
    if (row.wholesaleEx == null && row.wholesaleInc == null) continue;
    const p = bySku.get(row.sku);
    if (!p) { unknown.push(row.sku); continue; }
    const ex = row.wholesaleEx ?? (row.wholesaleInc != null ? Math.round((row.wholesaleInc / 1.1) * 100) / 100 : null);
    const inc = row.wholesaleInc ?? (row.wholesaleEx != null ? Math.round(row.wholesaleEx * 1.1 * 100) / 100 : null);
    const supplierSku = row.supplierSku && row.supplierSku !== row.sku ? row.supplierSku : null;
    const cur = existing.get(p.id);
    if (cur && money(cur.wholesale_ex_gst_aud) === ex && money(cur.wholesale_inc_gst_aud) === inc && (cur.supplier_sku || null) === supplierSku) {
      unchanged.push(row.sku); continue;
    }
    upserts.push({
      product_id: p.id,
      sku: row.sku,
      title: p.title,
      before: cur ? { ex: money(cur.wholesale_ex_gst_aud), inc: money(cur.wholesale_inc_gst_aud) } : null,
      record: {
        product_id: p.id,
        wholesale_ex_gst_aud: ex,
        wholesale_inc_gst_aud: inc,
        supplier: meta.supplier ?? null,
        supplier_sku: supplierSku,
        source: meta.source ?? null,
        updated_at: new Date().toISOString(),
      },
    });
  }
  return { upserts, unchanged, unknown };
}

/** Ex-GST gross margin fraction for a GST-inclusive selling price, or null. */
export function grossMargin(priceIncGst, costExGst) {
  if (costExGst == null || costExGst === '') return null;
  const price = Number(priceIncGst); const cost = Number(costExGst);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(cost)) return null;
  const priceEx = price / 1.1;
  return (priceEx - cost) / priceEx;
}
