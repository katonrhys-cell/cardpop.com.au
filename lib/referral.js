// Partner referral attribution — session-only by design. Visiting any page
// with ?ref=CODE stashes the code in sessionStorage; checkout and the trial
// flow pick it up and send it to the server, which does the real validation.

const REF_STORAGE_KEY = 'cardpop_ref_code';
const REF_SHAPE = /^[A-Z0-9][A-Z0-9-]{3,19}$/;

export function storeReferralCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!REF_SHAPE.test(code)) return null;
  try {
    sessionStorage.setItem(REF_STORAGE_KEY, code);
  } catch {
    return null; // storage unavailable (private mode etc.) — attribution just skips
  }
  return code;
}

export function getReferralCode() {
  try {
    return sessionStorage.getItem(REF_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}
