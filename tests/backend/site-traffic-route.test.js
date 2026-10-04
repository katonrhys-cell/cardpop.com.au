import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockSync = vi.hoisted(() => vi.fn());
class Ga4NotConfiguredError extends Error {}
vi.mock('../../src/services/siteTrafficService.js', () => ({ syncSiteTraffic: mockSync, Ga4NotConfiguredError }));

const { default: router } = await import('../../src/routes/site-traffic.js');
const app = express().use('/site-traffic', router);

const originalSecret = process.env.CRON_SECRET;

describe('GET /site-traffic/sync', () => {
  beforeEach(() => {
    mockSync.mockReset();
    process.env.CRON_SECRET = 'cron-test-secret';
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it('refuses without the cron bearer', async () => {
    const res = await request(app).get('/site-traffic/sync');
    expect(res.status).toBe(401);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('refuses a wrong bearer', async () => {
    const res = await request(app).get('/site-traffic/sync').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    const res = await request(app).get('/site-traffic/sync').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('runs the sync and returns its summary', async () => {
    mockSync.mockResolvedValue({ days: 90, visitors_30d: 4210, visitors_all_time: 15300 });
    const res = await request(app).get('/site-traffic/sync').set('Authorization', 'Bearer cron-test-secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ days: 90, visitors_30d: 4210, visitors_all_time: 15300 });
  });

  it('answers 503 when GA4 is not configured', async () => {
    mockSync.mockRejectedValue(new Ga4NotConfiguredError('GA4 is not configured'));
    const res = await request(app).get('/site-traffic/sync').set('Authorization', 'Bearer cron-test-secret');
    expect(res.status).toBe(503);
  });

  it('answers 502 when the sync throws', async () => {
    mockSync.mockRejectedValue(new Error('ga4 down'));
    const res = await request(app).get('/site-traffic/sync').set('Authorization', 'Bearer cron-test-secret');
    expect(res.status).toBe(502);
  });
});
