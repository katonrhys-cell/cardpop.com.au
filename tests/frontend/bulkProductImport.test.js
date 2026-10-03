import { describe, it, expect } from 'vitest';
import {
  attachImagesToRows,
  baseName,
  buildProductPayload,
  chunk,
  groupImageFiles,
  parsePrice,
  parseProductCsv,
  photoGroup,
  rowsFromImageFiles,
  splitImageCell,
  titleFromFileName,
  validateRows,
} from '@/utils/bulkProductImport.js';

// Minimal stand-in for a dropped file — only `name` is read by these helpers.
const file = (name) => Object.assign(new File(['x'], name, { type: 'image/jpeg' }));

describe('photoGroup', () => {
  it('groups front/back photos of one product', () => {
    expect(photoGroup('charizard-vmax-front.jpg').key).toBe('charizard-vmax');
    expect(photoGroup('charizard-vmax-back.jpg').key).toBe('charizard-vmax');
  });

  it('orders front before numbered photos before back', () => {
    expect(photoGroup('card-front.jpg').rank).toBe(0);
    expect(photoGroup('card-2.jpg').rank).toBe(2);
    expect(photoGroup('card-back.jpg').rank).toBe(999);
  });

  it('groups numbered photos of one product', () => {
    expect(photoGroup('booster box 1.jpg').key).toBe('booster-box');
    expect(photoGroup('booster box (2).jpg').key).toBe('booster-box');
    expect(photoGroup('booster_box_03.jpg').key).toBe('booster-box');
  });

  it('keeps a name that is nothing but a suffix', () => {
    // "1.jpg" / "front.jpg" are the whole product name, not a photo index —
    // stripping the suffix would leave an empty group key that swallows every
    // other such file into one product.
    expect(photoGroup('1.jpg').key).toBe('1');
    expect(photoGroup('front.jpg').key).toBe('front');
  });

  it('leaves an unsuffixed name alone', () => {
    expect(photoGroup('sv-booster-box.png').key).toBe('sv-booster-box');
  });

  it('ignores directory prefixes from folder drops', () => {
    expect(baseName('stock/2026/pikachu-1.jpg')).toBe('pikachu-1.jpg');
    expect(photoGroup('stock/2026/pikachu-1.jpg').key).toBe('pikachu');
  });
});

describe('titleFromFileName', () => {
  it('turns separators into spaces', () => {
    expect(titleFromFileName('psa10_charizard-holo-1.jpg')).toBe('psa10 charizard holo');
  });
});

describe('groupImageFiles', () => {
  it('returns one entry per product with photos in display order', () => {
    const groups = groupImageFiles([
      file('charizard-back.jpg'),
      file('charizard-front.jpg'),
      file('pikachu.jpg'),
    ]);

    expect(groups).toHaveLength(2);
    const charizard = groups.find((g) => g.key === 'charizard');
    expect(charizard.files.map((f) => f.name)).toEqual(['charizard-front.jpg', 'charizard-back.jpg']);
  });
});

