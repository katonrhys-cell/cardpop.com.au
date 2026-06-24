import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), storage: { from: vi.fn() } }));
const mockCreateSlab = vi.hoisted(() => vi.fn());
const mockCompress = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({ uploadError: null, publicUrl: 'https://cdn/vault-images/out.webp' }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/imageProcessor.js', () => ({ createSlabImage: mockCreateSlab, compressImage: mockCompress }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../src/middleware/auth.js', () => ({ authMiddleware: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));

import photoTemplateRouter from '../../src/routes/photo-template.js';

function makeApp() {
  const app = express();
  app.use('/', photoTemplateRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn(() => b), update: vi.fn(() => b), eq: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => {
  vi.clearAllMocks();
  store.uploadError = null;
  mockCreateSlab.mockResolvedValue(Buffer.from('slab'));
  mockCompress.mockResolvedValue(Buffer.from('compressed'));
  mockSupabase.storage.from.mockReturnValue({
    upload: vi.fn(() => Promise.resolve({ error: store.uploadError })),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: store.publicUrl } })),
  });
});

const IMG = Buffer.from('fake-image-bytes');

// ─── POST /slab-image ─────────────────────────────────────────────────────────

describe('POST /slab-image', () => {
  it('returns 400 when no image is attached', async () => {
    const res = await request(app).post('/slab-image').field('vaultItemId', 'v1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no image/i);
  });

  it('returns 400 when vaultItemId is missing', async () => {
    const res = await request(app).post('/slab-image').attach('image', IMG, 'card.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/vaultItemId is required/i);
  });

  it('returns 404 when the vault item does not exist', async () => {
    queueFrom(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/slab-image').attach('image', IMG, 'card.jpg').field('vaultItemId', 'v1');
    expect(res.status).toBe(404);
  });

  it('returns 403 when the caller does not own the vault item', async () => {
    queueFrom(makeBuilder({ data: { id: 'v1', owner_id: 'someone-else' }, error: null }));
    const res = await request(app).post('/slab-image').attach('image', IMG, 'card.jpg').field('vaultItemId', 'v1');
    expect(res.status).toBe(403);
  });

  it('creates, compresses, uploads and links the slab image', async () => {
    queueFrom(
      makeBuilder({ data: { id: 'v1', owner_id: 'u1', card_image: null }, error: null }), // ownership fetch
      makeBuilder({ error: null }), // vault_items update
    );
    const res = await request(app).post('/slab-image').attach('image', IMG, 'card.jpg').field('vaultItemId', 'v1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imageUrl).toBe(store.publicUrl);
    expect(res.body.fileName).toMatch(/^template-v1-\d+\.webp$/);
    expect(mockCreateSlab).toHaveBeenCalledTimes(1);
    expect(mockCompress).toHaveBeenCalledWith(Buffer.from('slab'), 85);
  });

  it('returns 500 when the storage upload fails', async () => {
    store.uploadError = { message: 'storage down' };
    queueFrom(makeBuilder({ data: { id: 'v1', owner_id: 'u1' }, error: null }));
    const res = await request(app).post('/slab-image').attach('image', IMG, 'card.jpg').field('vaultItemId', 'v1');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to upload/i);
  });

  it('returns 500 when the vault item update fails', async () => {
    queueFrom(
      makeBuilder({ data: { id: 'v1', owner_id: 'u1' }, error: null }),
      makeBuilder({ error: { message: 'update failed' } }),
    );
    const res = await request(app).post('/slab-image').attach('image', IMG, 'card.jpg').field('vaultItemId', 'v1');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to update/i);
  });
});

// ─── POST /validate-image ─────────────────────────────────────────────────────

describe('POST /validate-image', () => {
  it('returns 400 when no image is attached', async () => {
    const res = await request(app).post('/validate-image');
    expect(res.status).toBe(400);
  });

  it('echoes the uploaded file size and mimetype', async () => {
    const res = await request(app).post('/validate-image').attach('image', IMG, 'card.png');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.size).toBe(IMG.length);
    expect(res.body.mimetype).toBe('image/png');
  });
});
