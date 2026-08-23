import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import listingStatsRouter from '../../src/routes/listing-stats.js';

const app = express();
app.use('/', listingStatsRouter);

const LISTING_ID = '4d1f0a52-9f6e-4a37-8f0e-1c2b3d4e5f60';

function queueCount(result) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
  };
  mockSupabase.from.mockReturnValueOnce(builder);
  return builder;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /:listingId/watchers', () => {
  it('returns the watcher count', async () => {
    queueCount({ count: 7, error: null });
    const res = await request(app).get(`/${LISTING_ID}/watchers`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ watchers: 7 });
  });

  it('returns 0 when the count is null', async () => {
    queueCount({ count: null, error: null });
    const res = await request(app).get(`/${LISTING_ID}/watchers`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ watchers: 0 });
  });

  it('rejects a non-UUID listing id without querying', async () => {
    const res = await request(app).get('/not-a-uuid/watchers');
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 500 when the query errors', async () => {
    queueCount({ count: null, error: new Error('db down') });
    const res = await request(app).get(`/${LISTING_ID}/watchers`);
    expect(res.status).toBe(500);
  });
});