describe('rowsFromImageFiles', () => {
  it('drafts one product per photo group, titled from the filename', () => {
    const rows = rowsFromImageFiles([file('blastoise-ex-front.jpg'), file('blastoise-ex-back.jpg')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('blastoise ex');
    expect(rows[0].files).toHaveLength(2);
    expect(rows[0].price_aud).toBe('');
  });
});

describe('parsePrice', () => {
  it('strips currency formatting', () => {
    expect(parsePrice('$1,250.00')).toBe(1250);
    expect(parsePrice('19.95')).toBe(19.95);
    expect(parsePrice('AUD 8')).toBe(8);
  });

  it('returns NaN for junk', () => {
    expect(Number.isNaN(parsePrice('free'))).toBe(true);
    expect(Number.isNaN(parsePrice(''))).toBe(true);
  });
});

describe('splitImageCell', () => {
  it('accepts semicolon, pipe and comma separators', () => {
    expect(splitImageCell('a.jpg; b.jpg')).toEqual(['a.jpg', 'b.jpg']);
    expect(splitImageCell('a.jpg|b.jpg')).toEqual(['a.jpg', 'b.jpg']);
    expect(splitImageCell('a.jpg,b.jpg')).toEqual(['a.jpg', 'b.jpg']);
    expect(splitImageCell('')).toEqual([]);
  });
});

describe('parseProductCsv', () => {
  it('maps header aliases onto canonical columns', () => {
    const { rows, error } = parseProductCsv(
      'Name,Price (AUD),Qty,Category,Type,Status\nCharizard,$120.00,3,Pokémon,single,draft'
    );
    expect(error).toBeNull();
    expect(rows[0]).toMatchObject({
      title: 'Charizard',
      price_aud: '$120.00',
      stock_quantity: 3,
      category: 'Pokémon',
      product_type: 'single',
      status: 'draft',
    });
  });

  it('reports a CSV with no product name column', () => {
    const result = parseProductCsv('sku,price\nABC,10');
    expect(result.missingTitleColumn).toBe(true);
    expect(result.error).toMatch(/product name column/i);
    expect(result.rows).toEqual([]);
  });

  it('collects unrecognised headers instead of failing', () => {
    const { rows, unknownHeaders } = parseProductCsv('title,price,supplier\nPikachu,5,Acme');
    expect(unknownHeaders).toEqual(['supplier']);
    expect(rows).toHaveLength(1);
  });

  it('falls back to defaults for missing/invalid enums and stock', () => {
    const { rows } = parseProductCsv('title,price,type,status\nPikachu,5,nonsense,\n');
    expect(rows[0].product_type).toBe('single');
    expect(rows[0].status).toBe('active');
    expect(rows[0].stock_quantity).toBe(1);
  });

  it('records the source line so errors point back at the spreadsheet', () => {
    const { rows } = parseProductCsv('title,price\nA,1\nB,2');
    expect(rows.map((r) => r.sourceLine)).toEqual([2, 3]);
  });
});

describe('attachImagesToRows', () => {
  const files = [file('charizard-front.jpg'), file('charizard-back.jpg'), file('sv-box.jpg'), file('spare.jpg')];

  it('matches an explicit images column by filename', () => {
    const { rows } = parseProductCsv(
      'title,price,images\nCharizard,120,"charizard-front.jpg; charizard-back.jpg"'
    );
    const result = attachImagesToRows(rows, files);
    expect(result.rows[0].files.map((f) => f.name)).toEqual(['charizard-front.jpg', 'charizard-back.jpg']);
  });

  it('matches the images column even when the extension differs', () => {
    const { rows } = parseProductCsv('title,price,images\nBox,10,sv-box');
    const result = attachImagesToRows(rows, files);
    expect(result.rows[0].files[0].name).toBe('sv-box.jpg');
  });

  it('keeps already-hosted URLs from the images column', () => {
    const { rows } = parseProductCsv('title,price,images\nBox,10,https://cdn.example/box.jpg');
    const result = attachImagesToRows(rows, []);
    expect(result.rows[0].files).toEqual(['https://cdn.example/box.jpg']);
  });

  it('falls back to matching photos against the product title', () => {
    const { rows } = parseProductCsv('title,price\nCharizard,120');
    const result = attachImagesToRows(rows, files);
    expect(result.rows[0].files.map((f) => f.name)).toEqual(['charizard-front.jpg', 'charizard-back.jpg']);
  });

  it('reports photos that matched nothing', () => {
    const { rows } = parseProductCsv('title,price\nCharizard,120');
    const result = attachImagesToRows(rows, files);
    expect(result.unmatchedFiles.map((f) => f.name).sort()).toEqual(['spare.jpg', 'sv-box.jpg']);
  });
});

describe('validateRows', () => {
  const base = { ...{ title: 'Charizard', price_aud: '10', stock_quantity: 1, product_type: 'single', status: 'active' }, files: [file('a.jpg')] };

  it('flags a missing title and an unusable price', () => {
    const [noTitle, badPrice, noPrice] = validateRows([
      { ...base, title: '   ' },
      { ...base, price_aud: 'free' },
      { ...base, price_aud: '' },
    ]);
    expect(noTitle.valid).toBe(false);
    expect(noTitle.errors).toContain('Product name is required');
    expect(badPrice.valid).toBe(false);
    expect(noPrice.errors).toContain('Price is required');
  });

  it('accepts a zero price but not a negative one', () => {
    const [zero, negative] = validateRows([{ ...base, price_aud: '0' }, { ...base, price_aud: '-5' }]);
    expect(zero.valid).toBe(true);
    expect(negative.valid).toBe(false);
  });

  it('warns — but does not block — when a product has no photo', () => {
    const [row] = validateRows([{ ...base, files: [] }]);
    expect(row.valid).toBe(true);
    expect(row.warnings.join(' ')).toMatch(/no photo/i);
  });

  it('warns about HEIC photos before the import runs', () => {
    const [row] = validateRows([{ ...base, files: [file('card.HEIC')] }]);
    expect(row.warnings.join(' ')).toMatch(/HEIC/);
    expect(row.valid).toBe(true); // Safari can convert them, so don't block
  });

  it('does not flag ordinary photo formats', () => {
    const [row] = validateRows([{ ...base, files: [file('card.jpg')] }]);
    expect(row.warnings.join(' ')).not.toMatch(/HEIC/);
  });

  it('warns when the title already exists in the shop', () => {
    const [row] = validateRows([base], { existingTitles: new Set(['charizard']) });
    expect(row.warnings.join(' ')).toMatch(/already exists/i);
    expect(row.valid).toBe(true);
  });

  it('makes slugs unique within the batch and against the existing catalogue', () => {
    const rows = validateRows([base, { ...base }], { existingSlugs: new Set(['charizard']) });
    expect(rows.map((r) => r.slug)).toEqual(['charizard-2', 'charizard-3']);
  });

  it('coerces price and stock to numbers', () => {
    const [row] = validateRows([{ ...base, price_aud: '$1,250.50', stock_quantity: '7' }]);
    expect(row.price_aud).toBe(1250.5);
    expect(row.stock_quantity).toBe(7);
  });
});

describe('SKU handling', () => {
  const base = { title: 'Charizard VMAX', price_aud: '10', files: [] };

  it('derives a SKU from the title when the CSV has none', () => {
    // shop_products.sku is NOT NULL, so a row without one cannot be inserted.
    const [row] = validateRows([base]);
    expect(row.sku).toBe('CP-CHARIZARD-VMAX');
    expect(row.valid).toBe(true);
  });

  it('normalises a supplied SKU and keeps it', () => {
    const [row] = validateRows([{ ...base, sku: ' pog-mag55 ' }]);
    expect(row.sku).toBe('POG-MAG55');
  });

  it('rejects a SKU with illegal characters', () => {
    const [row] = validateRows([{ ...base, sku: 'bad sku!' }]);
    expect(row.valid).toBe(false);
    expect(row.errors.join(' ')).toMatch(/not a valid SKU/);
  });

  it('de-duplicates against the existing catalogue and within the batch', () => {
    const rows = validateRows([base, { ...base }], { existingSkus: new Set(['CP-CHARIZARD-VMAX']) });
    expect(rows.map((r) => r.sku)).toEqual(['CP-CHARIZARD-VMAX-2', 'CP-CHARIZARD-VMAX-3']);
    expect(rows[0].warnings.join(' ')).toMatch(/already taken/);
  });

  it('parses a sku column from the CSV', () => {
    const { rows } = parseProductCsv('name,price,item code\nMag Lock,49.95,POG-MAG55');
    expect(rows[0].sku).toBe('POG-MAG55');
  });
});

describe('pre-order rows', () => {
  it('fills the standard ETA when a preorder row has none', () => {
    // The DB enforces `status <> 'preorder' or preorder_eta is not null`, so an
    // empty ETA would be rejected by Postgres partway through an import.
    const [row] = validateRows([{ title: 'Prismatic ETB', price_aud: '89.95', status: 'preorder', files: [] }]);
    expect(row.preorder_eta).toBeTruthy();
    expect(row.valid).toBe(true);
    expect(row.warnings.join(' ')).toMatch(/ETA/);
  });

  it('keeps an ETA that was supplied', () => {
    const [row] = validateRows([
      { title: 'Prismatic ETB', price_aud: '89.95', status: 'preorder', preorder_eta: 'Ships in 2–4 weeks', files: [] },
    ]);
    expect(row.preorder_eta).toBe('Ships in 2–4 weeks');
    expect(row.warnings.join(' ')).not.toMatch(/ETA/);
  });

  it('accepts every status the shop_products constraint allows', () => {
    const rows = validateRows(
      ['active', 'preorder', 'draft', 'archived', 'coming_soon'].map((status) => ({
        title: `P ${status}`, price_aud: '1', status, files: [],
      })),
    );
    expect(rows.map((r) => r.status)).toEqual(['active', 'preorder', 'draft', 'archived', 'coming_soon']);
    expect(rows.every((r) => r.valid)).toBe(true);
  });
});

describe('buildProductPayload', () => {
  it('uses the first image as the primary and nulls empty text', () => {
    const [row] = validateRows([
      { title: 'Charizard', description: '  ', price_aud: '10', category: '', product_type: 'single', status: 'active', files: [] },
    ]);
    const payload = buildProductPayload(row, ['https://a/1.webp', 'https://a/2.webp'], 'user-1');

    expect(payload).toMatchObject({
      title: 'Charizard',
      description: null,
      category: null,
      price_aud: 10,
      image_url: 'https://a/1.webp',
      images: ['https://a/1.webp', 'https://a/2.webp'],
      slug: 'charizard',
      created_by: 'user-1',
    });
  });

  it('drops failed uploads from the images array', () => {
    const [row] = validateRows([{ title: 'A', price_aud: '1', files: [] }]);
    const payload = buildProductPayload(row, [null, 'https://a/2.webp']);
    expect(payload.images).toEqual(['https://a/2.webp']);
    expect(payload.image_url).toBe('https://a/2.webp');
  });
});

describe('chunk', () => {
  it('splits into fixed-size batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 10)).toEqual([]);
  });
});
