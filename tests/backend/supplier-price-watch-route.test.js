import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockRun = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/supplierPriceWatchService.js', () => ({ runSupplierPriceWatch: mockRun }));

const { default: router } = await import('../../src/routes/shop-supplier-watch.js');
const app = express().use('/shop-supplier-watch', router);

const originalSecret = process.env.CRON_SECRET;

describe('GET /shop-supplier-watch/run', () => {
  beforeEach(() => {
    mockRun.mockReset();
    process.env.CRON_SECRET = 'cron-test-secret';
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it('refuses without the cron bearer', async () => {
    const res = await request(app).get('/shop-supplier-watch/run');
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('refuses a wrong bearer', async () => {
    const res = await request(app).get('/shop-supplier-watch/run').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    const res = await request(app).get('/shop-supplier-watch/run').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('runs the watch and returns the summary without per-product detail', async () => {
    mockRun.mockResolvedValue({ checked: 5, changed: 1, unreadable: 0, errors: 0, skipped: 0, notified: 2, results: [{ productId: 'x' }] });
    const res = await request(app).get('/shop-supplier-watch/run').set('Authorization', 'Bearer cron-test-secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ checked: 5, changed: 1, unreadable: 0, errors: 0, skipped: 0, notified: 2 });
  });

  it('answers 502 when the run throws', async () => {
    mockRun.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/shop-supplier-watch/run').set('Authorization', 'Bearer cron-test-secret');
    expect(res.status).toBe(502);
  });
});
