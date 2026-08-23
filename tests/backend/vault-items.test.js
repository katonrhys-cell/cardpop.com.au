import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockUserClient = vi.hoisted(() => ({ from: vi.fn() }));
const mockCreateUserClient = vi.hoisted(() => vi.fn(() => mockUserClient));

vi.mock('../../src/utils/userScopedSupabase.js', () => ({
  default: mockCreateUserClient,
  createUserScopedClient: mockCreateUserClient,
}));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
}));

import vaultItemsRouter from '../../src/routes/vault-items.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/items', vaultItemsRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

// A chainable query builder that resolves to `result` at any terminal —
// .single() / .maybeSingle() or a direct await of the chain.
function builder(result = { data: null, error: null }) {
  const b = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'neq']) b[m] = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve(result));
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockUserClient.from.mockReturnValueOnce(b));

const profilesB = (tier = 'free') => builder({ data: { subscription_tier: tier }, error: null });

const VALID_ITEM = {
  card_name: 'Charizard',
  year: '1999',
  category_id: 'cat-1',
  franchise_id: 'fr-1',
  estimated_value_aud: 100,
  listing_type: 'Private',
  card_image: 'u1/123.jpg',
};

const EXISTING = {
  id: '11111111-2222-3333-4444-555555555555',
  owner_id: 'u1',
  card_image: 'u1/old.jpg',
  category_id: 'cat-1',
  franchise_id: 'fr-1',
  locked_base_value_aud: null,
  locked: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateUserClient.mockReturnValue(mockUserClient);
});

// ─── POST /items ──────────────────────────────────────────────────────────────

describe('POST /items', () => {
  it('creates a private card and archives listings', async () => {
    const insertB = builder({ data: { id: 'card-1' }, error: null });
    const archiveB = builder({ error: null });
    const verifyB = builder({ data: [], error: null }); // nothing left un-archived
    queueFrom(profilesB(), insertB, archiveB, verifyB);

    const res = await request(app).post('/items').send({ item: VALID_ITEM });

    expect(res.status).toBe(201);
    expect(res.body.item.id).toBe('card-1');
    expect(res.body.listing.status).toBe('archived');

    const row = insertB.insert.mock.calls[0][0];
    expect(row.owner_id).toBe('u1');
    expect(row.listing_type).toBe('Private');
    expect(row.is_public).toBe(false);
  });

  it('never lets the body choose the owner or locked columns', async () => {
    const insertB = builder({ data: { id: 'card-1' }, error: null });
    queueFrom(profilesB(), insertB, builder({ error: null }));

    await request(app).post('/items').send({
      item: { ...VALID_ITEM, owner_id: 'victim', is_featured: true, locked_base_value_aud: 1 },
    });

    const row = insertB.insert.mock.calls[0][0];
    expect(row.owner_id).toBe('u1');
    expect(row).not.toHaveProperty('is_featured');
    expect(row).not.toHaveProperty('locked_base_value_aud');
  });

  it('returns field-keyed validation errors without touching the DB', async () => {
    queueFrom(profilesB());
    const res = await request(app).post('/items').send({ item: { ...VALID_ITEM, card_name: '' } });

    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('cardName');
    // Only the profiles read happened — no vault_items write.
    expect(mockUserClient.from).toHaveBeenCalledTimes(1);
  });

  it('rejects an image path in another user\'s storage folder', async () => {
    queueFrom(profilesB());
    const res = await request(app).post('/items').send({ item: { ...VALID_ITEM, card_image: 'other/x.jpg' } });
    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('cardImage');
  });

  it('lists a For Sale card and reports the live status', async () => {
    const insertB = builder({ data: { id: 'card-1' }, error: null });
    const findListingB = builder({ data: null, error: null });
    const listingInsertB = builder({ data: { status: 'active' }, error: null });
    queueFrom(profilesB(), insertB, findListingB, listingInsertB);

    const res = await request(app).post('/items').send({
      item: { ...VALID_ITEM, listing_type: 'For Sale' },
      pricing: { askingPrice: 150 },
    });

    expect(res.status).toBe(201);
    expect(res.body.listing.status).toBe('listed');
    const listingRow = listingInsertB.insert.mock.calls[0][0];
    expect(listingRow.price_aud).toBe(150);
    expect(listingRow.listing_type).toBe('fixed');
  });

  it('reports pending when the approval trigger holds the listing', async () => {
    queueFrom(
      profilesB(),
      builder({ data: { id: 'card-1' }, error: null }),
      builder({ data: null, error: null }),
      builder({ data: { status: 'pending' }, error: null }),
    );
    const res = await request(app).post('/items').send({
      item: { ...VALID_ITEM, listing_type: 'For Sale' },
      pricing: { askingPrice: 150 },
    });
    expect(res.body.listing.status).toBe('pending');
  });

  it('saves the card but reports blocked when the selling gate denies the listing', async () => {
    queueFrom(
      profilesB(),
      builder({ data: { id: 'card-1' }, error: null }),
      builder({ data: null, error: null }),
      builder({ data: null, error: { code: '42501', message: 'new row violates row-level security' } }),
    );
    const res = await request(app).post('/items').send({
      item: { ...VALID_ITEM, listing_type: 'For Sale' },
      pricing: { askingPrice: 150 },
    });
    expect(res.status).toBe(201);
    expect(res.body.item.id).toBe('card-1');
    expect(res.body.listing.status).toBe('blocked');
  });

  it('returns 403 when RLS denies the vault insert itself', async () => {
    queueFrom(profilesB(), builder({ data: null, error: { code: '42501', message: 'denied' } }));
    const res = await request(app).post('/items').send({ item: VALID_ITEM });
    expect(res.status).toBe(403);
  });

  it('retries without language when the column is missing from the schema cache', async () => {
    const failB = builder({
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'language' column of 'vault_items' in the schema cache" },
    });
    const retryB = builder({ data: { id: 'card-1' }, error: null });
    queueFrom(profilesB(), failB, retryB, builder({ error: null }));

    const res = await request(app).post('/items').send({ item: { ...VALID_ITEM, language: 'Japanese' } });

    expect(res.status).toBe(201);
    expect(failB.insert.mock.calls[0][0]).toHaveProperty('language', 'Japanese');
    expect(retryB.insert.mock.calls[0][0]).not.toHaveProperty('language');
  });
});

