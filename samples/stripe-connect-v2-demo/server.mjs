// ─────────────────────────────────────────────────────────────────────────────
// CardPop — Stripe Connect v2 SAMPLE integration
//
// A self-contained demo of Stripe's v2 Accounts API ("unified accounts"):
//   1. Create a connected account (v2, dashboard: 'full', Stripe collects
//      fees/losses) and store a user → account-id mapping.
//   2. Onboard it with a v2 Account Link; read live status from the API.
//   3. Create products ON the connected account (Stripe-Account header).
//   4. A per-account storefront where customers buy via hosted Checkout —
//      direct charges with an application fee for the platform.
//   5. Charge the connected account a platform subscription using
//      customer_account (v2 accounts double as platform customers) + a
//      billing portal to manage it.
//   6. Webhooks: thin events for account/requirements changes, snapshot
//      events for subscription lifecycle.
//
// ⚠️  SAMPLE ONLY — deliberately isolated from CardPop production.
//     Production seller payouts use Connect Express + separate charges and
//     transfers (src/services/connectService.js / payoutService.js). This demo
//     is the opposite architecture (v2 accounts + direct charges) and requires
//     "Accounts v2" to be ENABLED on the platform Stripe account — livemode on
//     the CardPop platform currently rejects v2 account creation with
//     "Accounts v2 is not enabled for your livemode merchant".
//
// Run:  STRIPE_SECRET_KEY=sk_test_... node samples/stripe-connect-v2-demo/server.mjs
// Docs: see README.md next to this file for webhook + subscription setup.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import Stripe from 'stripe';
import { getUser, upsertUser, findUserByAccountId } from './store.mjs';
import { loginPage, dashboardPage, storefrontPage, successPage } from './views.mjs';

// ─── Configuration ───────────────────────────────────────────────────────────

// PLACEHOLDER: your Stripe *secret* key (sk_test_... while evaluating).
// Use a TEST key — this sample creates real objects on whatever account the
// key belongs to.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error(
    '\n✖ STRIPE_SECRET_KEY is not set.\n\n' +
    '  This sample needs a Stripe secret key to talk to the API.\n' +
    '  Grab a TEST key from https://dashboard.stripe.com/test/apikeys and run:\n\n' +
    '    STRIPE_SECRET_KEY=sk_test_... node samples/stripe-connect-v2-demo/server.mjs\n'
  );
  process.exit(1);
}

// PLACEHOLDER: a recurring Price on the PLATFORM account for the seller
// subscription flow (create one in the Dashboard → Product catalogue, or:
//   stripe prices create --unit-amount 1000 --currency aud -d "recurring[interval]=month" -d product_data[name]="CardPop Seller Plan"
// ). The /subscribe route explains what to do if it's missing.
const SUBSCRIPTION_PRICE_ID = process.env.SUBSCRIPTION_PRICE_ID;

// PLACEHOLDER: signing secrets, printed by `stripe listen` (whsec_...).
// Each endpoint has its own secret — see README for the two listen commands.
const CONNECT_WEBHOOK_SECRET = process.env.CONNECT_WEBHOOK_SECRET; // thin events
const BILLING_WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET; // snapshot events

const PORT = Number(process.env.PORT || 4242);
const BASE_URL = process.env.DEMO_BASE_URL || `http://localhost:${PORT}`;

// Country for new connected accounts. The Stripe brief's example used 'us';
// CardPop is Australian, so the sample defaults to 'au'.
const ACCOUNT_COUNTRY = process.env.DEMO_ACCOUNT_COUNTRY || 'au';
const CURRENCY = 'aud';

// The platform's cut of each storefront sale, in basis points (1000 = 10%).
const APPLICATION_FEE_BPS = 1000;

// ─── Stripe client ───────────────────────────────────────────────────────────
// One shared "Stripe Client" for every request in this sample. The SDK pins
// the API version automatically (2026-06-24.dahlia at the time of writing) —
// do NOT pass apiVersion here.
const stripeClient = new Stripe(STRIPE_SECRET_KEY);

