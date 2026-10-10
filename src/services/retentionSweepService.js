import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import {
  sendAbandonedCheckout, sendWatchlistPriceDrop, sendWatchlistSold, sendSavedSearchMatches,
  sendBackInStock, sendWelcomeOfferReminder,
} from '../utils/emailService.js';
import { issueWelcomeOffer } from './welcomeOfferService.js';
import { signRestoreToken, restoreTokenConfigured } from '../utils/restoreToken.js';
import { buildCardSearchOr } from '../utils/cardSearchFilter.js';
import { PURCHASABLE_SHOP_STATUSES } from '../../utils/shopStock.js';
import { shopProductPath } from '../../utils/shopProductUrl.js';

// The daily retention sweep (.github/workflows/cron-daily.yml →
// GET /api/retention/sweep). Six small jobs, each bounded and independent, so
// one failing never blocks the rest, run under one wall-clock budget (the
// endpoint lives on the 40 s api/index.js function):
//
//   1. abandonedCheckouts   — one email, an hour or more after an unpaid
//                             checkout, only to signed-in buyers or guests who
//                             ticked the newsletter box (Spam Act: consent)
//   2. watchlistAlerts      — a watched card dropped in price, or sold
//   3. savedSearchAlerts    — new listings matching a saved marketplace search
//   4. restockAlerts        — a sold-out shop product is back
//   5. welcomeOffersForNewAccounts — codes for accounts the signup page didn't
//                             issue (Google/Facebook sign-ups, post-checkout
//                             account creation); the service's 48-hour rule still applies
//   6. welcomeOfferReminders — "your code expires in a week", once
//
// Every email respects notification_preferences (type, email) where the
// recipient has an account; a missing row means "on".

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const APP_URL = () => (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/$/, '');

// The whole sweep has to answer inside the function's 40 s; stop starting new
// work with enough left to finish the email in flight and reply. Every send is
// stamped as it happens, so whatever a run leaves is simply picked up tomorrow.
const DEFAULT_BUDGET_MS = 28_000;
const outOfTime = (deadline) => deadline != null && Date.now() >= deadline;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const lines = (order) => (Array.isArray(order?.order_items) ? order.order_items : []);

// ── Pure decision helpers (unit-tested) ─────────────────────────────────────

/** Should this unpaid order get the one abandoned-checkout email now? */
export function shouldEmailAbandoned(order, now = new Date()) {
  if (!order || order.abandoned_email_sent_at) return { send: false, reason: 'already sent' };
  if (!['pending', 'cancelled'].includes(order.status)) return { send: false, reason: `status ${order.status}` };
  const created = order.created_at ? new Date(order.created_at) : null;
  if (!created) return { send: false, reason: 'no created_at' };
  const age = now.getTime() - created.getTime();
  if (age < HOUR_MS) return { send: false, reason: 'too soon' };
  if (age > 3 * DAY_MS) return { send: false, reason: 'too old' };
  const consented = !!order.buyer_id || order.marketing_consent === true;
  if (!consented) return { send: false, reason: 'no consent' };
  if (!order.buyer_id && !order.buyer_email) return { send: false, reason: 'no address' };
  if (lines(order).length === 0) return { send: false, reason: 'no lines' };
  return { send: true };
}

/** Which watchlist email, if any, this row earns right now. */
export function watchlistAlertFor(row, listing) {
  if (!row || !listing) return null;
  if (listing.status === 'sold') return row.sold_alerted_at ? null : { kind: 'sold' };
  if (listing.status !== 'active') return null;
  const price = Number(listing.price_aud);
  const base = Number(row.last_alert_price_aud ?? row.price_at_add_aud);
  if (!(price > 0) || !(base > 0)) return null;
  if (price < base - 0.005) return { kind: 'price_drop', from: round2(base), to: round2(price), pct: Math.round(((base - price) / base) * 100) };
  return null;
}

/** Parse a saved search's URL params into the filters the sweep can apply. */
export function parseSavedSearch(params) {
  const p = new URLSearchParams(String(params || ''));
  const num = (k) => { const v = Number(p.get(k)); return Number.isFinite(v) && v > 0 ? v : null; };
  return {
    q: (p.get('q') || '').trim(),
    min: num('min'),
    max: num('max'),
    graded: p.get('graded') === 'graded' ? 'graded' : p.get('graded') === 'raw' ? 'raw' : null,
    cat: p.get('cat') || null,
    franchise: p.get('franchise') || null,
    set: p.get('set') || null,
    sold: false,
  };
}

async function emailAllowed(userId, type) {
  if (!userId) return true;
  const { data } = await supabase.from('notification_preferences').select('email').eq('user_id', userId).eq('type', type).maybeSingle();
  return data ? data.email !== false : true;
}