// ─── PUT /items/:id ───────────────────────────────────────────────────────────

describe('PUT /items/:id', () => {
  it('rejects a malformed id', async () => {
    const res = await request(app).put('/items/not-a-uuid').send({ item: VALID_ITEM });
    expect(res.status).toBe(400);
  });

  it('404s when the card is not in the caller\'s vault', async () => {
    queueFrom(builder({ data: null, error: null }));
    const res = await request(app).put(`/items/${EXISTING.id}`).send({ item: VALID_ITEM });
    expect(res.status).toBe(404);
  });

  it('blocks an estimated value below the locked base value', async () => {
    queueFrom(builder({ data: { ...EXISTING, locked_base_value_aud: 500 }, error: null }), profilesB());
    const res = await request(app)
      .put(`/items/${EXISTING.id}`)
      .send({ item: { ...VALID_ITEM, estimated_value_aud: 10 } });
    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('estimatedValue');
  });

  it('updates the card and re-syncs the listing', async () => {
    const updateB = builder({ error: null });
    const findListingB = builder({ data: { id: 'l1' }, error: null });
    const listingUpdateB = builder({ data: { status: 'active' }, error: null });
    queueFrom(builder({ data: EXISTING, error: null }), profilesB(), updateB, findListingB, listingUpdateB);

    const res = await request(app)
      .put(`/items/${EXISTING.id}`)
      .send({ item: { ...VALID_ITEM, listing_type: 'For Trade' }, pricing: {} });

    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe('listed');
    expect(updateB.update.mock.calls[0][0].listing_type).toBe('For Trade');
    // The update is pinned to the caller's ownership.
    expect(updateB.eq).toHaveBeenCalledWith('owner_id', 'u1');
  });

  it('archives the listing when the card goes private', async () => {
    const archiveB = builder({ error: null });
    const verifyB = builder({ data: [], error: null }); // nothing left un-archived
    queueFrom(builder({ data: EXISTING, error: null }), profilesB(), builder({ error: null }), archiveB, verifyB);

    const res = await request(app)
      .put(`/items/${EXISTING.id}`)
      .send({ item: { ...VALID_ITEM, listing_type: 'private' } });

    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe('archived');
    expect(archiveB.update).toHaveBeenCalledWith({ status: 'archived' });
  });

  it('423s a locked card without touching the row', async () => {
    queueFrom(builder({ data: { ...EXISTING, locked: true }, error: null }));
    const res = await request(app)
      .put(`/items/${EXISTING.id}`)
      .send({ item: VALID_ITEM });
    expect(res.status).toBe(423);
    // Only the ownership/lock read happened — no profiles read, no write.
    expect(mockUserClient.from).toHaveBeenCalledTimes(1);
  });
});