const app = express();
// Form posts from the sample UI. Webhook routes use express.raw() instead —
// signature verification needs the untouched request body.
app.use(express.urlencoded({ extended: false }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Live onboarding status, always read from the Stripe API (per the brief this
// demo never caches it in a database). `include` pulls the embedded merchant
// configuration and the requirements summary into the account object.
async function getAccountStatus(accountId) {
  const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
    include: ['configuration.merchant', 'requirements'],
  });

  // Can this account take card payments on the storefront yet?
  const cardPaymentsStatus =
    account?.configuration?.merchant?.capabilities?.card_payments?.status;
  const readyToProcessPayments = cardPaymentsStatus === 'active';

  // Is anything still due? minimum_deadline summarises the most urgent
  // outstanding requirement across the whole account.
  const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status;
  const onboardingComplete =
    requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';

  return { account, cardPaymentsStatus, readyToProcessPayments, requirementsStatus, onboardingComplete };
}

// Small guard used by dashboard actions.
function requireDemoUser(req, res) {
  const name = String(req.query.user || '').trim();
  const user = name ? getUser(name) : null;
  if (!user) {
    res.redirect('/');
    return null;
  }
  return { name, ...user };
}

const fmtAud = (cents) => `$${(cents / 100).toFixed(2)} AUD`;

// ─── Demo "auth" ─────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.send(loginPage({}));
});

