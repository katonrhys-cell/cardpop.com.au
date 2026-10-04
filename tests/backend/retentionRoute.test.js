import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const sweep = vi.hoisted(() => ({ run: vi.fn(async () => ({ abandonedCheckouts: { emailed: 1 } })) }));
vi.mock('../../src/services/retentionSweepService.js', () => ({ runRetentionSweep: sweep.run }));

import retentionRouter from '../../src/routes/retention.js';

const app = express();
app.use('/retention', retentionRouter);

beforeEach(() => { vi.clearAllMocks(); delete process.env.CRON_SECRET; });

describe('GET /retention/sweep (cron)', () => {
  it('fails closed when CRON_SECRET is unset', async () => {
    const res = await request(app).get('/retention/sweep').set('Authorization', 'Bearer anything');
    expect(res.status).toBe(401);
    expect(sweep.run).not.toHaveBeenCalled();
  });
  it('401s a wrong bearer and runs with the right one', async () => {
    process.env.CRON_SECRET = 's3cret';
    expect((await request(app).get('/retention/sweep').set('Authorization', 'Bearer nope')).status).toBe(401);
    const res = await request(app).get('/retention/sweep').set('Authorization', 'Bearer s3cret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ abandonedCheckouts: { emailed: 1 } });
  });
});
