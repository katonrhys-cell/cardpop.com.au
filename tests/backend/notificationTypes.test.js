// Every notification type the code writes must exist in the notification_type
// enum. An unknown value fails the insert ("invalid input value for enum
// notification_type"), and when the insert happens inside a trigger it aborts
// the user's own write — that is how event submissions broke for organisers
// (event_pending_review was used by a trigger but never added to the enum).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');

// Values created on the dashboard before the repo owned the schema — they
// have no `add value` migration. Taken from production pg_enum.
const BASE_VALUES = [
  'bid_placed', 'bid_outbid', 'auction_won', 'auction_ended', 'offer_received',
  'offer_accepted', 'offer_declined', 'offer_countered', 'order_update',
  'review_received', 'price_alert', 'event_approved', 'event_rejected', 'system',
  'message', 'follow', 'comment', 'comment_reply', 'listing_sold',
  'listing_approved', 'listing_rejected', 'verification_approved',
  'verification_rejected', 'payment_received', 'withdrawal_processed',
  'security_alert', 'watchlist_price_drop', 'watchlist_bid',
  'watchlist_ending_soon', 'auction_ending_soon',
];

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function enumValues() {
  const values = new Set(BASE_VALUES);
  for (const f of fs.readdirSync(MIGRATIONS)) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
    for (const m of sql.matchAll(/alter\s+type\s+(?:public\.)?notification_type\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([a-z_]+)'/gi)) {
      values.add(m[1]);
    }
  }
  return values;
}

function usedTypes() {
  const used = new Map();
  const note = (t, where) => { if (!used.has(t)) used.set(t, where); };

  // SQL: create_notification(<user>, '<type>', …)
  for (const f of fs.readdirSync(MIGRATIONS)) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
    for (const m of sql.matchAll(/create_notification\(\s*[^,()]+,\s*'([a-z_]+)'/g)) note(m[1], f);
  }

  // JS: `type: '…'` in the object literals passed to notifications inserts.
  const dirs = ['src', 'api'].map((d) => path.join(ROOT, d)).filter(fs.existsSync);
  for (const file of dirs.flatMap((d) => walk(d, ['.js']))) {
    const code = fs.readFileSync(file, 'utf8');
    for (const m of code.matchAll(/from\(\s*'notifications'\s*\)\s*\.(?:insert|upsert)\(/g)) {
      const window = code.slice(m.index, m.index + 800);
      const t = window.match(/\btype:\s*'([a-z_]+)'/);
      if (t) note(t[1], path.relative(ROOT, file));
    }
  }
  return used;
}

describe('notification_type enum', () => {
  it('contains every notification type the code writes', () => {
    const values = enumValues();
    const missing = [...usedTypes()]
      .filter(([t]) => !values.has(t))
      .map(([t, where]) => `${t} (${where})`);
    expect(missing).toEqual([]);
  });

  it('includes event_pending_review, used by the event-submission trigger', () => {
    expect(enumValues().has('event_pending_review')).toBe(true);
  });
});
