// Pure helpers behind the admin bulk product importer.
//
// Everything here is side-effect free (no Supabase, no DOM) so the parsing,
// matching and validation rules can be tested directly — the component in
// components/admin/BulkProductImport.jsx only wires these to the UI and the
// upload pipeline.
//
// Two input shapes are supported, because stock arrives both ways:
//
//   • **CSV + photos** — a spreadsheet of products plus a folder of images.
//     Photos are matched to rows either by an explicit `images` column or, when
//     that's absent, by filename against the product title.
//   • **Photos only** — drop a folder and get one draft product per photo
//     group, titled from the filename, ready to price in the review table.
//     This is the fast path for singles, where the photo *is* the product.
//
// Filenames do the matching work in both modes, so the grouping rules matter:
// `charizard-vmax-front.jpg` and `charizard-vmax-back.jpg` are two photos of
// ONE product, while `booster-box-1.jpg` / `booster-box-2.jpg` are two photos
// of one product too. Trailing index numbers and front/back markers are
// stripped to find the group key; everything else is a different product.

import Papa from 'papaparse';
import { slugify } from '@/lib/slugify.js';
import { normalizeSku, isValidSku, suggestSku } from '@/utils/shopSku.js';
import { PREORDER_ETA_FALLBACK } from '@/utils/shopStock.js';

// Mirrors the shop_products status check constraint
// (supabase/migrations/20261002000345_shop_products_preorder_status.sql).
export const PRODUCT_STATUSES = ['active', 'preorder', 'draft', 'archived', 'coming_soon'];
export const PRODUCT_TYPES = ['sealed', 'single', 'accessory', 'other'];

// Bulk imports are overwhelmingly singles (a photo per card), so that's the
// default type. The review table has a "set for all rows" control for the
// cases where it isn't.
export const DEFAULT_ROW = {
  title: '',
  description: '',
  price_aud: '',
  stock_quantity: 1,
  category: '',
  product_type: 'single',
  status: 'active',
  sku: '',
  preorder_eta: '',
};

// Header aliases → canonical column. Compared after lowercasing and collapsing
// anything non-alphanumeric, so "Price (AUD)", "price_aud" and "PRICE AUD" all
// land on the same key.
const HEADER_ALIASES = {
  title: 'title',
  name: 'title',
  product: 'title',
  productname: 'title',
  cardname: 'title',
  description: 'description',
  desc: 'description',
  details: 'description',
  notes: 'description',
  price: 'price_aud',
  priceaud: 'price_aud',
  priceau: 'price_aud',
  amount: 'price_aud',
  cost: 'price_aud',
  rrp: 'price_aud',
  stock: 'stock_quantity',
  stockquantity: 'stock_quantity',
  qty: 'stock_quantity',
  quantity: 'stock_quantity',
  inventory: 'stock_quantity',
  category: 'category',
  cat: 'category',
  collection: 'category',
  type: 'product_type',
  producttype: 'product_type',
  status: 'status',
  sku: 'sku',
  productsku: 'sku',
  itemcode: 'sku',
  code: 'sku',
  eta: 'preorder_eta',
  preordereta: 'preorder_eta',
  images: 'images',
  image: 'images',
  imageurl: 'images',
  imageurls: 'images',
  photo: 'images',
  photos: 'images',
  file: 'images',
  filename: 'images',
  filenames: 'images',
  slug: 'slug',
};

/** A downloadable starter file so admins don't have to guess the columns. */
export const PRODUCT_CSV_TEMPLATE = [
  'title,sku,description,price_aud,stock_quantity,category,product_type,status,preorder_eta,images',
  '"Charizard VMAX Rainbow Rare",CP-CHARIZARD-VMAX-RR,"PSA 9. Champion\'s Path 074/073.",1250.00,1,Pokémon,single,active,,"charizard-vmax-front.jpg; charizard-vmax-back.jpg"',
  '"Scarlet & Violet Booster Box",CP-SV-BOOSTER-BOX,"36 packs, factory sealed.",219.95,6,Pokémon,sealed,active,,sv-booster-box.jpg',
  '"Prismatic Evolutions ETB",,"Pre-order.",89.95,0,Pokémon,sealed,preorder,"Ships in 2–4 weeks",prismatic-etb.jpg',
].join('\n');