async function profileContact(userId) {
  if (!userId) return { email: null, name: null };
  const { data } = await supabase.from('profiles').select('email, display_name, username').eq('id', userId).maybeSingle();
  return { email: data?.email || null, name: data?.display_name || data?.username || null };
}

// ── 1. Abandoned checkouts ──────────────────────────────────────────────────

export async function abandonedCheckouts({ limit = 40, now = new Date(), deadline = null } = {}) {
  const out = { candidates: 0, emailed: 0, skipped: 0, errors: 0 };
  const since = new Date(now.getTime() - 3 * DAY_MS).toISOString();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, buyer_id, buyer_email, marketing_consent, abandoned_email_sent_at, created_at, order_items, shipping_name, total_aud')
    .in('status', ['pending', 'cancelled'])
    .is('abandoned_email_sent_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  for (const order of orders || []) {
    if (outOfTime(deadline)) { out.outOfTime = true; break; }
    out.candidates += 1;
    try {
      const decision = shouldEmailAbandoned(order, now);
      if (!decision.send) { out.skipped += 1; continue; }
      if (order.buyer_id && !(await emailAllowed(order.buyer_id, 'abandoned_checkout'))) { out.skipped += 1; continue; }
      const contact = order.buyer_id ? await profileContact(order.buyer_id) : { email: order.buyer_email, name: order.shipping_name };
      if (!contact.email) { out.skipped += 1; continue; }
      const items = lines(order).map((l) => ({
        title: l.title || 'Item', quantity: l.quantity || 1,
        price: round2(l.unit_price_aud ?? (Number(l.line_total_aud) / (l.quantity || 1))),
        url: `${APP_URL()}${l.type === 'shop' ? `/product/shop/${l.id}` : `/marketplace/${l.id}`}`,
      }));
      const token = restoreTokenConfigured() ? signRestoreToken(order.id) : null;
      const restoreUrl = token ? `${APP_URL()}/checkout?restore=${order.id}&t=${token}` : `${APP_URL()}/checkout`;
      const sent = await sendAbandonedCheckout({ to: contact.email, name: contact.name, items, restoreUrl });
      // Stamp whether or not the provider accepted it — one attempt per order.
      await supabase.from('orders').update({ abandoned_email_sent_at: now.toISOString() }).eq('id', order.id);
      if (sent) out.emailed += 1; else out.skipped += 1;
    } catch (err) {
      out.errors += 1;
      logger.error(`[RETENTION] abandoned-checkout failed for order ${order.id}: ${err.message}`);
    }
  }
  return out;
}

// ── 2. Watchlist alerts ─────────────────────────────────────────────────────

