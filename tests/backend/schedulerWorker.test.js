import { describe, it, expect, vi } from 'vitest';
import {
  JOBS, SCHEDULES, scheduleForCron, callJob, runSchedule, sendFailureAlert, createHandlers, safeEqual,
} from '../../cloudflare/scheduler/worker.js';

const SECRET = 'test-cron-secret';
const env = { CRON_SECRET: SECRET };
const noSleep = async () => {};

// A fetch stub answering each endpoint from a map of status (or a list of
// statuses, one per attempt). Records every call.
const fetchStub = (answers) => {
  const calls = [];
  const fetch = vi.fn(async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname + new URL(url).search;
    let answer = answers[path] ?? answers['*'] ?? 200;
    if (Array.isArray(answer)) answer = answer.shift() ?? 200;
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify({ path }), { status: answer, headers: { 'content-type': 'application/json' } });
  });
  return { fetch, calls };
};

describe('cloudflare/scheduler SCHEDULES', () => {
  it('covers the four Actions schedules it replaced, at the same UTC times', () => {
    const byKey = Object.fromEntries(SCHEDULES.map((s) => [s.key, s]));
    expect(byKey.reconcile.cron).toBe('15 */2 * * *');
    expect(byKey.daily.cron).toBe('23 19 * * *');
    expect(byKey.blog.cron).toBe('7 21 * * *');
    expect(byKey['event-scan'].cron).toBe('7 17 * * SUN');
    expect(byKey.daily.jobs).toEqual(['site_traffic', 'prices', 'event_watch', 'supplier_watch', 'delivery_sweep', 'retention_sweep']);
    // Every scheduled job exists, and every job is on some schedule.
    const scheduled = new Set(SCHEDULES.flatMap((s) => s.jobs));
    for (const name of scheduled) expect(JOBS[name]).toBeTruthy();
    for (const name of Object.keys(JOBS)) expect(scheduled.has(name)).toBe(true);
  });

  it('keeps the wrangler.toml cron list in step with SCHEDULES', async () => {
    const fs = await import('node:fs');
    const toml = fs.readFileSync(new URL('../../cloudflare/scheduler/wrangler.toml', import.meta.url), 'utf8');
    const crons = [...toml.matchAll(/^\s*"([^"]+)",?\s*(?:#.*)?$/gm)].map((m) => m[1]);
    expect(crons.sort()).toEqual(SCHEDULES.map((s) => s.cron).sort());
  });

  it('never retries a job that spends on a model call', () => {
    for (const name of ['blog_generate', 'event_scan', 'event_watch']) expect(JOBS[name].attempts).toBe(1);
    // 300 s functions get a timeout that outlasts them.
    for (const name of ['blog_generate', 'event_scan', 'event_watch']) expect(JOBS[name].maxSeconds).toBeGreaterThan(300);
  });

  it('matches the cron the runtime hands it, tolerating whitespace', () => {
    expect(scheduleForCron('15 */2 * * *').key).toBe('reconcile');
    expect(scheduleForCron('  7  21 * * *  ').key).toBe('blog');
    expect(scheduleForCron('0 0 * * *')).toBeNull();
  });
});

