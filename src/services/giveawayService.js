import crypto from 'crypto';

/**
 * Pick a winner from an entry pool with a cryptographic random index and
 * return a record that explains the result: pool size, the index drawn, a
 * nonce for the audit trail, and the winning entry.
 *
 * `randomInt` is injectable so the choice can be tested deterministically.
 */
export function drawWinner(entries, { pool = 'verified', randomInt = crypto.randomInt, now = new Date() } = {}) {
  const eligible = (entries || []).filter((e) => e && (pool === 'all' || e.verified_at));
  if (eligible.length === 0) {
    return { winner: null, record: { pool, count: 0, index: null, nonce: null, drawn_at: now.toISOString() } };
  }
  // Fixed order so the index means the same thing when the draw is reviewed.
  eligible.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
  const index = randomInt(0, eligible.length);
  const nonce = crypto.randomBytes(8).toString('hex');
  return {
    winner: eligible[index],
    record: { pool, count: eligible.length, index, nonce, drawn_at: now.toISOString() },
  };
}

/** Rows → CSV text for the admin export. Quotes every cell. */
export function entriesToCsv(rows, prizes = []) {
  const labelFor = (key) => prizes.find((p) => p.key === key)?.label || key || '';
  const header = ['entered_at', 'instagram_handle', 'prize', 'state', 'postcode', 'verified', 'email', 'name', 'user_id'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  for (const r of rows || []) {
    lines.push([
      r.created_at, r.instagram_handle, labelFor(r.prize_key), r.state, r.postcode,
      r.verified_at ? 'yes' : 'no', r.email || '', r.name || '', r.user_id,
    ].map(q).join(','));
  }
  return `${lines.join('\n')}\n`;
}
