import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockRunEventScan = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/eventScanner.js', () => ({ runEventScan: mockRunEventScan }));

const mockRunDueWatches = vi.hoisted(() => vi.fn());
const mockScanEventSource = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/eventSourceWatcher.js', () => ({
  runDueEventSourceScans: mockRunDueWatches,
  scanEventSource: mockScanEventSource,
}));

const mockGetUser = vi.hoisted(() => vi.fn());
const mockProfileLookup = vi.hoisted(() => vi.fn());
const mockRunsLookup = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: {
    auth: {
      getUser: mockGetUser,
      admin: { mfa: { listFactors: async () => ({ data: { factors: [] }, error: null }) } },
    },
    from: (table) => {
      const query = {
        select: () => query,
        eq: () => query,
        gte: () => query,
        limit: () => Promise.resolve(mockRunsLookup()),
        maybeSingle: () => Promise.resolve(mockProfileLookup()),
      };
      if (table === 'profiles') return query;
      return query;
    },
  },
}));

const { default: handler } = await import('../../api/event-scan.js');

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
  };
  return res;
}

const call = (authorization, query) => {
  const res = mockRes();
  return handler({ headers: authorization ? { authorization } : {}, query }, res).then(() => res);
};

const EVENT_ID = '11111111-2222-3333-4444-555555555555';

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'super-secret';
  mockRunEventScan.mockResolvedValue({ runId: 'run-1', eventsCreated: 2 });
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  mockProfileLookup.mockReturnValue({ data: null, error: null });
  mockRunsLookup.mockReturnValue({ data: [], error: null });
  mockRunDueWatches.mockResolvedValue({ due: 1, scanned: 1, results: [] });
  mockScanEventSource.mockResolvedValue({ eventId: EVENT_ID, status: 'updated' });
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe('POST /cron/event-scan', () => {
  it('runs the scan for Vercel Cron with the right bearer', async () => {
    const res = await call('Bearer super-secret');

    expect(res.statusCode).toBe(200);
    expect(mockRunEventScan).toHaveBeenCalledWith({ trigger: 'cron', triggeredBy: null });
    expect(res.body.eventsCreated).toBe(2);
  });

  it('rejects a wrong secret', async () => {
    const res = await call('Bearer wrong');

    expect(res.statusCode).toBe(401);
    expect(mockRunEventScan).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await call();

    expect(res.statusCode).toBe(401);
    expect(mockRunEventScan).not.toHaveBeenCalled();
  });

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;

    const res = await call('Bearer super-secret');

    expect(res.statusCode).toBe(401);
    expect(mockRunEventScan).not.toHaveBeenCalled();
  });

  it('lets a signed-in admin start a manual run', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-1', app_metadata: { is_admin: true } } },
      error: null,
    });

    const res = await call('Bearer admin-access-token');

    expect(res.statusCode).toBe(200);
    expect(mockRunEventScan).toHaveBeenCalledWith({ trigger: 'manual', triggeredBy: 'admin-1' });
  });

  it('falls back to the profiles table when the JWT carries no admin claim', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-2', app_metadata: {} } }, error: null });
    mockProfileLookup.mockReturnValue({ data: { is_admin: true }, error: null });

    const res = await call('Bearer admin-access-token');

    expect(res.statusCode).toBe(200);
    expect(mockRunEventScan).toHaveBeenCalledWith({ trigger: 'manual', triggeredBy: 'admin-2' });
  });

  it('rejects a signed-in non-admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', app_metadata: {} } }, error: null });
    mockProfileLookup.mockReturnValue({ data: { is_admin: false }, error: null });

    const res = await call('Bearer user-access-token');

    expect(res.statusCode).toBe(401);
    expect(mockRunEventScan).not.toHaveBeenCalled();
  });

  it('refuses a second manual run while one is still in flight', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-1', app_metadata: { is_admin: true } } },
      error: null,
    });
    mockRunsLookup.mockReturnValue({ data: [{ id: 'run-in-flight' }], error: null });

    const res = await call('Bearer admin-access-token');

    expect(res.statusCode).toBe(409);
    expect(mockRunEventScan).not.toHaveBeenCalled();
  });

  it('returns 502 without leaking the underlying error', async () => {
    mockRunEventScan.mockRejectedValue(new Error('ANTHROPIC_API_KEY is not set'));

    const res = await call('Bearer super-secret');

    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('ANTHROPIC_API_KEY');
  });
});

describe('/cron/event-scan?mode=watches', () => {
  const asAdmin = () => mockGetUser.mockResolvedValue({
    data: { user: { id: 'admin-1', app_metadata: { is_admin: true } } },
    error: null,
  });

  it('runs the due event-website re-scans for the daily cron, not discovery', async () => {
    const res = await call('Bearer super-secret', { mode: 'watches' });

    expect(res.statusCode).toBe(200);
    expect(mockRunDueWatches).toHaveBeenCalledTimes(1);
    expect(mockRunEventScan).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated re-scan', async () => {
    const res = await call(undefined, { mode: 'watches', event: EVENT_ID });

    expect(res.statusCode).toBe(401);
    expect(mockScanEventSource).not.toHaveBeenCalled();
  });

  it('lets an admin scan one event now, bypassing the unchanged-page shortcut', async () => {
    asAdmin();

    const res = await call('Bearer admin-access-token', { mode: 'watches', event: EVENT_ID });

    expect(res.statusCode).toBe(200);
    expect(mockScanEventSource).toHaveBeenCalledWith(EVENT_ID, { force: true });
  });

  it('is not blocked by an in-flight discovery run', async () => {
    asAdmin();
    mockRunsLookup.mockReturnValue({ data: [{ id: 'run-in-flight' }], error: null });

    const res = await call('Bearer admin-access-token', { mode: 'watches', event: EVENT_ID });

    expect(res.statusCode).toBe(200);
  });

  it('rejects a malformed event id', async () => {
    asAdmin();

    const res = await call('Bearer admin-access-token', { mode: 'watches', event: 'not-a-uuid' });

    expect(res.statusCode).toBe(400);
    expect(mockScanEventSource).not.toHaveBeenCalled();
  });

  it('answers 409 while the same page is already being scanned', async () => {
    asAdmin();
    mockScanEventSource.mockResolvedValue({ eventId: EVENT_ID, status: 'busy' });

    const res = await call('Bearer admin-access-token', { mode: 'watches', event: EVENT_ID });

    expect(res.statusCode).toBe(409);
  });
});
