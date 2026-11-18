// The wholesale cost pair on the shop product form: ex GST and inc GST.
//
// Typing either figure fills in the other at 10% GST as you type. A pair an
// admin has deliberately set apart (a GST-free supplier, where ex = inc) is
// left alone: the other side only follows while it is blank or still the
// figure this file would have worked out.

const GST_MULTIPLIER = 1.1;

const round2 = (n) => Math.round(n * 100) / 100;

const parse = (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const incFromEx = (ex) => round2(ex * GST_MULTIPLIER);
export const exFromInc = (inc) => round2(inc / GST_MULTIPLIER);

/** True when the two figures are the same cost at 10% GST (to the cent). */
export function costPairInSync(ex, inc) {
  const e = parse(ex);
  const i = parse(inc);
  if (e === null || i === null) return false;
  return incFromEx(e) === round2(i) || exFromInc(i) === round2(e);
}

/**
 * The next { ex, inc } form strings after the admin edits one side.
 *
 * @param {{ex: string, inc: string}} prev the pair before the edit
 * @param {'ex'|'inc'} field which side was typed into
 * @param {string} value what it now holds
 */
export function syncWholesaleCost(prev, field, value) {
  const other = field === 'ex' ? 'inc' : 'ex';
  const next = { ex: prev.ex ?? '', inc: prev.inc ?? '', [field]: value };
  const otherBlank = String(prev[other] ?? '').trim() === '';
  if (!otherBlank && !costPairInSync(prev.ex, prev.inc)) return next;

  const n = parse(value);
  if (n === null) {
    // Cleared (or mid-typing something that isn't a number yet).
    if (String(value ?? '').trim() === '') next[other] = '';
    return next;
  }
  next[other] = (field === 'ex' ? incFromEx(n) : exFromInc(n)).toFixed(2);
  return next;
}
