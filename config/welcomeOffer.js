/**
 * Welcome-offer configuration — single source of truth.
 *
 * Every new registration gets a unique single-use code (e.g. POP-K7QN-4WX2),
 * emailed separately from the verification email. It gives a percentage
 * discount on the user's first order. (It also used to confirm a free
 * membership trial — retired with the yearly plans; WELCOME_TRIAL_DAYS = 0.)
 *
 * Like `config/subscription.js`, this file is dependency-free so it can be
 * imported from the React SPA (via the `@/` alias) and from the Express
 * backend (via a relative path). The `welcome_offers` table stores these
 * values per-row at issue time, so changing them here only affects new codes.
 */

/**
 * Length of the free membership trial the code unlocks, in days. `0` = none:
 * memberships are charged at sign-up (config/subscription.js TRIAL_DAYS), so
 * a new code is the first-order discount only and the email says just that.
 */
export const WELCOME_TRIAL_DAYS = 0;

/** Discount applied to the redeemer's first order (percent of item subtotal). */
export const WELCOME_DISCOUNT_PCT = 10;

/** How long a code stays valid after registration, in days. */
export const WELCOME_CODE_EXPIRY_DAYS = 90;

/** Prefix on every generated code. */
export const WELCOME_CODE_PREFIX = 'POP';

/**
 * A code can only be issued within this many hours of the account being
 * created — prevents long-standing accounts from claiming the new-member offer.
 */
export const WELCOME_ISSUE_WINDOW_HOURS = 48;

export default {
  WELCOME_TRIAL_DAYS,
  WELCOME_DISCOUNT_PCT,
  WELCOME_CODE_EXPIRY_DAYS,
  WELCOME_CODE_PREFIX,
  WELCOME_ISSUE_WINDOW_HOURS,
};
