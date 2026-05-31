import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockPb = vi.hoisted(() => ({
  collection: vi.fn(),
  authStore: { save: vi.fn(), record: { id: 'user-123', email: 'test@example.com' } },
  send: vi.fn(),
}));

const mockParseUserAgent = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/pocketbaseClient.js', () => ({ default: mockPb }));
vi.mock('../../../src/utils/deviceParser.js', () => ({ parseUserAgent: mockParseUserAgent }));
vi.mock('../../../src/utils/logger.js', () => ({ default: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import securityRouter from '../../../src/routes/auth/security.js';

const AUTH = { Authorization: 'Bearer test-token' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', securityRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

function makeAuditCollection(overrides = {}) {
  return { getFullList: vi.fn().mockResolvedValue([]), ...overrides };
}

function makeAlertsCollection(overrides = {}) {
  return {
    getFullList: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'alert-1' }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.authStore.record = { id: 'user-123', email: 'test@example.com' };
  // Default: both current and prior devices are Chrome/Windows (no new_device alert)
  mockParseUserAgent.mockReturnValue({ browser: 'Chrome', os: 'Windows', device: 'desktop' });
  mockPb.collection.mockReturnValue(makeAuditCollection());
});

// ─── POST /suspicious-activity/check ─────────────────────────────────────────

describe('POST /suspicious-activity/check', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app)
      .post('/suspicious-activity/check')
      .send({ ipAddress: '1.2.3.4' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId and ipAddress/i);
  });

  it('returns 400 when ipAddress is missing', async () => {
    const res = await request(app)
      .post('/suspicious-activity/check')
      .send({ userId: 'user-1' });
    expect(res.status).toBe(400);
  });

  it('returns suspicious:false with empty alerts when no prior logins exist', async () => {
    // No prior logins → the conditions include "recentLogins.length > 0" guard
    const res = await request(app)
      .post('/suspicious-activity/check')
      .send({ userId: 'user-1', ipAddress: '1.2.3.4' });
    expect(res.status).toBe(200);
    expect(res.body.suspicious).toBe(false);
    expect(res.body.alerts).toHaveLength(0);
  });

  it('returns suspicious:false when IP and device both match prior logins', async () => {
    mockPb.collection.mockReturnValue(makeAuditCollection({
      getFullList: vi.fn().mockResolvedValue([
        { ipAddress: '1.2.3.4', userAgent: 'Chrome/Windows' },
      ]),
    }));
    const res = await request(app)
      .post('/suspicious-activity/check')
      .send({ userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'Chrome/Windows' });
    expect(res.body.suspicious).toBe(false);
    expect(res.body.alerts).toHaveLength(0);
  });

  it('detects a new_ip alert when the IP has not been seen before', async () => {
    const alertsCol = makeAlertsCollection();
    mockPb.collection.mockImplementation((name) => {
      if (name === 'auditLogs') {
        return makeAuditCollection({
          getFullList: vi.fn().mockResolvedValue([
            { ipAddress: '9.9.9.9', userAgent: 'Chrome' },
          ]),
        });
      }
      return alertsCol;
    });
    const res = await request(app)
      .post('/suspicious-activity/check')
      .send({ userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'Chrome' });
    expect(res.body.suspicious).toBe(true);
    expect(res.body.alerts.find(a => a.type === 'new_ip')).toBeDefined();
  });

  it('detects a new_device alert when browser/os differs from prior logins', async () => {
    // First call → current device (Firefox/Linux), subsequent → prior device (Chrome/Windows)
    mockParseUserAgent
      .mockReturnValueOnce({ browser: 'Firefox', os: 'Linux', device: 'desktop' })
      .mockReturnValue({ browser: 'Chrome', os: 'Windows', device: 'desktop' });

    const alertsCol = makeAlertsCollection();
    mockPb.collection.mockImplementation((name) => {
      if (name === 'auditLogs') {
        return makeAuditCollection({
          // Same IP so no new_ip alert — only device differs
          getFullList: vi.fn().mockResolvedValue([
            { ipAddress: '1.2.3.4', userAgent: 'Chrome/Windows' },
          ]),
        });
      }
      return alertsCol;
    });
    const res = await request(app)
      .post('/suspicious-activity/check')
      .send({ userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'Firefox/Linux' });
    expect(res.body.suspicious).toBe(true);
    expect(res.body.alerts.find(a => a.type === 'new_device')).toBeDefined();
  });

  it('creates a securityAlert record when an alert is detected', async () => {
    const alertsCol = makeAlertsCollection();
    mockPb.collection.mockImplementation((name) => {
      if (name === 'auditLogs') {
        return makeAuditCollection({
          getFullList: vi.fn().mockResolvedValue([
            { ipAddress: '9.9.9.9', userAgent: 'Chrome' },
          ]),
        });
      }
      return alertsCol;
    });
    await request(app)
      .post('/suspicious-activity/check')
      .send({ userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'Chrome' });
    expect(alertsCol.create).toHaveBeenCalledOnce();
    expect(alertsCol.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', ipAddress: '1.2.3.4' }),
    );
  });

  it('does not create a securityAlert record when no alerts are detected', async () => {
    const alertsCol = makeAlertsCollection();
    mockPb.collection.mockImplementation(() => {
      // Only auditLogs collection is called here; securityAlerts should NOT be called
      return makeAuditCollection({ getFullList: vi.fn().mockResolvedValue([]) });
    });
    await request(app)
      .post('/suspicious-activity/check')
      .send({ userId: 'user-1', ipAddress: '1.2.3.4' });
    expect(alertsCol.create).not.toHaveBeenCalled();
  });
});