app.post('/demo-login', (req, res) => {
  const name = String(req.body.user || '').trim();
  const email = String(req.body.email || '').trim();
  if (!name || !email) return res.send(loginPage({ error: 'Name and email are required.' }));
  upsertUser(name, { email });
  res.redirect(`/dashboard?user=${encodeURIComponent(name)}`);
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

app.get('/dashboard', async (req, res) => {
  const user = requireDemoUser(req, res);
  if (!user) return;

  let status = null;
  let error = req.query.error || null;
  if (user.accountId) {
    try {
      status = await getAccountStatus(user.accountId);
    } catch (err) {
      error = `Could not load account status from Stripe: ${err.message}`;
    }
  }

  res.send(dashboardPage({
    user: user.name,
    email: user.email,
    accountId: user.accountId,
    status,
    subscription: user.subscription,
    baseUrl: BASE_URL,
    error,
    notice: req.query.notice || null,
  }));
});

// ─── 1 · Create the connected account (v2 Accounts API) ─────────────────────

app.post('/accounts', async (req, res) => {
  const user = requireDemoUser(req, res);
  if (!user) return;

  try {
    // Idempotent for the demo: one account per demo user.
    if (user.accountId) {
      return res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}`);
    }

    // v2 unified account. Note there is NO top-level `type` (that's the v1
    // API's express/standard/custom split; v2 accounts are shaped by
    // configurations instead):
    //  * dashboard: 'full'        → the seller gets the full Stripe Dashboard
    //  * responsibilities: stripe → Stripe collects processing fees and eats
    //                                negative-balance losses (not the platform)
    //  * configuration.customer   → the same acct_ id can be billed as OUR
    //                                customer (used by the subscription flow)
    //  * configuration.merchant   → card_payments requested so their
    //                                storefront can take direct charges
    //  * include                  → embeds the configurations/identity in the
    //                                response so it's inspectable immediately
    const isTestMode = STRIPE_SECRET_KEY.startsWith('sk_test');
    const account = await stripeClient.v2.core.accounts.create({
      display_name: String(req.body.displayName || user.name),
      contact_email: user.email,
      identity: {
        country: ACCOUNT_COUNTRY,
        // Placeholder phone so test onboarding has fewer fields to collect —
        // real integrations should let Stripe collect the seller's actual
        // details during onboarding instead.
        business_details: {
          phone: process.env.DEMO_ACCOUNT_PHONE || '0000000000',
        },
      },
      dashboard: 'full',
      defaults: {
        responsibilities: {
          fees_collector: 'stripe',
          losses_collector: 'stripe',
        },
      },
      configuration: {
        customer: {},
        merchant: {
          capabilities: {
            card_payments: {
              requested: true,
            },
          },
          // TEST MODE ONLY: simulates the account accepting Stripe's Terms of
          // Service on-behalf-of, so the demo can take payments without a
          // human clicking through onboarding. Never sent in livemode (and
          // must not be — real accounts must accept the ToS themselves).
          ...(isTestMode ? { simulate_accept_tos_obo: true } : {}),
        },
      },
      include: [
        'configuration.merchant',
        'configuration.recipient',
        'configuration.customer',
        'identity',
        'defaults',
      ],
    });

    // Persist the user → account-id mapping (sample JSON store; in the real
    // app this is profiles.stripe_connect_account_id in Supabase).
    upsertUser(user.name, { accountId: account.id });

    res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&notice=Connected account ${account.id} created.`);
  } catch (err) {
    res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=${encodeURIComponent(`Account creation failed: ${err.message}`)}`);
  }
});

// ─── 2 · Onboard via a v2 Account Link ───────────────────────────────────────

app.post('/accounts/onboard', async (req, res) => {
  const user = requireDemoUser(req, res);
  if (!user) return;
  if (!user.accountId) {
    return res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=Create the connected account first.`);
  }

  try {
    // Single-use hosted onboarding URL. `configurations` tells Stripe which
    // requirement sets to collect — merchant (to sell) and customer (to be
    // billed). refresh_url is where Stripe sends the user when a link expires;
    // return_url when they finish (accountId in the query so the dashboard can
    // immediately re-check status).
    const dashboardUrl = `${BASE_URL}/dashboard?user=${encodeURIComponent(user.name)}`;
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: user.accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant', 'customer'],
          refresh_url: dashboardUrl,
          return_url: `${dashboardUrl}&accountId=${user.accountId}`,
        },
      },
    });

    res.redirect(accountLink.url);
  } catch (err) {
    res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=${encodeURIComponent(`Onboarding link failed: ${err.message}`)}`);
  }
});

// ─── 3 · Create products on the connected account ────────────────────────────

app.post('/products', async (req, res) => {
  const user = requireDemoUser(req, res);
  if (!user) return;
  if (!user.accountId) {
    return res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=Create the connected account first.`);
  }

  try {
    const priceInCents = Math.round(Number(req.body.price) * 100);
    if (!Number.isFinite(priceInCents) || priceInCents < 50) {
      throw new Error('Price must be at least $0.50.');
    }

    // The second argument's `stripeAccount` sets the Stripe-Account header, so
    // the product (and its default price) is created ON the connected account,
    // not on the platform. Everything the storefront sells belongs to the
    // seller's own account.
    await stripeClient.products.create({
      name: String(req.body.name || '').trim(),
      description: String(req.body.description || '').trim() || undefined,
      default_price_data: {
        unit_amount: priceInCents,
        currency: CURRENCY,
      },
    }, {
      stripeAccount: user.accountId,
    });

    res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&notice=Product created.`);
  } catch (err) {
    res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=${encodeURIComponent(`Product creation failed: ${err.message}`)}`);
  }
});

// ─── 4 · Storefront + direct-charge checkout ─────────────────────────────────

// One storefront page per connected account.
// NOTE: the raw acct_… id in the URL keeps the sample simple — in a real app
// use your own identifier (e.g. CardPop's store_slug) and look the account id
// up server-side, so URLs are friendly and you never leak Stripe ids.
app.get('/store/:accountId', async (req, res) => {
  const { accountId } = req.params;
  try {
    // Again scoped to the connected account via the Stripe-Account header;
    // expand default_price so we can render amounts without extra requests.
    const products = await stripeClient.products.list({
      limit: 20,
      active: true,
      expand: ['data.default_price'],
    }, {
      stripeAccount: accountId,
    });

    const owner = findUserByAccountId(accountId);
    res.send(storefrontPage({
      accountId,
      storeName: owner ? `${owner.name}'s cards` : 'CardPop seller store',
      products: products.data
        .filter((p) => p.default_price && typeof p.default_price === 'object')
        .map((p) => ({
          name: p.name,
          description: p.description,
          priceId: p.default_price.id,
          priceLabel: fmtAud(p.default_price.unit_amount),
        })),
    }));
  } catch (err) {
    res.status(400).send(storefrontPage({
      accountId, storeName: 'CardPop seller store', products: [],
      error: `Could not load products: ${err.message}`,
    }));
  }
});