export async function watchlistAlerts({ limit = 300, now = new Date(), deadline = null } = {}) {
  const out = { rows: 0, priceDrops: 0, sold: 0, errors: 0 };
  // Only a listing that is still for sale or has sold can earn an email, so
  // `!inner` + the status filter leave the rows for ended/withdrawn listings in
  // the database instead of pulling them (with their nested joins) every day
  // just to skip them. Ordered so the page is stable rather than whatever the
  // planner returns first.
  const { data: rows, error } = await supabase
    .from('watchlist')
    .select('id, user_id, listing_id, price_at_add_aud, last_alert_price_aud, sold_alerted_at, listing:listings!inner(id, status, price_aud, shipping_cost_aud, vault_item:vault_items(card_name, set_name))')
    .not('price_at_add_aud', 'is', null)
    .in('listing.status', ['active', 'sold'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  for (const row of rows || []) {
    if (outOfTime(deadline)) { out.outOfTime = true; break; }
    out.rows += 1;
    try {
      const alert = watchlistAlertFor(row, row.listing);
      if (!alert) continue;
      const type = alert.kind === 'sold' ? 'watchlist_sold' : 'watchlist_price_drop';
      if (!(await emailAllowed(row.user_id, type))) continue;
      const contact = await profileContact(row.user_id);
      if (!contact.email) continue;
      const card = row.listing.vault_item?.card_name || 'A card you’re watching';
      const url = `${APP_URL()}/marketplace/${row.listing_id}`;
      if (alert.kind === 'sold') {
        const sent = await sendWatchlistSold({ to: contact.email, name: contact.name, cardName: card, setName: row.listing.vault_item?.set_name, searchUrl: `${APP_URL()}/marketplace?q=${encodeURIComponent(card)}` });
        await supabase.from('watchlist').update({ sold_alerted_at: now.toISOString() }).eq('id', row.id);
        if (sent) out.sold += 1;
      } else {
        const sent = await sendWatchlistPriceDrop({ to: contact.email, name: contact.name, cardName: card, setName: row.listing.vault_item?.set_name, from: alert.from, to: alert.to, pct: alert.pct, url });
        await supabase.from('watchlist').update({ last_alert_price_aud: alert.to }).eq('id', row.id);
        if (sent) out.priceDrops += 1;
      }
    } catch (err) {
      out.errors += 1;
      logger.error(`[RETENTION] watchlist alert failed for row ${row.id}: ${err.message}`);
    }
  }
  return out;
}

// ── 3. Saved-search alerts ──────────────────────────────────────────────────

export async function savedSearchAlerts({ limit = 200, now = new Date(), deadline = null } = {}) {
  const out = { searches: 0, emailed: 0, errors: 0 };
  // Least-recently alerted first, so if a run is cut short the searches it
  // skipped are at the front of tomorrow's page rather than starved.
  const { data: searches, error } = await supabase
    .from('saved_searches')
    .select('id, user_id, name, params, created_at, last_alerted_at, alerts_enabled')
    .eq('alerts_enabled', true)
    .order('last_alerted_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  for (const s of searches || []) {
    if (outOfTime(deadline)) { out.outOfTime = true; break; }
    out.searches += 1;
    try {
      const f = parseSavedSearch(s.params);
      const since = s.last_alerted_at || s.created_at;
      let q = supabase
        .from('listings')
        .select('id, price_aud, created_at, vault_item:vault_items!inner(card_name, set_name, grading_company, category_id, franchise_id, set_id)')
        .eq('status', 'active')
        .neq('listing_type', 'vault')
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);
      if (f.min) q = q.gte('price_aud', f.min);
      if (f.max) q = q.lte('price_aud', f.max);
      if (f.graded === 'graded') q = q.neq('vault_item.grading_company', 'raw');
      if (f.graded === 'raw') q = q.eq('vault_item.grading_company', 'raw');
      if (f.set) q = q.eq('vault_item.set_id', f.set);
      else if (f.franchise) q = q.eq('vault_item.franchise_id', f.franchise);
      else if (f.cat) q = q.eq('vault_item.category_id', f.cat);
      if (f.q) q = q.or(buildCardSearchOr(f.q), { referencedTable: 'vault_item' });
      const { data: matches, error: mErr } = await q;
      if (mErr) throw mErr;
      // Always advance the marker so the same listings aren't re-sent.
      await supabase.from('saved_searches').update({ last_alerted_at: now.toISOString() }).eq('id', s.id);
      if (!matches?.length) continue;
      if (!(await emailAllowed(s.user_id, 'saved_search_match'))) continue;
      const contact = await profileContact(s.user_id);
      if (!contact.email) continue;
      const sent = await sendSavedSearchMatches({
        to: contact.email, name: contact.name, searchName: s.name,
        searchUrl: `${APP_URL()}/marketplace?${s.params}`,
        matches: matches.map((m) => ({ title: m.vault_item?.card_name || 'Card', set: m.vault_item?.set_name || '', price: round2(m.price_aud), url: `${APP_URL()}/marketplace/${m.id}` })),
      });
      if (sent) out.emailed += 1;
    } catch (err) {
      out.errors += 1;
      logger.error(`[RETENTION] saved-search alert failed for ${s.id}: ${err.message}`);
    }
  }
  return out;
}

// ── 4. Back in stock ────────────────────────────────────────────────────────

export async function restockAlerts({ limit = 200, now = new Date(), deadline = null } = {}) {
  const out = { requests: 0, emailed: 0, errors: 0 };
  // A request only becomes an email once its product is purchasable and in
  // stock, so ask for exactly those: `!inner` plus the same three conditions
  // `inStock` checks below, applied in the database. Requests for products
  // still sold out — the normal state of a restock request — never leave it.
  const { data: requests, error } = await supabase
    .from('shop_restock_requests')
    .select('id, email, user_id, product_id, product:shop_products!inner(id, title, slug, category, colour, family_sku, stock_quantity, status, price_aud)')
    .is('notified_at', null)
    .in('product.status', PURCHASABLE_SHOP_STATUSES)
    .gt('product.price_aud', 0)
    .or('stock_quantity.is.null,stock_quantity.gt.0', { referencedTable: 'product' })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  for (const r of requests || []) {
    if (outOfTime(deadline)) { out.outOfTime = true; break; }
    out.requests += 1;
    try {
      const p = r.product;
      if (!p) { await supabase.from('shop_restock_requests').update({ notified_at: now.toISOString() }).eq('id', r.id); continue; }
      // The query already narrowed to in-stock products; this is the belt to
      // that brace, and the one place the rule is spelled out.
      const inStock = PURCHASABLE_SHOP_STATUSES.includes(p.status) && (p.stock_quantity == null || Number(p.stock_quantity) > 0) && Number(p.price_aud) > 0;
      if (!inStock) continue;
      const sent = await sendBackInStock({ to: r.email, productTitle: p.title, priceAud: round2(p.price_aud), url: `${APP_URL()}${shopProductPath(p)}` });
      await supabase.from('shop_restock_requests').update({ notified_at: now.toISOString() }).eq('id', r.id);
      if (sent) out.emailed += 1;
    } catch (err) {
      out.errors += 1;
      logger.error(`[RETENTION] restock alert failed for ${r.id}: ${err.message}`);
    }
  }
  return out;
}

// ── 5. Welcome offers the signup page never issued ──────────────────────────

export async function welcomeOffersForNewAccounts({ limit = 100, now = new Date() } = {}) {
  const out = { candidates: 0, issued: 0, errors: 0 };
  const since = new Date(now.getTime() - 48 * HOUR_MS).toISOString();
  const { data: profiles, error } = await supabase
    .from('profiles').select('id').gte('created_at', since).limit(limit);
  if (error) throw error;
  const ids = (profiles || []).map((p) => p.id);
  if (ids.length === 0) return out;
  const { data: existing } = await supabase.from('welcome_offers').select('user_id').in('user_id', ids);
  const has = new Set((existing || []).map((r) => r.user_id));
  for (const id of ids) {
    if (has.has(id)) continue;
    out.candidates += 1;
    try {
      await issueWelcomeOffer(id);
      out.issued += 1;
    } catch (err) {
      // The service's own guards (account too old, no email) are expected here.
      if (err.statusCode) continue;
      out.errors += 1;
      logger.error(`[RETENTION] welcome offer issue failed for ${id}: ${err.message}`);
    }
  }
  return out;
}

// ── 6. Welcome-offer expiry reminders ───────────────────────────────────────

export async function welcomeOfferReminders({ limit = 200, now = new Date(), daysBefore = 7, deadline = null } = {}) {
  const out = { candidates: 0, emailed: 0, errors: 0 };
  const windowEnd = new Date(now.getTime() + daysBefore * DAY_MS).toISOString();
  const { data: offers, error } = await supabase
    .from('welcome_offers')
    .select('id, user_id, code, discount_pct, expires_at, discount_redeemed_at, reminder_sent_at')
    .is('discount_redeemed_at', null)
    .is('reminder_sent_at', null)
    .gt('expires_at', now.toISOString())
    .lte('expires_at', windowEnd)
    .order('expires_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  for (const o of offers || []) {
    if (outOfTime(deadline)) { out.outOfTime = true; break; }
    out.candidates += 1;
    try {
      const contact = await profileContact(o.user_id);
      await supabase.from('welcome_offers').update({ reminder_sent_at: now.toISOString() }).eq('id', o.id);
      if (!contact.email) continue;
      const sent = await sendWelcomeOfferReminder({ to: contact.email, name: contact.name, code: o.code, discountPct: Number(o.discount_pct), expiresAt: o.expires_at });
      if (sent) out.emailed += 1;
    } catch (err) {
      out.errors += 1;
      logger.error(`[RETENTION] welcome reminder failed for ${o.id}: ${err.message}`);
    }
  }
  return out;
}

export async function runRetentionSweep({ now = new Date(), budgetMs = DEFAULT_BUDGET_MS } = {}) {
  const summary = {};
  const deadline = Date.now() + budgetMs;
  const jobs = [
    ['abandonedCheckouts', abandonedCheckouts],
    ['watchlistAlerts', watchlistAlerts],
    ['savedSearchAlerts', savedSearchAlerts],
    ['restockAlerts', restockAlerts],
    ['welcomeOffersForNewAccounts', welcomeOffersForNewAccounts],
    ['welcomeOfferReminders', welcomeOfferReminders],
  ];
  for (const [name, job] of jobs) {
    if (outOfTime(deadline)) {
      // Better a job that waits a day than a 504 that loses the summary (and
      // the stamps already written are what keep tomorrow's run from repeating).
      summary[name] = { skipped: 'out of time' };
      logger.warn(`[RETENTION] ${name} skipped: sweep out of time`);
      continue;
    }
    try {
      summary[name] = await job({ now, deadline });
    } catch (err) {
      summary[name] = { error: err.message };
      logger.error(`[RETENTION] ${name} failed: ${err.message}`);
    }
  }
  logger.info(`[RETENTION] sweep: ${JSON.stringify(summary)}`);
  return summary;
}