// ─── GET /alerts ──────────────────────────────────────────────────────────────

describe('GET /alerts', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/alerts');
    expect(res.status).toBe(401);
  });

  it('returns a mapped list of alerts for the authenticated user', async () => {
    mockPb.collection.mockReturnValue(makeAlertsCollection({
      getFullList: vi.fn().mockResolvedValue([
        {
          id: 'alert-1',
          alertType: 'new_ip',
          severity: 'medium',
          description: 'Login from a new IP address',
          ipAddress: '1.2.3.4',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ]),
    }));
    const res = await request(app).get('/alerts').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.alerts).toHaveLength(1);
    const alert = res.body.alerts[0];
    expect(alert.id).toBe('alert-1');
    expect(alert.type).toBe('new_ip');
    expect(alert.severity).toBe('medium');
    expect(alert.read).toBe(false);
  });

  it('returns an empty alerts array when there are no alerts', async () => {
    mockPb.collection.mockReturnValue(makeAlertsCollection());
    const res = await request(app).get('/alerts').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual([]);
  });

  it('does not expose raw alertType field — maps it to type', async () => {
    mockPb.collection.mockReturnValue(makeAlertsCollection({
      getFullList: vi.fn().mockResolvedValue([
        { id: 'a1', alertType: 'new_ip', severity: 'medium', description: 'd', ipAddress: '1.1.1.1', read: false, createdAt: new Date().toISOString() },
      ]),
    }));
    const res = await request(app).get('/alerts').set(AUTH);
    expect(res.body.alerts[0]).not.toHaveProperty('alertType');
    expect(res.body.alerts[0]).toHaveProperty('type');
  });
});

// ─── POST /alerts/mark-read ───────────────────────────────────────────────────

describe('POST /alerts/mark-read', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/alerts/mark-read').send({ alertId: 'alert-1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when alertId is missing', async () => {
    const res = await request(app).post('/alerts/mark-read').send({}).set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/alertId/i);
  });

  it('marks the alert as read and returns success', async () => {
    const col = makeAlertsCollection();
    mockPb.collection.mockReturnValue(col);
    const res = await request(app).post('/alerts/mark-read').send({ alertId: 'alert-1' }).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(col.update).toHaveBeenCalledWith('alert-1', { read: true });
  });
});
