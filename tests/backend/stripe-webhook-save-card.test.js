import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Regression tests for the "save a card on file" webhook branch
// (checkout.session.completed with mode 'setup'). has_saved_card gates selling
// and trading via can_sell(), so a silently-failed mirror locks the seller out
// of listing with no error anywhere: the webhook must fail loudly (500 → Stripe
// redelivers) and must repoint stripe_customer_id at the Customer the card was
// actually attached to, or the /wallet/payment-methods self-heal reads the
// wrong Customer and flips the flag back off.

const mockStripe = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
  customers: { retrieve: vi.fn() },
  transfers: { create: vi.fn() },
  refunds: { create: vi.fn() },
}));

vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));

vi.mock('../../src/utils/emailService.js', () => ({
  sendOrderConfirmed: vi.fn().mockResolvedValue(undefined),
  sendItemSold: vi.fn().mockResolvedValue(undefined),
  sendRefundProcessed: vi.fn().mockResolvedValue(undefined),
  sendRefundIssued: vi.fn().mockResolvedValue(undefined),
}));

const dbCalls = vi.hoisted(() => []);
const state = vi.hoisted(() => ({ respond: () => ({ data: null, error: null }) }));

vi.mock('../../src/utils/supabaseClient.js', () => {
  function makeBuilder(table) {
    const ctx = { table, op: 'select', single: false, cols: null, filters: {}, payload: null };
    const exec = () => {
      dbCalls.push({ table: ctx.table, op: ctx.op, single: ctx.single, cols: ctx.cols, filters: ctx.filters, payload: ctx.payload });
      return Promise.resolve(state.respond(ctx));
    };
    const builder = {
      select(cols) { ctx.cols = cols; return builder; },
      insert(payload) { ctx.op = 'insert'; ctx.payload = payload; return builder; },
      update(payload) { ctx.op = 'update'; ctx.payload = payload; return builder; },
      upsert(payload) { ctx.op = 'upsert'; ctx.payload = payload; return builder; },
      delete() { ctx.op = 'delete'; return builder; },
      eq(k, v) { ctx.filters[k] = v; return builder; },
      neq() { return builder; },
      is() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      maybeSingle() { ctx.single = true; return exec(); },
      single() { ctx.single = true; return exec(); },
      then(onF, onR) { return exec().then(onF, onR); },
    };
    return builder;
  }
  const sb = {
    from: (t) => makeBuilder(t),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
  };
  return { supabase: sb, default: sb };
});

import stripeRouter from '../../src/routes/stripe.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', stripeRouter);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}
const app = makeApp();

function postWebhook() {
  return request(app)
    .post('/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 'valid-sig')
    .send(Buffer.from('{}'));
}

function setupEvent(session) {
  mockStripe.webhooks.constructEvent.mockReturnValue({
    id: 'evt_setup',
    type: 'checkout.session.completed',
    data: { object: { mode: 'setup', ...session } },
  });
}

const profileUpdates = () => dbCalls.filter(c => c.table === 'profiles' && c.op === 'update');
const eventRecorded = () => dbCalls.some(c => c.table === 'stripe_webhook_events' && c.op === 'insert');

beforeEach(() => {
  vi.clearAllMocks();
  dbCalls.length = 0;
  state.respond = () => ({ data: null, error: null });
});

describe('webhook card-setup (save a card on file)', () => {
  it('mirrors has_saved_card and repoints stripe_customer_id at the session customer', async () => {
    setupEvent({ id: 'cs_setup', customer: 'cus_live', metadata: { userId: 'user-1', saveCard: 'true' } });
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.op === 'update') return { data: { id: 'user-1' }, error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    const upd = profileUpdates()[0];
    expect(upd).toBeDefined();
    expect(upd.payload).toMatchObject({ has_saved_card: true, stripe_customer_id: 'cus_live' });
    expect(upd.filters).toMatchObject({ id: 'user-1' });
    expect(eventRecorded()).toBe(true);
  });

  it('returns 500 (so Stripe retries) when the profile mirror errors, and does not record the event', async () => {
    setupEvent({ id: 'cs_setup', customer: 'cus_live', metadata: { userId: 'user-1' } });
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.op === 'update') return { data: null, error: { code: 'XX000', message: 'db hiccup' } };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(500);
    expect(eventRecorded()).toBe(false);
  });

  it('resolves the owner from the Stripe Customer metadata when session metadata is missing', async () => {
    setupEvent({ id: 'cs_setup', customer: 'cus_live', metadata: {} });
    mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_live', metadata: { userId: 'user-2' } });
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.op === 'update') return { data: { id: 'user-2' }, error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_live');
    const upd = profileUpdates()[0];
    expect(upd.filters).toMatchObject({ id: 'user-2' });
    expect(upd.payload).toMatchObject({ has_saved_card: true });
  });

  it('acks without touching profiles when no owner is resolvable (logged, not retried forever)', async () => {
    setupEvent({ id: 'cs_setup', customer: null, metadata: {} });

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(profileUpdates()).toHaveLength(0);
    expect(eventRecorded()).toBe(true);
  });

  it('acks when the profile row is gone (permanent, not retried forever)', async () => {
    setupEvent({ id: 'cs_setup', customer: 'cus_live', metadata: { userId: 'user-gone' } });
    state.respond = (ctx) => {
      if (ctx.table === 'profiles' && ctx.op === 'update') return { data: null, error: null };
      return { data: null, error: null };
    };

    const res = await postWebhook();

    expect(res.status).toBe(200);
    expect(eventRecorded()).toBe(true);
  });
});