app.post('/store/:accountId/buy', async (req, res) => {
  const { accountId } = req.params;
  try {
    const priceId = String(req.body.priceId || '');

    // The price lives on the connected account, so fetch it there to compute
    // the platform's application fee for this sale.
    const price = await stripeClient.prices.retrieve(priceId, {}, { stripeAccount: accountId });
    const applicationFee = Math.max(1, Math.round(price.unit_amount * APPLICATION_FEE_BPS / 10000));

    // DIRECT charge: the Checkout Session is created ON the connected account
    // (Stripe-Account header), so the seller is the merchant of record and
    // Stripe's processing fees hit them. The platform monetises via
    // application_fee_amount, which is routed back to the platform balance.
    const session = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
      },
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&account=${accountId}`,
      cancel_url: `${BASE_URL}/store/${accountId}`,
    }, {
      stripeAccount: accountId,
    });

    res.redirect(session.url);
  } catch (err) {
    res.status(400).send(storefrontPage({
      accountId, storeName: 'CardPop seller store', products: [],
      error: `Could not start checkout: ${err.message}`,
    }));
  }
});

// Purchase landing page. The session was created on the connected account, so
// retrieving it needs the same Stripe-Account header.
app.get('/success', async (req, res) => {
  let detail = 'Thanks for your purchase.';
  try {
    if (req.query.session_id && req.query.account) {
      const session = await stripeClient.checkout.sessions.retrieve(
        String(req.query.session_id), {}, { stripeAccount: String(req.query.account) }
      );
      detail = `Paid ${fmtAud(session.amount_total)} — session ${session.id}.`;
    }
  } catch { /* cosmetic only — keep the generic message */ }
  res.send(successPage({
    heading: 'Payment complete 🎉',
    detail,
    backHref: req.query.account ? `/store/${req.query.account}` : '/',
    backLabel: 'Back to store',
  }));
});

// ─── 5 · Platform subscription billed to the connected account ───────────────

app.post('/subscribe', async (req, res) => {
  const user = requireDemoUser(req, res);
  if (!user) return;
  if (!user.accountId) {
    return res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=Create the connected account first.`);
  }

  // Helpful error for the placeholder, as promised by the brief.
  if (!SUBSCRIPTION_PRICE_ID) {
    return res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=${encodeURIComponent(
      'SUBSCRIPTION_PRICE_ID is not set. Create a recurring Price on the PLATFORM account ' +
      '(Dashboard → Product catalogue → Add product → recurring) and restart with ' +
      'SUBSCRIPTION_PRICE_ID=price_...'
    )}`);
  }

  try {
    // v2 accounts are the customer: pass the acct_… id as customer_account —
    // no separate cus_… object. (The account's `customer` configuration from
    // step 1 is what makes this legal.) This session is on the PLATFORM (no
    // Stripe-Account header) because the platform is billing the seller.
    const dashboardUrl = `${BASE_URL}/dashboard?user=${encodeURIComponent(user.name)}`;
    const session = await stripeClient.checkout.sessions.create({
      customer_account: user.accountId,
      mode: 'subscription',
      line_items: [
        { price: SUBSCRIPTION_PRICE_ID, quantity: 1 },
      ],
      success_url: `${dashboardUrl}&notice=${encodeURIComponent('Subscription started.')}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: dashboardUrl,
    });

    res.redirect(session.url);
  } catch (err) {
    res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=${encodeURIComponent(`Subscription checkout failed: ${err.message}`)}`);
  }
});

// Billing portal — the seller manages (upgrade/cancel/pause) their platform
// subscription themselves. Also keyed by customer_account, not customer.
app.post('/billing-portal', async (req, res) => {
  const user = requireDemoUser(req, res);
  if (!user) return;
  if (!user.accountId) {
    return res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=Create the connected account first.`);
  }

  try {
    const session = await stripeClient.billingPortal.sessions.create({
      customer_account: user.accountId,
      return_url: `${BASE_URL}/dashboard?user=${encodeURIComponent(user.name)}`,
    });
    res.redirect(session.url);
  } catch (err) {
    res.redirect(`/dashboard?user=${encodeURIComponent(user.name)}&error=${encodeURIComponent(`Billing portal failed: ${err.message}`)}`);
  }
});

