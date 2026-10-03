/**
 * Barcode (GTIN) helpers for shop products.
 *
 * Pure functions shared by scripts/apply-shop-barcodes.mjs and its tests: they
 * turn a `sku,title,barcode` CSV into a per-product update plan without touching
 * the database, so the plan can be printed (dry run) or applied. Google needs a
 * valid GTIN to attach product reviews to a product, so a barcode that fails
 * its check digit is reported and never written.
 */
import { splitCsvLine } from './shopRrp.js';

/** GTIN-8 / UPC-A (12) / EAN-13 / GTIN-14, digits only. */
export const GTIN_FORMAT = /^([0-9]{8}|[0-9]{12,14})$/;

/** True when `value` is a well-formed GTIN whose check digit is correct. */
export function isValidGtin(value) {
  const g = String(value ?? '').trim();
  if (!GTIN_FORMAT.test(g)) return false;
  const digits = [...g].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Parse the barcode CSV. Header must include `sku` and `barcode` (any order,
 * extra columns ignored). Blank barcode cells are skipped.
 *
 * @returns {{ rows: Array<{sku: string, barcode: string, title: string, line: number}>,
 *             invalid: Array<{sku: string, barcode: string, line: number}>,
 *             skipped: number, errors: string[] }}
 */
export function parseBarcodeCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const out = { rows: [], invalid: [], skipped: 0, errors: [] };
  if (lines.length === 0) { out.errors.push('CSV is empty'); return out; }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const skuIdx = header.indexOf('sku');
  const bcIdx = header.indexOf('barcode');
  const titleIdx = header.indexOf('title');
  if (skuIdx === -1 || bcIdx === -1) {
    out.errors.push('CSV header must include "sku" and "barcode" columns');
    return out;
  }

  const seenSku = new Set();
  const seenBarcode = new Map();
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    const cells = splitCsvLine(raw);
    const sku = (cells[skuIdx] || '').trim().toUpperCase();
    const barcode = (cells[bcIdx] || '').replace(/\s+/g, '');
    if (!sku || !barcode) { out.skipped += 1; return; }
    if (seenSku.has(sku)) { out.errors.push(`line ${line}: duplicate SKU ${sku}`); return; }
    seenSku.add(sku);
    if (seenBarcode.has(barcode)) {
      out.errors.push(`line ${line}: barcode ${barcode} is on both ${seenBarcode.get(barcode)} and ${sku}`);
      return;
    }
    seenBarcode.set(barcode, sku);
    if (!isValidGtin(barcode)) { out.invalid.push({ sku, barcode, line }); return; }
    out.rows.push({ sku, barcode, title: titleIdx === -1 ? '' : (cells[titleIdx] || ''), line });
  });
  return out;
}

/**
 * Match CSV rows to products (then colour variants) by SKU.
 *
 * @param rows      parseBarcodeCsv().rows
 * @param products  [{ id, sku, title, barcode }]
 * @param variants  [{ id, sku, barcode }]
 * @param opts.overwrite  replace a different barcode already on file (default: report only)
 * @returns {{ updates: Array<{kind:'product'|'variant', id:string, sku:string, title:string, before:string|null, after:string}>,
 *             unchanged: string[], conflicts: Array<{sku:string, existing:string, incoming:string}>, unknown: string[] }}
 */
export function planBarcodeUpdates(rows, products, variants = [], { overwrite = false } = {}) {
  const bySku = (list) => new Map((list || []).filter((r) => r.sku).map((r) => [String(r.sku).toUpperCase(), r]));
  const productBySku = bySku(products);
  const variantBySku = bySku(variants);
  const plan = { updates: [], unchanged: [], conflicts: [], unknown: [] };

  for (const row of rows) {
    const kind = productBySku.has(row.sku) ? 'product' : variantBySku.has(row.sku) ? 'variant' : null;
    if (!kind) { plan.unknown.push(row.sku); continue; }
    const target = (kind === 'product' ? productBySku : variantBySku).get(row.sku);
    const existing = String(target.barcode || '').trim() || null;
    if (existing === row.barcode) { plan.unchanged.push(row.sku); continue; }
    if (existing && !overwrite) { plan.conflicts.push({ sku: row.sku, existing, incoming: row.barcode }); continue; }
    plan.updates.push({ kind, id: target.id, sku: row.sku, title: target.title || row.title, before: existing, after: row.barcode });
  }
  return plan;
}
