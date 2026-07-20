// HTML views for the sample — clean, simple markup with basic styling, using
// CardPop's brand palette (tailwind.config.js): CardPop Red #CE1126, Charcoal
// #1F2937, Soft Silver #C4CED4, Light Grey #F5F7FA. No build step, no client
// JS framework — every page is server-rendered and every action is a plain
// HTML form POST, so the whole flow is easy to read end-to-end.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Shared page chrome.
export function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | CardPop Connect v2 Sample</title>
<style>
  :root { --red: #CE1126; --charcoal: #1F2937; --silver: #C4CED4; --grey: #F5F7FA; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: var(--grey); color: var(--charcoal); }
  header { background: #fff; border-bottom: 1px solid var(--silver); padding: 14px 20px; display: flex; align-items: center; gap: 10px; }
  header .logo { font-weight: 800; font-size: 20px; letter-spacing: -0.5px; }
  header .logo span { color: var(--red); }
  header .tag { font-size: 12px; color: #6b7280; border: 1px solid var(--silver); border-radius: 999px; padding: 2px 10px; }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 26px; font-weight: 800; margin: 8px 0 4px; }
  h2 { font-size: 17px; font-weight: 700; margin: 0 0 12px; }
  p.muted, span.muted { color: #6b7280; font-size: 14px; }
  .card { background: #fff; border: 1px solid var(--silver); border-radius: 12px; padding: 20px; margin: 16px 0; }
  .btn { display: inline-block; background: var(--red); color: #fff; font-weight: 700; border: none; border-radius: 10px; padding: 11px 18px; font-size: 15px; cursor: pointer; text-decoration: none; min-height: 44px; }
  .btn.secondary { background: #fff; color: var(--charcoal); border: 1px solid var(--silver); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  label { display: block; font-size: 13px; font-weight: 700; margin: 12px 0 4px; }
  input, select { width: 100%; padding: 10px 12px; border: 1px solid var(--silver); border-radius: 10px; font-size: 15px; background: #fff; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .pill { display: inline-block; border-radius: 999px; padding: 3px 12px; font-size: 13px; font-weight: 700; }
  .pill.ok { background: #d1fae5; color: #065f46; }
  .pill.warn { background: #fef3c7; color: #92400e; }
  .pill.bad { background: #fee2e2; color: #991b1b; }
  .product { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid var(--silver); border-radius: 10px; padding: 14px; margin: 10px 0; background: #fff; }
  .price { font-weight: 800; white-space: nowrap; }
  code { background: var(--grey); border-radius: 6px; padding: 2px 6px; font-size: 13px; }
  .banner { border-radius: 10px; padding: 12px 14px; font-size: 14px; margin: 12px 0; }
  .banner.error { background: #fee2e2; color: #991b1b; }
  .banner.info { background: #dbeafe; color: #1e40af; }
</style>
</head>
<body>
<header>
  <div class="logo">Card<span>Pop</span></div>
  <div class="tag">Stripe Connect v2 — sample, not production</div>
</header>
<main>${body}</main>
</body>
</html>`;
}

// Landing page: "sign in" as a demo user (no auth — just a name to key the
// JSON store by; production keys by profiles.id).
export function loginPage({ error } = {}) {
  return layout('Demo sign-in', `
    ${error ? `<div class="banner error">${esc(error)}</div>` : ''}
    <h1>Connect v2 sample</h1>
    <p class="muted">Pick a demo seller name to try the flow: create a connected account,
    onboard it, add products, then buy from its storefront.</p>
    <div class="card">
      <form method="POST" action="/demo-login">
        <label for="user">Demo seller name</label>
        <input id="user" name="user" placeholder="e.g. maya" required pattern="[a-zA-Z0-9_-]{1,30}">
        <label for="email">Contact email (prefills the Stripe account)</label>
        <input id="email" name="email" type="email" placeholder="maya@example.com" required>
        <p></p>
        <button class="btn" type="submit">Continue</button>
      </form>
    </div>`);
}

// Seller dashboard: account status + every action in the brief.
export function dashboardPage({ user, email, accountId, status, subscription, baseUrl, error, notice }) {
  const q = `user=${encodeURIComponent(user)}`;
  return layout(`${user}'s dashboard`, `
    ${error ? `<div class="banner error">${esc(error)}</div>` : ''}
    ${notice ? `<div class="banner info">${esc(notice)}</div>` : ''}
    <h1>Hi ${esc(user)}</h1>
    <p class="muted">${esc(email || '')}</p>

    <div class="card">
      <h2>1 · Connected account</h2>
      ${accountId ? `
        <p>Account: <code>${esc(accountId)}</code></p>
        ${status ? `
          <p class="row">
            <span>Onboarding:</span>
            ${status.onboardingComplete
              ? '<span class="pill ok">complete</span>'
              : `<span class="pill warn">${esc(status.requirementsStatus || 'incomplete')}</span>`}
            <span>Card payments:</span>
            ${status.readyToProcessPayments
              ? '<span class="pill ok">active</span>'
              : `<span class="pill bad">${esc(status.cardPaymentsStatus || 'not active')}</span>`}
          </p>` : ''}
        <form method="POST" action="/accounts/onboard?${q}" class="row">
          <button class="btn" type="submit">
            ${status?.onboardingComplete ? 'Update details in Stripe' : 'Onboard to collect payments'}
          </button>
          <a class="btn secondary" href="/dashboard?${q}">Refresh status</a>
        </form>
      ` : `
        <p class="muted">No Stripe account yet — create one to start selling.</p>
        <form method="POST" action="/accounts?${q}">
          <label for="displayName">Display name (shown in Stripe)</label>
          <input id="displayName" name="displayName" value="${esc(user)}" required>
          <p></p>
          <button class="btn" type="submit">Create connected account</button>
        </form>
      `}
    </div>

    <div class="card">
      <h2>2 · Products</h2>
      ${accountId ? `
        <form method="POST" action="/products?${q}">
          <label for="name">Product name</label>
          <input id="name" name="name" placeholder="1999 Base Set Charizard" required>
          <label for="description">Description</label>
          <input id="description" name="description" placeholder="PSA 9 — pack fresh">
          <label for="price">Price (AUD)</label>
          <input id="price" name="price" type="number" min="0.5" step="0.01" placeholder="129.99" required>
          <p></p>
          <button class="btn" type="submit">Create product</button>
        </form>
        <p><a class="btn secondary" href="/store/${esc(accountId)}">Open storefront →</a></p>
      ` : '<p class="muted">Create your connected account first.</p>'}
    </div>

    <div class="card">
      <h2>3 · Platform subscription</h2>
      <p class="muted">With v2 accounts the connected account doubles as the platform's
      customer — the subscription is billed to <code>customer_account</code>, no separate
      <code>cus_…</code> object needed.</p>
      ${accountId ? `
        <p>Status:
          ${subscription?.status
            ? `<span class="pill ${subscription.status === 'active' ? 'ok' : 'warn'}">${esc(subscription.status)}${subscription.cancelAtPeriodEnd ? ' · cancels at period end' : ''}</span>`
            : '<span class="pill warn">not subscribed</span>'}
        </p>
        <form method="POST" action="/subscribe?${q}" class="row">
          <button class="btn" type="submit">Subscribe</button>
        </form>
        <form method="POST" action="/billing-portal?${q}" class="row" style="margin-top:10px">
          <button class="btn secondary" type="submit">Manage subscription (billing portal)</button>
        </form>
      ` : '<p class="muted">Create your connected account first.</p>'}
    </div>

    <p class="muted">Webhooks: point the Stripe CLI at <code>${esc(baseUrl)}/webhooks/connect</code>
    (thin events) and <code>${esc(baseUrl)}/webhooks/billing</code> (snapshot events) — see the README.</p>
  `);
}

// Public storefront for one connected account.
export function storefrontPage({ accountId, storeName, products, error }) {
  return layout(`${storeName} store`, `
    ${error ? `<div class="banner error">${esc(error)}</div>` : ''}
    <h1>${esc(storeName)}</h1>
    <p class="muted">Storefront for connected account <code>${esc(accountId)}</code></p>
    ${products.length === 0 ? '<div class="card"><p class="muted">No products yet.</p></div>' : ''}
    ${products.map((p) => `
      <div class="product">
        <div>
          <div style="font-weight:700">${esc(p.name)}</div>
          ${p.description ? `<div class="muted" style="font-size:13px">${esc(p.description)}</div>` : ''}
        </div>
        <div class="row">
          <span class="price">${esc(p.priceLabel)}</span>
          <form method="POST" action="/store/${esc(accountId)}/buy">
            <input type="hidden" name="priceId" value="${esc(p.priceId)}">
            <button class="btn" type="submit">Buy</button>
          </form>
        </div>
      </div>`).join('')}
  `);
}

// Post-checkout landing page (payment or subscription).
export function successPage({ heading, detail, backHref, backLabel }) {
  return layout('Success', `
    <div class="card">
      <h1>${esc(heading)}</h1>
      <p class="muted">${esc(detail)}</p>
      <p><a class="btn" href="${esc(backHref)}">${esc(backLabel)}</a></p>
    </div>`);
}