// ─── PATCH /items/:id/display-style ──────────────────────────────────────────

describe('PATCH /items/:id/display-style', () => {
  it('rejects a malformed id', async () => {
    const res = await request(app)
      .patch('/items/nope/display-style')
      .send({ displayStyle: 'glass' });
    expect(res.status).toBe(400);
  });

  it('refuses a style above the owner\'s tier without touching the row', async () => {
    queueFrom(profilesB('free'));
    const res = await request(app)
      .patch(`/items/${EXISTING.id}/display-style`)
      .send({ displayStyle: 'holographic' });
    expect(res.status).toBe(403);
    // Only the profiles read happened — no vault_items write.
    expect(mockUserClient.from).toHaveBeenCalledTimes(1);
  });

  it('saves an entitled style, pinned to the caller\'s ownership', async () => {
    const updateB = builder({ data: { id: EXISTING.id }, error: null });
    queueFrom(profilesB('ultimate'), updateB);

    const res = await request(app)
      .patch(`/items/${EXISTING.id}/display-style`)
      .send({ displayStyle: 'holographic' });

    expect(res.status).toBe(200);
    expect(res.body.displayStyle).toBe('holographic');
    expect(updateB.update).toHaveBeenCalledWith({ display_style: 'holographic' });
    expect(updateB.eq).toHaveBeenCalledWith('owner_id', 'u1');
  });

  it('normalizes an unknown style to classic (always allowed)', async () => {
    const updateB = builder({ data: { id: EXISTING.id }, error: null });
    queueFrom(profilesB('free'), updateB);

    const res = await request(app)
      .patch(`/items/${EXISTING.id}/display-style`)
      .send({ displayStyle: 'sparkle-bonanza' });

    expect(res.status).toBe(200);
    expect(res.body.displayStyle).toBe('classic');
    expect(updateB.update).toHaveBeenCalledWith({ display_style: 'classic' });
  });

  it('404s when the card is not in the caller\'s vault', async () => {
    queueFrom(profilesB('pro'), builder({ data: null, error: null }));
    const res = await request(app)
      .patch(`/items/${EXISTING.id}/display-style`)
      .send({ displayStyle: 'neon' });
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /items/:id/lock ────────────────────────────────────────────────────

describe('PATCH /items/:id/lock', () => {
  it('rejects a malformed id', async () => {
    const res = await request(app).patch('/items/nope/lock').send({ locked: true });
    expect(res.status).toBe(400);
  });

  it('rejects a non-boolean body', async () => {
    const res = await request(app).patch(`/items/${EXISTING.id}/lock`).send({ locked: 'yes' });
    expect(res.status).toBe(400);
  });

  it('404s when the card is not in the caller\'s vault', async () => {
    queueFrom(builder({ data: null, error: null }));
    const res = await request(app).patch(`/items/${EXISTING.id}/lock`).send({ locked: true });
    expect(res.status).toBe(404);
  });

  it('locks an unlocked card, pinned to the caller\'s ownership', async () => {
    const updateB = builder({ error: null });
    queueFrom(builder({ data: { id: EXISTING.id, locked: false }, error: null }), updateB);

    const res = await request(app).patch(`/items/${EXISTING.id}/lock`).send({ locked: true });

    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
    expect(updateB.update).toHaveBeenCalledWith({ locked: true });
    expect(updateB.eq).toHaveBeenCalledWith('owner_id', 'u1');
  });

  it('unlocks a locked card', async () => {
    const updateB = builder({ error: null });
    queueFrom(builder({ data: { id: EXISTING.id, locked: true }, error: null }), updateB);

    const res = await request(app).patch(`/items/${EXISTING.id}/lock`).send({ locked: false });

    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(false);
    expect(updateB.update).toHaveBeenCalledWith({ locked: false });
  });

  it('is a no-op when already in the requested state, without writing', async () => {
    queueFrom(builder({ data: { id: EXISTING.id, locked: true }, error: null }));

    const res = await request(app).patch(`/items/${EXISTING.id}/lock`).send({ locked: true });

    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
    // Only the ownership read happened — no write attempted.
    expect(mockUserClient.from).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when RLS denies the update', async () => {
    queueFrom(
      builder({ data: { id: EXISTING.id, locked: false }, error: null }),
      builder({ data: null, error: { code: '42501', message: 'denied' } }),
    );
    const res = await request(app).patch(`/items/${EXISTING.id}/lock`).send({ locked: true });
    expect(res.status).toBe(403);
  });
});