// ─── 6a · Webhooks: THIN events (v2 account / requirements changes) ──────────
//
// Account requirements change over time (regulators, card networks, …). The
// v2 events arrive as THIN payloads: a tiny signed envelope with an event id +
// related object, no data. You verify the signature, then fetch the full event
// from the API. Local testing:
//
//   stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' \
//     --forward-thin-to localhost:4242/webhooks/connect
//
app.post('/webhooks/connect', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!CONNECT_WEBHOOK_SECRET) {
    console.error('✖ CONNECT_WEBHOOK_SECRET is not set — run `stripe listen` (see README) and export the whsec_… it prints.');
    return res.status(500).send('CONNECT_WEBHOOK_SECRET not configured');
  }

  let notification;
  try {
    // Verify the signature and parse the thin envelope. (stripe-node ≥ v22
    // calls this parseEventNotification; older docs name it parseThinEvent.)
    notification = stripeClient.parseEventNotification(
      req.body, req.headers['stripe-signature'], CONNECT_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send('Invalid signature');
  }

  // Ack immediately — Stripe retries anything that doesn't 2xx quickly.
  res.sendStatus(200);

  try {
    // Thin events carry no data: fetch the full event, then act on its type.
    const event = await stripeClient.v2.core.events.retrieve(notification.id);
    const accountId = event.related_object?.id;

    switch (event.type) {
      // The account's outstanding requirements changed — e.g. Stripe now needs
      // an updated document. Re-check status and, in a real app, notify the
      // seller to run the onboarding link again.
      case 'v2.core.account[requirements].updated': {
        const { requirementsStatus, onboardingComplete } = await getAccountStatus(accountId);
        console.log(`[connect webhook] ${accountId} requirements updated → ${requirementsStatus || 'none due'}`);
        if (!onboardingComplete) {
          // TODO(real app): notify the seller (email / in-app) to complete the
          // new requirements via a fresh account link before the deadline.
          console.log(`[connect webhook] ${accountId} has outstanding requirements — prompt re-onboarding`);
        }
        break;
      }

      // A capability flipped (e.g. card_payments active → inactive). Gate the
      // storefront on this in a real app.
      case 'v2.core.account[configuration.merchant].capability_status_updated': {
        const { cardPaymentsStatus } = await getAccountStatus(accountId);
        console.log(`[connect webhook] ${accountId} merchant capability now: ${cardPaymentsStatus}`);
        break;
      }

      case 'v2.core.account[configuration.customer].capability_status_updated': {
        console.log(`[connect webhook] ${accountId} customer configuration capability changed`);
        break;
      }

      default:
        console.log(`[connect webhook] unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[connect webhook] handler error: ${err.message}`);
  }
});

