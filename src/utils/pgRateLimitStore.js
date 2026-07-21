import { supabase } from './supabaseClient.js';
import logger from './logger.js';

// A shared express-rate-limit Store backed by Postgres (via the rate_limit_hit
// RPC, migration 20260721072719), so a limiter's counter is GLOBAL across all
// serverless instances instead of per-instance in memory. Use only for
// security-sensitive, low-volume limiters (see endpoint-rate-limit.js) — a DB
// round-trip per request is fine there but wrong for high-volume limiters.
//
// FAILS OPEN: if the store can't be reached, increment() reports a single hit so
// the limiter never trips. A datastore outage must never lock legitimate users
// out of login/MFA/checkout — it just degrades to "no shared limit" (same as the
// old in-memory behaviour), never to "deny everyone".
export default class PgRateLimitStore {
  constructor(name) {
    // Namespaces keys so different limiters sharing an IP/user key never collide.
    this.name = name || 'rl';
    this.windowMs = 60_000;
    this.localKeys = false;
    this._warned = false;
  }

  init(options) {
    this.windowMs = options?.windowMs ?? this.windowMs;
  }

  _key(key) {
    return `${this.name}:${key}`;
  }

  _warnOnce(err) {
    if (this._warned) return;
    this._warned = true;
    logger.warn(`[RATE_LIMIT] Postgres store '${this.name}' unavailable, failing open: ${err?.message || err}`);
  }

  async increment(key) {
    try {
      const { data, error } = await supabase.rpc('rate_limit_hit', {
        p_key: this._key(key),
        p_window_ms: this.windowMs,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const totalHits = Number(row?.total_hits);
      if (!Number.isFinite(totalHits)) throw new Error('rate_limit_hit returned no count');
      const resetTime = row?.reset_at ? new Date(row.reset_at) : new Date(Date.now() + this.windowMs);
      return { totalHits, resetTime };
    } catch (err) {
      // Fail open: report a first-and-only hit so the caller is never blocked.
      this._warnOnce(err);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  // The sensitive limiters don't use skipFailedRequests/skipSuccessfulRequests,
  // so decrement is a best-effort no-op-on-error; resetKey clears a key.
  async decrement() {
    // No-op: these limiters never call decrement (no skip* options set).
  }

  async resetKey(key) {
    try {
      await supabase.rpc('rate_limit_reset', { p_key: this._key(key) });
    } catch (err) {
      this._warnOnce(err);
    }
  }
}