const canonicalHeader = (header) => {
  const key = String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return HEADER_ALIASES[key] || null;
};

/** Strip currency symbols/thousands separators before parsing a price. */
export function parsePrice(value) {
  if (value === null || value === undefined) return NaN;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;
  return Number(cleaned);
}

function parseStock(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return DEFAULT_ROW.stock_quantity;
  }
  const n = parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? DEFAULT_ROW.stock_quantity : Math.max(0, n);
}

const normaliseEnum = (value, allowed, fallback) => {
  const v = String(value || '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
};

/** Split an `images` cell — semicolon, pipe or comma separated. */
export function splitImageCell(value) {
  if (!value) return [];
  return String(value)
    .split(/[;|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Filenames ──────────────────────────────────────────────────────────────

const stripExtension = (name) => String(name).replace(/\.[^./\\]+$/, '');

/** Just the filename, for inputs that may carry a webkitRelativePath. */
export const baseName = (name) => String(name || '').split(/[/\\]/).pop();

// Trailing photo-index / side markers: "-1", "_02", " (3)", "-front", "-back".
const PHOTO_SUFFIX_RE = /[\s._-]*(?:\((\d{1,3})\)|(front|back|rear|obverse|reverse)|(\d{1,3}))$/i;

/**
 * Group key + sort rank for a photo filename. Photos of the same product share
 * a key; the rank orders them so the front / lowest-numbered photo becomes the
 * product's primary image.
 */
export function photoGroup(fileName) {
  const stem = stripExtension(baseName(fileName));
  const match = stem.match(PHOTO_SUFFIX_RE);

  if (!match) return { key: slugify(stem), label: stem.trim(), rank: 0 };

  const label = stem.slice(0, match.index).trim();
  // A suffix that ate the entire name ("1.jpg", "front.jpg") isn't a suffix —
  // it's the whole product name, so keep the stem intact.
  if (!label) return { key: slugify(stem), label: stem.trim(), rank: 0 };

  const side = (match[2] || '').toLowerCase();
  const index = Number(match[1] ?? match[3] ?? 0);
  // front → 0, numbered photos → their number, back/rear → last.
  const rank = side ? (side === 'front' ? 0 : 999) : index;

  return { key: slugify(label), label, rank };
}

/** Human-readable product title from a filename ("psa10_charizard-1.jpg" → "psa10 charizard"). */
export function titleFromFileName(fileName) {
  return photoGroup(fileName)
    .label.replace(/[_]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Group image Files by product, ordered within each group.
 * @returns {Array<{key: string, title: string, files: File[]}>}
 */
export function groupImageFiles(files) {
  const groups = new Map();

  (files || []).forEach((file, position) => {
    const { key, label, rank } = photoGroup(file.name);
    if (!groups.has(key)) groups.set(key, { key, title: label, entries: [] });
    groups.get(key).entries.push({ file, rank, position });
  });

  return Array.from(groups.values()).map((group) => ({
    key: group.key,
    title: titleFromFileName(group.title),
    files: group.entries
      .sort((a, b) => a.rank - b.rank || a.position - b.position)
      .map((e) => e.file),
  }));
}

// ── CSV → rows ─────────────────────────────────────────────────────────────

/**
 * Parse a product CSV into normalised rows.
 * @returns {{rows: object[], unknownHeaders: string[], missingTitleColumn: boolean, error: string|null}}
 */
export function parseProductCsv(text) {
  const parsed = Papa.parse(String(text || '').trim(), {
    header: true,
    skipEmptyLines: 'greedy',
  });

  const headers = parsed.meta?.fields || [];
  const mapping = new Map();
  const unknownHeaders = [];
  headers.forEach((h) => {
    const canonical = canonicalHeader(h);
    if (canonical) mapping.set(h, canonical);
    else if (String(h || '').trim()) unknownHeaders.push(h);
  });

  const missingTitleColumn = !Array.from(mapping.values()).includes('title');
  if (missingTitleColumn) {
    return {
      rows: [],
      unknownHeaders,
      missingTitleColumn: true,
      error: 'The CSV needs a product name column (title, name or product).',
    };
  }

  const rows = (parsed.data || []).map((raw, index) => {
    const picked = {};
    Object.entries(raw).forEach(([header, value]) => {
      const canonical = mapping.get(header);
      if (canonical) picked[canonical] = typeof value === 'string' ? value.trim() : value;
    });

    return {
      ...DEFAULT_ROW,
      sourceLine: index + 2, // +1 for the header, +1 for 1-based line numbers
      title: picked.title || '',
      description: picked.description || '',
      price_aud: picked.price_aud ?? '',
      stock_quantity: parseStock(picked.stock_quantity),
      category: picked.category || '',
      product_type: normaliseEnum(picked.product_type, PRODUCT_TYPES, DEFAULT_ROW.product_type),
      status: normaliseEnum(picked.status, PRODUCT_STATUSES, DEFAULT_ROW.status),
      slug: picked.slug || '',
      sku: picked.sku || '',
      preorder_eta: picked.preorder_eta || '',
      imageNames: splitImageCell(picked.images),
      files: [],
    };
  }).filter((row) => row.title || row.price_aud !== '' || row.imageNames.length);

  return { rows, unknownHeaders, missingTitleColumn: false, error: null };
}

/** One draft row per photo group — the photos-only path. */
export function rowsFromImageFiles(files) {
  return groupImageFiles(files).map((group, index) => ({
    ...DEFAULT_ROW,
    sourceLine: index + 1,
    title: group.title,
    price_aud: '',
    slug: '',
    imageNames: group.files.map((f) => f.name),
    files: group.files,
  }));
}

// ── Matching photos to CSV rows ────────────────────────────────────────────

/**
 * Attach dropped image Files to parsed CSV rows.
 *
 * Explicit `images` cells win (matched on filename, with or without the
 * extension, case-insensitively). Rows with no usable `images` cell fall back
 * to matching the photo group key against the slug of the product title, which
 * is what makes "export a CSV, name the photos after the products" work with
 * no extra column at all.
 *
 * @returns {{rows: object[], unmatchedFiles: File[]}}
 */
export function attachImagesToRows(rows, files) {
  const byName = new Map();
  const byStem = new Map();
  const groups = new Map();
  const used = new Set();

  (files || []).forEach((file) => {
    const name = baseName(file.name).toLowerCase();
    if (!byName.has(name)) byName.set(name, file);
    const stem = stripExtension(name);
    if (!byStem.has(stem)) byStem.set(stem, file);
  });

  groupImageFiles(files).forEach((group) => groups.set(group.key, group));

  const matched = rows.map((row) => {
    const explicit = [];
    row.imageNames.forEach((raw) => {
      // A full URL in the images column is an already-hosted image: keep it.
      if (/^https?:\/\//i.test(raw)) {
        explicit.push(raw);
        return;
      }
      const name = baseName(raw).toLowerCase();
      const file = byName.get(name) || byStem.get(stripExtension(name));
      if (file) {
        explicit.push(file);
        used.add(file);
      }
    });

    if (explicit.length) return { ...row, files: explicit };

    const group = groups.get(slugify(row.title));
    if (group) {
      group.files.forEach((f) => used.add(f));
      return { ...row, files: group.files };
    }

    return { ...row, files: [] };
  });

  return {
    rows: matched,
    unmatchedFiles: (files || []).filter((f) => !used.has(f)),
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate and finalise rows for import: per-row errors/warnings, and unique
 * slugs both within the batch and against slugs already in the shop.
 *
 * @param {object[]} rows
 * @param {object}  [options]
 * @param {Set<string>} [options.existingSlugs]  Slugs already in shop_products.
 * @param {Set<string>} [options.existingTitles] Lowercased titles already in shop_products.
 */
export function validateRows(rows, options = {}) {
  const existingSlugs = options.existingSlugs || new Set();
  const existingTitles = options.existingTitles || new Set();
  const existingSkus = options.existingSkus || new Set();
  const takenSlugs = new Set(existingSlugs);
  const takenSkus = new Set(existingSkus);

  return rows.map((row) => {
    const errors = [];
    const warnings = [];

    const title = String(row.title || '').trim();
    if (!title) errors.push('Product name is required');

    const price = parsePrice(row.price_aud);
    if (row.price_aud === '' || row.price_aud === null || row.price_aud === undefined) {
      errors.push('Price is required');
    } else if (Number.isNaN(price)) {
      errors.push(`"${row.price_aud}" is not a valid price`);
    } else if (price < 0) {
      errors.push('Price cannot be negative');
    }

    if (!row.files?.length) warnings.push('No photo matched — the product will have no image');

    // Only Safari can decode HEIC, so on any other browser these fail at upload
    // (utils/uploadProductImages.js refuses them rather than storing an image
    // shoppers can't see). Flag it here so a long import isn't the thing that
    // discovers it. A warning, not an error: on Safari they convert fine.
    if ((row.files || []).some((f) => f && f.name && /\.(heic|heif)$/i.test(f.name))) {
      warnings.push('HEIC photo — export as JPEG first (only Safari can read HEIC)');
    }
    if (title && existingTitles.has(title.toLowerCase())) {
      warnings.push('A product with this name already exists');
    }

    let slug = slugify(row.slug || title);
    if (slug) {
      const base = slug;
      let n = 2;
      while (takenSlugs.has(slug)) slug = `${base}-${n++}`;
      takenSlugs.add(slug);
    }

    // `shop_products.sku` is NOT NULL and unique, so a row without one can't
    // be inserted. Derive it from the title the same way the single-product
    // form's suggest button does, then de-duplicate against the batch and the
    // existing catalogue.
    let sku = normalizeSku(row.sku) || suggestSku(title);
    if (!sku) {
      errors.push('A SKU is required (none could be derived from the name)');
    } else if (!isValidSku(sku)) {
      errors.push(`"${sku}" is not a valid SKU (A–Z, 0–9, . _ / - only)`);
    } else {
      const base = sku;
      let n = 2;
      while (takenSkus.has(sku)) sku = `${base}-${n++}`;
      takenSkus.add(sku);
      if (sku !== base) warnings.push(`SKU already taken — using ${sku}`);
    }

    // The DB enforces `status <> 'preorder' or preorder_eta is not null`, so a
    // pre-order row with no ETA would be rejected by Postgres mid-import.
    // Fill the shop's standard fallback rather than failing the row.
    let preorderEta = String(row.preorder_eta || '').trim();
    if (row.status === 'preorder' && !preorderEta) {
      preorderEta = PREORDER_ETA_FALLBACK;
      warnings.push(`No ETA given — using "${PREORDER_ETA_FALLBACK}"`);
    }

    return {
      ...row,
      title,
      slug,
      sku,
      preorder_eta: preorderEta,
      price_aud: Number.isNaN(price) ? row.price_aud : price,
      stock_quantity: parseStock(row.stock_quantity),
      product_type: normaliseEnum(row.product_type, PRODUCT_TYPES, DEFAULT_ROW.product_type),
      status: normaliseEnum(row.status, PRODUCT_STATUSES, DEFAULT_ROW.status),
      errors,
      warnings,
      valid: errors.length === 0,
    };
  });
}

/** Database payload for a validated row, given its uploaded image URLs. */
export function buildProductPayload(row, imageUrls, createdBy = null) {
  const urls = (imageUrls || []).filter(Boolean);
  return {
    title: row.title,
    description: row.description?.trim() ? row.description.trim() : null,
    price_aud: Number(row.price_aud),
    stock_quantity: parseStock(row.stock_quantity),
    category: row.category?.trim() ? row.category.trim() : null,
    product_type: row.product_type || null,
    status: row.status || 'active',
    sku: row.sku,
    preorder_eta: row.preorder_eta?.trim() ? row.preorder_eta.trim() : null,
    slug: row.slug || null,
    image_url: urls[0] || null,
    images: urls,
    created_by: createdBy,
  };
}

/** Split an array into fixed-size chunks (batched inserts). */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