// ─── 6b · Webhooks: SNAPSHOT events (subscription lifecycle) ─────────────────
//
// Subscription events use classic snapshot payloads (full object embedded).
// Local testing:
//
//   stripe listen --events 'customer.subscription.updated,customer.subscription.deleted,invoice.paid,payment_method.attached,payment_method.detached,customer.updated' \
//     --forward-to localhost:4242/webhooks/billing
//
app.post('/webhooks/billing', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!BILLING_WEBHOOK_SECRET) {
    console.error('✖ BILLING_WEBHOOK_SECRET is not set — run `stripe listen` (see README) and export the whsec_… it prints.');
    return res.status(500).send('BILLING_WEBHOOK_SECRET not configured');
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], BILLING_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send('Invalid signature');
  }

  res.sendStatus(200);

  // Persist the latest subscription state against the demo user. IMPORTANT:
  // with v2 accounts, do NOT read `.customer` — the payer is the connected
  // account itself, exposed as `.customer_account` (an acct_… id).
  const recordSubscription = (subscription) => {
    const accountId = subscription.customer_account; // acct_…, NOT a cus_… id
    const owner = findUserByAccountId(accountId);
    if (!owner) return console.log(`[billing webhook] no demo user for ${accountId}`);
    upsertUser(owner.name, {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        priceId: subscription.items?.data?.[0]?.price?.id,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      },
    });
    // TODO(real app): write this to your real DB instead (for CardPop that's
    // profiles.subscription_status & friends) and grant/revoke seller access.
  };

  switch (event.type) {
    // A Checkout Session finished. Two flavours arrive here:
    //  * storefront sales — direct charges, so the event fires on the
    //    CONNECTED account (event.account is the acct_… id; forward these
    //    with `stripe listen --forward-connect-to`, see README). This is the
    //    verification that a customer's payment completed.
    //  * platform subscription checkouts — fire on the platform itself.
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (event.account) {
        console.log(`[billing webhook] storefront sale complete on ${event.account}: session ${session.id}, ${session.amount_total} ${session.currency}`);
        // TODO(real app): mark the order paid / start fulfilment here.
      } else if (session.mode === 'subscription') {
        console.log(`[billing webhook] subscription checkout complete for ${session.customer_account}`);
        // The subsequent customer.subscription.updated event carries the full
        // subscription object and is what records the status below.
      }
      break;
    }

    // Upgrades, downgrades, quantity changes, pause/resume, and
    // cancel-at-period-end all arrive here — inspect items.data[0].price /
    // quantity / pause_collection / cancel_at_period_end and adjust the
    // seller's entitlements to match.
    case 'customer.subscription.updated':
      recordSubscription(event.data.object);
      break;

    // Final cancellation — revoke access now.
    case 'customer.subscription.deleted':
      recordSubscription(event.data.object);
      break;

    // A renewal (or first) invoice was paid — safe point to extend access.
    case 'invoice.paid':
      console.log(`[billing webhook] invoice ${event.data.object.id} paid for ${event.data.object.customer_account || 'unknown account'}`);
      break;

    // Payment-method housekeeping surfaced by the billing portal.
    case 'payment_method.attached':
    case 'payment_method.detached':
      console.log(`[billing webhook] ${event.type}: ${event.data.object.id}`);
      break;

    // Billing-detail changes (default payment method, email, tax ids). Treat
    // as billing info only — never as a login credential change.
    case 'customer.updated':
    case 'customer.tax_id.created':
    case 'customer.tax_id.updated':
    case 'customer.tax_id.deleted':
      console.log(`[billing webhook] ${event.type}`);
      break;

    // Portal configuration/session bookkeeping — log only.
    case 'billing_portal.configuration.created':
    case 'billing_portal.configuration.updated':
    case 'billing_portal.session.created':
      console.log(`[billing webhook] ${event.type}`);
      break;

    default:
      console.log(`[billing webhook] unhandled event type: ${event.type}`);
  }
});

// ─── Boot ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\nCardPop Connect v2 sample running → ${BASE_URL}\n`);
  if (!SUBSCRIPTION_PRICE_ID) console.log('  (subscriptions disabled until SUBSCRIPTION_PRICE_ID is set)');
  if (!CONNECT_WEBHOOK_SECRET) console.log('  (connect webhooks disabled until CONNECT_WEBHOOK_SECRET is set)');
  if (!BILLING_WEBHOOK_SECRET) console.log('  (billing webhooks disabled until BILLING_WEBHOOK_SECRET is set)');
});
