// ─────────────────────────────────────────────────────────────────────────────
// CardPop — Stripe Connect v2 MARKETPLACE sample ("Collect payments using
// Accounts v2 as a marketplace")
//
// The marketplace-shaped v2 flow, per Stripe's blueprint:
//   1. Create a v2 connected account per seller with a RECIPIENT configuration
//      (stripe_balance.stripe_transfers requested), Express dashboard, and the
//      PLATFORM as losses/fees collector — the platform owns the risk.
//   2. Onboard it with a v2 Account Link (KYC), status read live from the API.
//   3. Take the buyer's payment on the PLATFORM with a Checkout Session that
//      uses a DESTINATION charge: payment_intent_data.transfer_data.destination
//      routes the proceeds to the seller, application_fee_amount keeps the
//      platform's cut.
//   4. Verify completion via the checkout.session.completed snapshot webhook.
//
// ⚠️  This is the v2 twin of CardPop's REAL production architecture (platform
//     charges the buyer, seller receives proceeds, platform keeps commission).
//     Production runs it on v1 Express accounts + transfers because livemode on
//     the CardPop platform account rejects v2 with "Accounts v2 is not enabled".
//     Run THIS sample against a SANDBOX of the CardPop account, where v2 is
//     available — if/when Stripe enables Accounts v2 for livemode, this is the
//     shape production would migrate to.
//
//     (The sibling sample, ../stripe-connect-v2-demo, is the other blueprint:
//     sellers as full-dashboard merchants taking DIRECT charges. Different
//     business model; kept separate on purpose.)
//
// Run:  STRIPE_SECRET_KEY=sk_test_... node samples/stripe-connect-v2-marketplace-demo/server.mjs
// See README.md for sandbox setup and the webhook listener command.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Configuration ───────────────────────────────────────────────────────────

// PLACEHOLDER: a SANDBOX secret key from the CardPop Stripe account
// (Dashboard → account switcher → Sandboxes → open sandbox → Developers →
// API keys). Livemode keys will fail account creation until Stripe enables
// Accounts v2 for the platform.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error(
    '\n✖ STRIPE_SECRET_KEY is not set.\n\n' +
    '  Use a key from a CardPop Stripe SANDBOX (Accounts v2 is not enabled on\n' +
    '  the live account). Dashboard → Sandboxes → Developers → API keys, then:\n\n' +
    '    STRIPE_SECRET_KEY=sk_test_... node samples/stripe-connect-v2-marketplace-demo/server.mjs\n'
  );
  process.exit(1);
}

// PLACEHOLDER: signing secret printed by `stripe listen` (see README) for the
// checkout.session.completed verification webhook.
const CHECKOUT_WEBHOOK_SECRET = process.env.CHECKOUT_WEBHOOK_SECRET;

const PORT = Number(process.env.PORT || 4343);
const BASE_URL = process.env.DEMO_BASE_URL || `http://localhost:${PORT}`;

// ${env:connectedAccountCountry} / ${env:currency} from the blueprint —
// defaulted for CardPop (Australia).
const ACCOUNT_COUNTRY = process.env.DEMO_ACCOUNT_COUNTRY || 'au';
const CURRENCY = process.env.DEMO_CURRENCY || 'aud';

// Platform commission on each sale, in basis points (1000 = 10%).
const APPLICATION_FEE_BPS = 1000;

// One shared Stripe client for every request; the SDK pins the API version
// itself — do not pass apiVersion.
const stripeClient = new Stripe(STRIPE_SECRET_KEY);

// ─── Tiny JSON-file store (sample only) ──────────────────────────────────────
// Maps demo seller name → { email, accountId } and records completed sales from
// the webhook. Stands in for profiles.stripe_connect_account_id / orders in the
// real app.

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.demo-data.json');
const readStore = () => { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return { sellers: {}, sales: [] }; } };
const writeStore = (d) => fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
const getSeller = (name) => readStore().sellers[name] || null;
const upsertSeller = (name, patch) => { const d = readStore(); d.sellers[name] = { ...(d.sellers[name] || {}), ...patch }; writeStore(d); };
const recordSale = (sale) => { const d = readStore(); d.sales.push(sale); writeStore(d); };
const findSellerByAccountId = (accountId) => {
  const entry = Object.entries(readStore().sellers).find(([, s]) => s.accountId === accountId);
  return entry ? { name: entry[0], ...entry[1] } : null;
};

