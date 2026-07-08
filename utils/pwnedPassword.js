import apiServerClient from '@/lib/apiServerClient.js';

// Client-side "leaked password protection", backfilling the Supabase Auth Pro
// feature on the free plan. Uses HaveIBeenPwned's Pwned Passwords range API via
// k-anonymity: we SHA-1 the password IN THE BROWSER and send only the first 5
// hex chars of the hash to our backend proxy (/auth/password/pwned-check),
// which forwards it to HIBP. The password and its full hash never leave the
// browser; we match the returned suffix list locally.
//
// Fails OPEN (returns 0) on any error — a network blip, a blocked request, or a
// browser without SubtleCrypto must never stop a legitimate signup. This
// mirrors how Supabase treats the check as advisory rather than a hard gate.

/**
 * @param {string} password
 * @returns {Promise<number>} how many known breaches contain this password (0 = none / check unavailable)
 */
export async function pwnedPasswordCount(password) {
  try {
    if (!password || !globalThis.crypto?.subtle) return 0;

    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await apiServerClient.fetch(`/auth/password/pwned-check?prefix=${prefix}`);
    if (!res.ok) return 0;

    const text = await res.text();
    for (const line of text.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      if (line.slice(0, idx).trim().toUpperCase() === suffix) {
        return parseInt(line.slice(idx + 1), 10) || 0;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * @param {string} password
 * @returns {Promise<boolean>} true if the password appears in a known breach
 */
export async function isPasswordPwned(password) {
  return (await pwnedPasswordCount(password)) > 0;
}
