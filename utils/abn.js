// Australian Business Number (ABN) helpers — shared by the checkout billing
// form (frontend) and the Stripe checkout route (backend). An ABN is 11 digits
// with a published modulus-89 checksum, so a typo can be caught before the
// order is created and before the number is attached to Stripe as an `au_abn`
// tax id for the buyer's tax invoice.

// Official ABN weighting (ATO). The first digit has 1 subtracted from it before
// weighting; the weighted sum is valid when divisible by 89.
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/** Strip spaces and any non-digit formatting, returning just the digits. */
export function normalizeAbn(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** True when `value` is a syntactically valid, checksum-passing ABN. */
export function isValidAbn(value) {
  const digits = normalizeAbn(value);
  if (digits.length !== 11) return false;
  const nums = digits.split('').map(Number);
  nums[0] -= 1;
  const sum = nums.reduce((acc, n, i) => acc + n * ABN_WEIGHTS[i], 0);
  return sum % 89 === 0;
}

/** Pretty "51 824 753 556" grouping for display; returns input unchanged if not 11 digits. */
export function formatAbn(value) {
  const digits = normalizeAbn(value);
  if (digits.length !== 11) return String(value ?? '');
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}
