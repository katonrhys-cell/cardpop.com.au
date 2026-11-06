import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// Every notification type the code writes must exist in the
// notification_type enum. An unknown value is a hard error in Postgres:
// in a trigger it aborted every community event submission from 2026-07-31
// to 2026-11-06 ('event_pending_review'), and in an API insert it silently
// dropped the bell. See 20261106061312_admin_review_notification_types.sql.

const ROOT = join(import.meta.dirname, '..', '..');

// The enum as it existed before this repo tracked migrations (read from
// production, 2026-11-06). Later values come from `add value` migrations.
const BASE_ENUM = [
  'bid_placed', 'bid_outbid', 'auction_won', 'auction_ended', 'offer_received', 'offer_accepted',
  'offer_declined', 'offer_countered', 'order_update', 'review_received', 'price_alert',
  'event_approved', 'event_rejected', 'system', 'message', 'follow', 'comment', 'comment_reply',
  'listing_sold', 'listing_approved', 'listing_rejected', 'verification_approved',
  'verification_rejected', 'payment_received', 'withdrawal_processed', 'security_alert',
  'watchlist_price_drop', 'watchlist_bid', 'watchlist_ending_soon', 'auction_ending_soon',
  'order_payment_unfulfilled',
];

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});

const migrations = walk(join(ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'));
const enumValues = new Set(BASE_ENUM);
for (const f of migrations) {
  for (const m of readFileSync(f, 'utf8').matchAll(/notification_type\s+add\s+value\s+if\s+not\s+exists\s+'([a-z_]+)'/gi)) {
    enumValues.add(m[1]);
  }
}

// Types written by the API: `from('notifications').insert(...)` calls and
// alertAdminsToReview({ type }) — read the `type:` keys in those statements.
const writtenBySrc = () => {
  const found = [];
  for (const f of walk(join(ROOT, 'src')).filter((p) => p.endsWith('.js'))) {
    const src = readFileSync(f, 'utf8');
    const starts = [...src.matchAll(/from\('notifications'\)\s*\.insert\(|alertAdminsToReview\(\{/g)].map((m) => m.index);
    for (const start of starts) {
      const chunk = src.slice(start, start + 900);
      const end = chunk.search(/\n\s*\}\)\)?\)?;/);
      for (const m of (end > 0 ? chunk.slice(0, end) : chunk).matchAll(/\btype:\s*'([a-z_]+)'/g)) {
        found.push({ type: m[1], file: f.replace(`${ROOT}/`, '') });
      }
    }
  }
  return found;
};

// Types passed to create_notification() by the latest definition of each
// SQL function (a later migration's `create or replace` supersedes earlier ones).
const writtenBySql = () => {
  const latest = new Map();
  for (const f of migrations.sort()) {
    const sql = readFileSync(f, 'utf8');
    for (const m of sql.matchAll(/create\s+or\s+replace\s+function\s+(public\.)?([a-z_]+)\s*\(([\s\S]*?)\$(function)?\$\s*;/gi)) {
      latest.set(m[2], { body: m[3], file: f.replace(`${ROOT}/`, '') });
    }
  }
  const found = [];
  for (const [fn, { body, file }] of latest) {
    for (const m of body.matchAll(/create_notification\(\s*[^,]+,\s*'([a-z_]+)'/g)) {
      found.push({ type: m[1], file: `${file} (${fn})` });
    }
  }
  return found;
};

describe('notification types', () => {
  it('finds the writers it is meant to check', () => {
    expect(writtenBySrc().length).toBeGreaterThan(20);
    expect(writtenBySql().map((w) => w.type)).toContain('event_pending_review');
  });

  it('every type the API writes exists in the enum', () => {
    const missing = writtenBySrc().filter((w) => !enumValues.has(w.type));
    expect(missing).toEqual([]);
  });

  it('every type a database function writes exists in the enum', () => {
    const missing = writtenBySql().filter((w) => !enumValues.has(w.type));
    expect(missing).toEqual([]);
  });
});