describe('callJob', () => {
  it('sends the bearer, accept header and scheduler user-agent to the production endpoint', async () => {
    const { fetch, calls } = fetchStub({});
    const result = await callJob('prices', env, { fetch, sleep: noSleep });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.attempts).toBe(1);
    expect(calls[0].url).toBe('https://cardpop.com.au/api/prices/refresh');
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(calls[0].init.headers['User-Agent']).toMatch(/^CardPop-Scheduler\//);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('honours BASE_URL so the jobs can be pointed at a preview deployment', async () => {
    const { fetch, calls } = fetchStub({});
    await callJob('prices', { ...env, BASE_URL: 'https://preview.example.com/' }, { fetch, sleep: noSleep });
    expect(calls[0].url).toBe('https://preview.example.com/api/prices/refresh');
  });

  it('retries a 5xx once for a two-attempt job and reports the recovery', async () => {
    const { fetch } = fetchStub({ '/api/orders/delivery-sweep': [503, 200] });
    const result = await callJob('delivery_sweep', env, { fetch, sleep: noSleep });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('never retries a rejected credential', async () => {
    const { fetch } = fetchStub({ '/api/orders/delivery-sweep': 401 });
    const result = await callJob('delivery_sweep', env, { fetch, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/CRON_SECRET/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never retries a single-attempt job even on a network error', async () => {
    const { fetch } = fetchStub({ '/cron/blog-generate': new Error('socket hang up') });
    const result = await callJob('blog_generate', env, { fetch, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('socket hang up');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed without a CRON_SECRET and never calls out', async () => {
    const { fetch } = fetchStub({});
    const result = await callJob('prices', {}, { fetch, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/CRON_SECRET is not set/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('runSchedule', () => {
  it('runs every daily job and names the ones that failed without blocking the rest', async () => {
    const daily = SCHEDULES.find((s) => s.key === 'daily');
    const { fetch, calls } = fetchStub({ '/api/retention/sweep': 500, '/cron/event-scan?mode=watches': 503 });
    const report = await runSchedule(daily, env, { fetch, sleep: noSleep });
    expect(report.ok).toBe(false);
    expect(report.failed.sort()).toEqual(['event_watch', 'retention_sweep']);
    expect(report.results).toHaveLength(6);
    const paths = calls.map((c) => new URL(c.url).pathname + new URL(c.url).search);
    for (const name of daily.jobs) expect(paths).toContain(JOBS[name].endpoint);
  });
});

describe('sendFailureAlert', () => {
  const failedReport = {
    schedule: 'reconcile', name: 'Reconcile pending payments', cron: '15 */2 * * *', startedAt: '2026-10-31T01:15:00.000Z',
    ok: false, failed: ['reconcile_pending'],
    results: [{ job: 'reconcile_pending', endpoint: '/api/stripe/reconcile-pending', ok: false, status: 500, error: 'HTTP 500', body: '{"error":"boom"}' }],
  };

  it('does nothing until an address and a Resend key are configured', async () => {
    const { fetch } = fetchStub({});
    const out = await sendFailureAlert(failedReport, env, { fetch });
    expect(out.sent).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('emails the failure through Resend and suppresses repeats via KV', async () => {
    const store = new Map();
    const STATE = {
      get: vi.fn(async (k) => store.get(k) ?? null),
      put: vi.fn(async (k, v) => { store.set(k, v); }),
    };
    const alertEnv = { ...env, ALERT_EMAIL: 'admin@cardpop.com.au', RESEND_API_KEY: 're_test', STATE };
    const { fetch, calls } = fetchStub({ '/emails': 200 });

    expect((await sendFailureAlert(failedReport, alertEnv, { fetch })).sent).toBe(true);
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    const sent = JSON.parse(calls[0].init.body);
    expect(sent.to).toEqual(['admin@cardpop.com.au']);
    expect(sent.subject).toContain('Reconcile pending payments');
    expect(sent.text).toContain('reconcile_pending');
    expect(sent.text).not.toContain(SECRET);
    expect(STATE.put).toHaveBeenCalledWith('alert:reconcile', failedReport.startedAt, expect.objectContaining({ expirationTtl: expect.any(Number) }));

    expect((await sendFailureAlert(failedReport, alertEnv, { fetch })).reason).toBe('suppressed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('handlers', () => {
  it('scheduled(): runs the schedule for the firing cron and throws on failure after alerting', async () => {
    const { fetch } = fetchStub({ '/api/stripe/reconcile-pending': 500 });
    const handlers = createHandlers({ fetch, sleep: noSleep });
    const waits = [];
    const ctx = { waitUntil: (p) => waits.push(p) };
    const alertEnv = { ...env, ALERT_EMAIL: 'admin@cardpop.com.au', RESEND_API_KEY: 're_test' };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(handlers.scheduled({ cron: '15 */2 * * *' }, alertEnv, ctx)).rejects.toThrow(/reconcile_pending/);
    await Promise.all(waits);
    expect(fetch.mock.calls.some(([url]) => url === 'https://api.resend.com/emails')).toBe(true);
    vi.restoreAllMocks();
  });

  it('scheduled(): resolves quietly when every job succeeds', async () => {
    const { fetch } = fetchStub({});
    const handlers = createHandlers({ fetch, sleep: noSleep });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(handlers.scheduled({ cron: '7 21 * * *' }, env, { waitUntil() {} })).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://cardpop.com.au/cron/blog-generate');
    vi.restoreAllMocks();
  });

  it('scheduled(): refuses a cron it has no schedule for', async () => {
    const handlers = createHandlers({ fetch: fetchStub({}).fetch, sleep: noSleep });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(handlers.scheduled({ cron: '0 0 * * *' }, env, {})).rejects.toThrow(/No schedule for cron/);
    vi.restoreAllMocks();
  });

  it('fetch(): health check is open, manual runs need the CRON_SECRET bearer', async () => {
    const { fetch, calls } = fetchStub({});
    const handlers = createHandlers({ fetch, sleep: noSleep });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const health = await handlers.fetch(new Request('https://sched.example.workers.dev/'), env);
    expect(health.status).toBe(200);
    expect(await health.text()).toContain('ok');

    const anon = await handlers.fetch(new Request('https://sched.example.workers.dev/run/daily', { method: 'POST' }), env);
    expect(anon.status).toBe(401);
    const wrong = await handlers.fetch(new Request('https://sched.example.workers.dev/run/daily', { method: 'POST', headers: { authorization: 'Bearer nope' } }), env);
    expect(wrong.status).toBe(401);
    const get = await handlers.fetch(new Request('https://sched.example.workers.dev/run/daily', { headers: { authorization: `Bearer ${SECRET}` } }), env);
    expect(get.status).toBe(405);
    expect(calls).toHaveLength(0);

    const ok = await handlers.fetch(new Request('https://sched.example.workers.dev/run/daily', { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }), env);
    expect(ok.status).toBe(200);
    const report = await ok.json();
    expect(report.schedule).toBe('daily');
    expect(report.results).toHaveLength(6);

    // A single job by name, and an unknown target.
    const one = await handlers.fetch(new Request('https://sched.example.workers.dev/run/prices', { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }), env);
    expect((await one.json()).results.map((r) => r.job)).toEqual(['prices']);
    const unknown = await handlers.fetch(new Request('https://sched.example.workers.dev/run/nope', { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }), env);
    expect(unknown.status).toBe(404);
    vi.restoreAllMocks();
  });

  it('fetch(): a failed manual run answers 502 with the report', async () => {
    const { fetch } = fetchStub({ '/cron/event-scan': 500 });
    const handlers = createHandlers({ fetch, sleep: noSleep });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await handlers.fetch(new Request('https://sched.example.workers.dev/run/event-scan', { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }), env);
    expect(res.status).toBe(502);
    expect((await res.json()).failed).toEqual(['event_scan']);
    vi.restoreAllMocks();
  });

  it('safeEqual compares in constant shape', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
    expect(safeEqual(undefined, 'abc')).toBe(false);
  });
});
