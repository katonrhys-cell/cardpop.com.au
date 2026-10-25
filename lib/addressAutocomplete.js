// Address autocomplete for the checkout shipping form — one import for the UI,
// whichever provider is configured.
//
// Google Places (New) is used when `VITE_GOOGLE_PLACES_API_KEY` is set;
// otherwise Amazon Location when `VITE_AWS_LOCATION_API_KEY` is set; otherwise
// autocomplete is off and the form is plain free-text (the server-side address
// check in src/utils/addressValidation.js still runs either way).
//
// Both providers expose the same shape — `autocompleteAddress(query, { signal })`
// → `[{ placeId, label, place }]` and `resolveSuggestion(suggestion, { signal })`
// → `{ address, suburb, state, postcode, placeId, formatted, verified } | null` —
// so the form never needs to know which one is answering.

import * as google from '@/lib/googlePlaces.js';
import * as amazon from '@/lib/amazonLocation.js';

/** @type {'google' | 'amazon' | null} */
export const ADDRESS_AUTOCOMPLETE_PROVIDER = google.GOOGLE_PLACES_ENABLED
  ? 'google'
  : amazon.AMAZON_LOCATION_ENABLED
    ? 'amazon'
    : null;

export const ADDRESS_AUTOCOMPLETE_ENABLED = ADDRESS_AUTOCOMPLETE_PROVIDER !== null;

const PROVIDER_LABELS = { google: 'Google Places', amazon: 'Amazon Location' };
/** Human-readable provider name for log lines. */
export const ADDRESS_AUTOCOMPLETE_LABEL = PROVIDER_LABELS[ADDRESS_AUTOCOMPLETE_PROVIDER] || 'Address autocomplete';

const impl = ADDRESS_AUTOCOMPLETE_PROVIDER === 'google' ? google : amazon;

export const autocompleteAddress = (query, opts) => impl.autocompleteAddress(query, opts);
export const resolveSuggestion = (suggestion, opts) => impl.resolveSuggestion(suggestion, opts);
