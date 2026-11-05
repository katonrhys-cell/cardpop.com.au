/**
 * AI usage ledger and monthly allowances.
 *
 * Every Claude call the backend makes records one row in `ai_usage_events`
 * (tokens in/out, cache reads/writes, web searches, the cost in USD at the
 * published price, the feature and the member it was for). Admin → Finance
 * reads the totals next to revenue, and the member-facing AI features (card
 * scans, grade estimates, listing descriptions) check a monthly allowance
 * against the same rows before they spend anything.
 *
 * Recording is best-effort: a failed write is logged and never fails the
 * request that made the call. The allowance check fails OPEN for the same
 * reason (a ledger outage must not switch the features off).
 */
import supabase from './supabaseClient.js';
import logger from './logger.js';
import { getPlatformSetting } from './platformSettings.js';

// USD per million tokens, first-party Claude API rates (Anthropic pricing,
// October 2026). Cache writes are the 5-minute TTL rate (1.25x input); cache
// reads are as published. Update here when Anthropic changes a price — the
// ledger stores the computed cost per row, so old rows keep the price they
// were charged at.
export const MODEL_PRICES_USD_PER_MTOK = Object.freeze({
  'claude-haiku-5-5': { input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-sonnet-5-5': { input: 2.00, output: 10.00, cacheRead: 0.20, cacheWrite: 2.50 },
  'claude-opus-5-5': { input: 4.00, output: 20.00, cacheRead: 0.20, cacheWrite: 5.00 },
});
// Server-side web search: USD per search request.
export const WEB_SEARCH_USD_PER_REQUEST = 0.01;
// Message Batches API requests are billed at half the standard rate.
export const BATCH_DISCOUNT = 0.5;

/**
 * Features with a member-facing monthly allowance (platform_settings key →
 * default; 0 = unlimited). One allowance unit is one recorded call under that
 * feature name: a card scan's escalation to the stronger model is recorded as
 * `card_scan_escalation`, so it costs the member nothing extra.
 */
export const AI_ALLOWANCES = Object.freeze({
  card_scan: { setting: 'ai_monthly_limit_card_scan', default: 300 },
  grade_estimate: { setting: 'ai_monthly_limit_grade_estimate', default: 30 },
  card_description: { setting: 'ai_monthly_limit_card_description', default: 300 },
});

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Normalise an Anthropic `usage` object (Messages API or batch result). */
export function normaliseUsage(usage = {}) {
  return {
    input_tokens: num(usage.input_tokens),
    output_tokens: num(usage.output_tokens),
    cache_read_tokens: num(usage.cache_read_input_tokens),
    cache_write_tokens: num(usage.cache_creation_input_tokens),
    web_search_requests: num(usage.server_tool_use?.web_search_requests),
  };
}

/**
 * Cost in USD for one call. Unknown models are costed at the most expensive
 * listed rate, so a model added without a price shows up high, not free.
 */
export function costUsd(model, usage, { batch = false } = {}) {
  const u = normaliseUsage(usage);
  const p = MODEL_PRICES_USD_PER_MTOK[model] || MODEL_PRICES_USD_PER_MTOK['claude-opus-5-5'];
  const tokens = (u.input_tokens * p.input
    + u.output_tokens * p.output
    + u.cache_read_tokens * p.cacheRead
    + u.cache_write_tokens * p.cacheWrite) / 1_000_000;
  const total = tokens * (batch ? BATCH_DISCOUNT : 1) + u.web_search_requests * WEB_SEARCH_USD_PER_REQUEST;
  return Math.round(total * 1_000_000) / 1_000_000; // micro-dollar precision
}

/**
 * Record one call. Never throws.
 * @param {{ feature: string, model: string, usage: object, userId?: string|null, batch?: boolean }} entry
 */
export async function recordAiUsage({ feature, model, usage, userId = null, batch = false }) {
  if (!feature || !model || !usage) return;
  try {
    const row = {
      feature,
      model,
      user_id: userId || null,
      batch: Boolean(batch),
      ...normaliseUsage(usage),
      cost_usd: costUsd(model, usage, { batch }),
    };
    const { error } = await supabase.from('ai_usage_events').insert(row);
    if (error) throw error;
  } catch (err) {
    logger.warn(`[AI_USAGE] could not record ${feature} usage: ${err.message}`);
  }
}

/** Start of the current month in Australia/Sydney, as an ISO timestamp. */
export function monthStartSydney(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  // Sydney wall-clock "now" as if it were UTC, minus how far into the month we are.
  const wallNow = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = wallNow - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, 1) - offsetMs).toISOString();
}

/**
 * How much of this month's allowance a member has used. `limit` 0 means
 * unlimited. Fails open (allowed) if the ledger can't be read.
 */
export async function checkAiAllowance(userId, feature, { now = new Date() } = {}) {
  const spec = AI_ALLOWANCES[feature];
  if (!spec || !userId) return { allowed: true, used: 0, limit: 0 };
  try {
    const raw = await getPlatformSetting(spec.setting, spec.default);
    const limit = raw === null || raw === '' ? spec.default : Math.max(0, Math.floor(num(raw)));
    if (limit === 0) return { allowed: true, used: 0, limit: 0 };
    const { count, error } = await supabase
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature', feature)
      .gte('created_at', monthStartSydney(now));
    if (error) throw error;
    const used = count ?? 0;
    return { allowed: used < limit, used, limit };
  } catch (err) {
    logger.warn(`[AI_USAGE] allowance check failed for ${feature}, allowing: ${err.message}`);
    return { allowed: true, used: 0, limit: 0 };
  }
}