// ─── Minimal HTML (CardPop palette, no client JS) ────────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | CardPop v2 Marketplace Sample</title>
<style>
  :root { --red:#CE1126; --charcoal:#1F2937; --silver:#C4CED4; --grey:#F5F7FA; }
  * { box-sizing:border-box } body { margin:0; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; background:var(--grey); color:var(--charcoal) }
  header { background:#fff; border-bottom:1px solid var(--silver); padding:14px 20px; display:flex; gap:10px; align-items:center }
  .logo { font-weight:800; font-size:20px } .logo span { color:var(--red) }
  .tag { font-size:12px; color:#6b7280; border:1px solid var(--silver); border-radius:999px; padding:2px 10px }
  main { max-width:680px; margin:0 auto; padding:24px 16px 64px }
  h1 { font-size:26px; font-weight:800; margin:8px 0 4px } h2 { font-size:17px; margin:0 0 12px }
  .muted { color:#6b7280; font-size:14px }
  .card { background:#fff; border:1px solid var(--silver); border-radius:12px; padding:20px; margin:16px 0 }
  .btn { display:inline-block; background:var(--red); color:#fff; font-weight:700; border:none; border-radius:10px; padding:11px 18px; font-size:15px; cursor:pointer; text-decoration:none; min-height:44px }
  .btn.secondary { background:#fff; color:var(--charcoal); border:1px solid var(--silver) }
  label { display:block; font-size:13px; font-weight:700; margin:12px 0 4px }
  input { width:100%; padding:10px 12px; border:1px solid var(--silver); border-radius:10px; font-size:15px }
  .pill { display:inline-block; border-radius:999px; padding:3px 12px; font-size:13px; font-weight:700 }
  .pill.ok { background:#d1fae5; color:#065f46 } .pill.warn { background:#fef3c7; color:#92400e }
  .banner { border-radius:10px; padding:12px 14px; font-size:14px; margin:12px 0 }
  .banner.error { background:#fee2e2; color:#991b1b } .banner.info { background:#dbeafe; color:#1e40af }
  code { background:var(--grey); border-radius:6px; padding:2px 6px; font-size:13px }
</style></head><body>
<header><div class="logo">Card<span>Pop</span></div><div class="tag">Accounts v2 marketplace — sandbox sample</div></header>
<main>${body}</main></body></html>`;

const fmt = (cents) => `$${(cents / 100).toFixed(2)} ${CURRENCY.toUpperCase()}`;

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.urlencoded({ extended: false })); // webhook route uses express.raw

const requireSeller = (req, res) => {
  const name = String(req.query.seller || '').trim();
  const seller = name ? getSeller(name) : null;
  if (!seller) { res.redirect('/'); return null; }
  return { name, ...seller };
};

// Landing: pick a demo seller (no auth — keys the JSON store).
app.get('/', (_req, res) => {
  res.send(page('Demo sign-in', `
    <h1>Marketplace (Accounts v2) sample</h1>
    <p class="muted">Create a seller, onboard them as a v2 recipient account, then buy from
    their storefront — the platform takes the payment and routes proceeds to the seller.</p>
    <div class="card"><form method="POST" action="/seller-login">
      <label>Demo seller name</label><input name="seller" required pattern="[a-zA-Z0-9_-]{1,30}" placeholder="e.g. maya">
      <label>Contact email</label><input name="email" type="email" required placeholder="maya@example.com">
      <p></p><button class="btn" type="submit">Continue</button>
    </form></div>`));
});

app.post('/seller-login', (req, res) => {
  const name = String(req.body.seller || '').trim();
  const email = String(req.body.email || '').trim();
  if (!name || !email) return res.redirect('/');
  upsertSeller(name, { email });
  res.redirect(`/dashboard?seller=${encodeURIComponent(name)}`);
});

// Live status straight from the API — never cached. Payout-readiness for a
// recipient account = the stripe_balance.stripe_transfers capability is active;
// onboarding completeness comes from the requirements summary.
async function getAccountStatus(accountId) {
  const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
    include: ['configuration.recipient', 'requirements'],
  });
  const transfersStatus = account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status;
  return {
    readyForPayouts: transfersStatus === 'active',
    transfersStatus,
    requirementsStatus,
    onboardingComplete: requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due',
  };
}

// Seller dashboard: create account → onboard → storefront link.
app.get('/dashboard', async (req, res) => {
  const seller = requireSeller(req, res);
  if (!seller) return;
  const q = `seller=${encodeURIComponent(seller.name)}`;

  let status = null;
  let error = req.query.error || null;
  if (seller.accountId) {
    try { status = await getAccountStatus(seller.accountId); }
    catch (err) { error = `Could not load account status: ${err.message}`; }
  }

  const sales = readStore().sales.filter((s) => s.accountId === seller.accountId);
  res.send(page(`${seller.name}'s dashboard`, `
    ${error ? `<div class="banner error">${esc(error)}</div>` : ''}
    ${req.query.notice ? `<div class="banner info">${esc(req.query.notice)}</div>` : ''}
    <h1>Hi ${esc(seller.name)}</h1><p class="muted">${esc(seller.email || '')}</p>
    <div class="card"><h2>Seller payout account</h2>
    ${seller.accountId ? `
      <p>Account: <code>${esc(seller.accountId)}</code></p>
      ${status ? `<p>Onboarding: ${status.onboardingComplete ? '<span class="pill ok">complete</span>' : `<span class="pill warn">${esc(status.requirementsStatus || 'incomplete')}</span>`}
        &nbsp; Transfers: ${status.readyForPayouts ? '<span class="pill ok">active</span>' : `<span class="pill warn">${esc(status.transfersStatus || 'pending')}</span>`}</p>` : ''}
      <form method="POST" action="/onboard?${q}" style="display:inline"><button class="btn" type="submit">${status?.onboardingComplete ? 'Update details in Stripe' : 'Onboard to receive payouts'}</button></form>
      <a class="btn secondary" href="/dashboard?${q}">Refresh status</a>
      <p><a class="btn secondary" href="/store/${esc(seller.accountId)}">Open storefront →</a></p>
    ` : `
      <p class="muted">No payout account yet.</p>
      <form method="POST" action="/create-seller-account?${q}">
        <label>Display name</label><input name="displayName" value="${esc(seller.name)}" required>
        <p></p><button class="btn" type="submit">Create seller account</button>
      </form>`}
    </div>
    ${sales.length ? `<div class="card"><h2>Sales (from webhook)</h2>${sales.map((s) => `<p>${esc(s.sessionId)} — ${fmt(s.amountTotal)}</p>`).join('')}</div>` : ''}
  `));
});

// Blueprint step 1: create the v2 recipient account. No top-level `type` — the
// account is shaped by its configuration: recipient with the
// stripe_balance.stripe_transfers capability (so the platform can move balance
// to them), Express dashboard, platform ("application") as losses + fees
// collector. This mirrors src/utils/sellerAccountShape.js as it was in its
// original v2 form.
app.post('/create-seller-account', async (req, res) => {
  const seller = requireSeller(req, res);
  if (!seller) return;
  const q = `seller=${encodeURIComponent(seller.name)}`;
  try {
    if (seller.accountId) return res.redirect(`/dashboard?${q}`);

    const account = await stripeClient.v2.core.accounts.create({
      display_name: String(req.body.displayName || seller.name),
      contact_email: seller.email,
      identity: {
        country: ACCOUNT_COUNTRY,
      },
      dashboard: 'express',
      defaults: {
        responsibilities: {
          losses_collector: 'application',
          fees_collector: 'application',
        },
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      include: [
        'configuration.merchant',
        'configuration.recipient',
        'configuration.customer',
        'identity',
        'defaults',
      ],
      metadata: { cardpop_demo_seller: seller.name },
    });

    upsertSeller(seller.name, { accountId: account.id });
    res.redirect(`/dashboard?${q}&notice=Seller account ${account.id} created.`);
  } catch (err) {
    res.redirect(`/dashboard?${q}&error=${encodeURIComponent(`Account creation failed: ${err.message}`)}`);
  }
});

// Blueprint step 2: hosted onboarding via a v2 account link. The blueprint
// passes configurations [recipient, merchant]; drop 'merchant' if your sandbox
// rejects it (this sample only configures recipient on the account).
app.post('/onboard', async (req, res) => {
  const seller = requireSeller(req, res);
  if (!seller) return;
  const q = `seller=${encodeURIComponent(seller.name)}`;
  if (!seller.accountId) return res.redirect(`/dashboard?${q}&error=Create the seller account first.`);
  try {
    const dashboardUrl = `${BASE_URL}/dashboard?${q}`;
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: seller.accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient', 'merchant'],
          refresh_url: dashboardUrl,
          return_url: `${dashboardUrl}&accountId=${seller.accountId}`,
        },
      },
    });
    res.redirect(accountLink.url);
  } catch (err) {
    res.redirect(`/dashboard?${q}&error=${encodeURIComponent(`Onboarding link failed: ${err.message}`)}`);
  }
});

// Storefront: the buyer names an item + price, checkout happens on the PLATFORM.
app.get('/store/:accountId', (req, res) => {
  const owner = findSellerByAccountId(req.params.accountId);
  res.send(page('Storefront', `
    ${req.query.error ? `<div class="banner error">${esc(req.query.error)}</div>` : ''}
    <h1>${esc(owner ? `${owner.name}'s cards` : 'Seller store')}</h1>
    <p class="muted">Payments are taken by CardPop and routed to seller <code>${esc(req.params.accountId)}</code>.</p>
    <div class="card"><form method="POST" action="/store/${esc(req.params.accountId)}/buy">
      <label>Item</label><input name="name" value="1999 Base Set Charizard" required>
      <label>Price (${CURRENCY.toUpperCase()})</label><input name="price" type="number" min="0.5" step="0.01" value="129.99" required>
      <p></p><button class="btn" type="submit">Buy now</button>
    </form></div>`));
});

// Blueprint step 3: DESTINATION charge via hosted Checkout, created on the
// PLATFORM (no Stripe-Account header — contrast with the direct-charge sample).
// transfer_data.destination sends the proceeds to the seller's v2 account id;
// application_fee_amount is the platform's commission, kept before transfer.
app.post('/store/:accountId/buy', async (req, res) => {
  const { accountId } = req.params;
  try {
    const unitAmount = Math.round(Number(req.body.price) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount < 50) throw new Error('Price must be at least $0.50.');
    const applicationFee = Math.max(1, Math.round(unitAmount * APPLICATION_FEE_BPS / 10000));

    const session = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: { name: String(req.body.name || 'Trading card') },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: accountId,
        },
      },
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/store/${accountId}`,
      // So the webhook can attribute the sale without expanding the payment
      // intent (transfer_data lives on the PI, not the session).
      metadata: { seller_account_id: accountId },
    });

    res.redirect(session.url);
  } catch (err) {
    res.redirect(`/store/${accountId}?error=${encodeURIComponent(`Could not start checkout: ${err.message}`)}`);
  }
});

app.get('/success', async (req, res) => {
  let detail = 'Thanks for your purchase.';
  try {
    if (req.query.session_id) {
      const session = await stripeClient.checkout.sessions.retrieve(String(req.query.session_id));
      detail = `Paid ${fmt(session.amount_total)} — session ${session.id}. The seller's share is on its way to their account.`;
    }
  } catch { /* cosmetic only */ }
  res.send(page('Success', `<div class="card"><h1>Payment complete 🎉</h1><p class="muted">${esc(detail)}</p><p><a class="btn" href="/">Back to start</a></p></div>`));
});

// Blueprint step 4: verify the payment completed. Destination charges live on
// the platform, so checkout.session.completed arrives as a plain (snapshot)
// platform event — `stripe listen --events checkout.session.completed
// --forward-to localhost:4343/webhooks/checkout`.
app.post('/webhooks/checkout', express.raw({ type: 'application/json' }), (req, res) => {
  if (!CHECKOUT_WEBHOOK_SECRET) {
    console.error('✖ CHECKOUT_WEBHOOK_SECRET is not set — run `stripe listen` (see README) and export the whsec_… it prints.');
    return res.status(500).send('CHECKOUT_WEBHOOK_SECRET not configured');
  }
  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, req.headers['stripe-signature'], CHECKOUT_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send('Invalid signature');
  }
  res.sendStatus(200);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // In the real app this is where the order is marked paid and fulfilment
    // starts (CardPop production does this in stripeWebhookService.js).
    recordSale({ sessionId: session.id, amountTotal: session.amount_total, accountId: session.metadata?.seller_account_id || null, at: new Date().toISOString() });
    console.log(`[checkout webhook] session ${session.id} completed: ${session.amount_total} ${session.currency}`);
  } else {
    console.log(`[checkout webhook] unhandled event type: ${event.type}`);
  }
});

app.listen(PORT, () => {
  console.log(`\nCardPop Accounts v2 marketplace sample → ${BASE_URL}\n`);
  if (!CHECKOUT_WEBHOOK_SECRET) console.log('  (webhook verification disabled until CHECKOUT_WEBHOOK_SECRET is set)');
});
