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

/**
 * Parse the RRP CSV. Header must include `sku` and `rrp_aud` (any order,
 * extra columns ignored). Blank rrp cells are skipped rather than errors so
 * the committed template can be filled in progressively.
 *
 * @returns {{ rows: Array<{sku: string, rrp: number, line: number}>, skipped: string[], errors: string[] }}
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

  const seen = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const sku = (cells[skuIdx] || '').toUpperCase();
    const raw = (cells[rrpIdx] || '').replace(/^\$|^A\$|^AUD\s*/i, '').replace(/,/g, '');
    const lineNo = i + 1;
    if (!sku) { errors.push(`line ${lineNo}: missing sku`); continue; }
    if (seen.has(sku)) { errors.push(`line ${lineNo}: duplicate sku ${sku}`); continue; }
    seen.add(sku);
    if (raw === '') { skipped.push(sku); continue; }
    const rrp = Number(raw);
    if (!Number.isFinite(rrp) || rrp < 0) { errors.push(`line ${lineNo}: invalid rrp_aud "${cells[rrpIdx]}" for ${sku}`); continue; }
    rows.push({ sku, rrp: Math.round(rrp * 100) / 100, line: lineNo });
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
