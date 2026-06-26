// Whether a profile is identity-verified.
//
// `profiles.is_verified` is a boolean column, but historically parts of the UI
// compared it to the string 'true' (a relic of an earlier text representation).
// Those string-only checks silently failed for boolean-verified users, hiding
// their badge. This helper accepts both so verification displays consistently
// no matter which shape a given query returns.
export const isVerified = (value) => value === true || value === 'true';

export default isVerified;
