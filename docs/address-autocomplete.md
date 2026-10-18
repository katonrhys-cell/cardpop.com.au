# Address autocomplete (checkout shipping form)

The shipping step of checkout suggests real Australian addresses as the buyer
types, and only lets them continue once they have picked one ("Verified
address"). Two providers are supported; the form itself never knows which one
is answering.

| Layer | File |
|---|---|
| Provider switch (what the UI imports) | `lib/addressAutocomplete.js` |
| Google Places API (New), REST | `lib/googlePlaces.js` |
| Amazon Location Service Places v2, REST | `lib/amazonLocation.js` |
| Suggestion dropdown + verified gate | `components/checkout/ShippingAddressForm.jsx` |
| "Pick a suggestion" check before the till | `pages/CheckoutPage.jsx` → `validateShipping()` |
| Server-side Australia-only check + geocode | `src/utils/addressValidation.js` (unchanged by the browser provider) |

## Which provider runs

`lib/addressAutocomplete.js` picks at build time:

1. `VITE_GOOGLE_PLACES_API_KEY` set → **Google Places**.
2. Otherwise `VITE_AWS_LOCATION_API_KEY` set → **Amazon Location**.
3. Otherwise autocomplete is off: the form is plain free-text and the
   "select a suggestion" gate is skipped. The server still refuses a
   non-Australian address before creating the Stripe session, so this is a
   safe fail-open.

Both modules export the same two functions — `autocompleteAddress(query,
{ signal })` → `[{ placeId, label, place }]` and `resolveSuggestion(pick,
{ signal })` → `{ address, suburb, state, postcode, placeId, formatted,
verified }` — and the same AU-only parsing rules (street + suburb + a
recognised state, else `null`).

If a request fails at runtime (bad key, API not enabled, network), the form
logs the provider's real error message to the console, shows "Address search
is unavailable right now", and degrades to manual entry; the page then drops
the verified-pick requirement for that session.

## Google setup

The integration calls the **Places API (New)** REST endpoints
(`places.googleapis.com/v1/places:autocomplete` and `/v1/places/{id}`) with a
plain `fetch`. It does **not** load the Maps JavaScript SDK — the dropdown is
CardPop's own, so no `<script src="maps.googleapis.com/maps/api/js…">` tag is
needed and the strict CSP (`strict-dynamic` + Trusted Types) stays untouched.
`https://places.googleapis.com` is in `connect-src` in both CSP headers in
`vercel.json`.

In Google Cloud (console.cloud.google.com → the project the key belongs to):

1. **APIs & Services → Library → "Places API (New)" → Enable.** The legacy
   "Places API" is a different product and will answer these calls with a
   403 "has not been used in project" error.
2. **APIs & Services → Credentials → the key → Application restrictions →
   Websites**, and add:
   - `https://cardpop.com.au/*`
   - `https://www.cardpop.com.au/*`
   - `https://*.vercel.app/*` (preview deployments)
   - `http://localhost:3000/*` (local dev)
3. **API restrictions → Restrict key → Places API (New)** only. The key ships
   to every visitor's browser, so these two restrictions are what stops
   someone lifting it from the bundle and billing your project.
4. Billing must be enabled on the project. Autocomplete and the one Place
   Details call per pick share a session token (`sessionToken` in the request)
   so Google bills them as one Autocomplete session; the details call asks for
   `id,formattedAddress,addressComponents` only.

Then set the key:

- **Vercel → Settings → Environment Variables** → `VITE_GOOGLE_PLACES_API_KEY`
  for Production and Preview. It is a `VITE_` build-time variable, so a
  redeploy is needed after setting it.
- Locally, `.env` → `VITE_GOOGLE_PLACES_API_KEY=…`.

Never commit the key to the repo — `.env.example` keeps the blank placeholder.

### Verifying

Open `/checkout` with an item in the cart, type three or more characters of a
street address and the dropdown should list Australian addresses. Picking one
fills Suburb / State / Postcode (read-only) and shows the green "Verified
address" line. If the field falls back to "Street Address" with the
"unavailable" note, the console `[address] Google Places autocomplete failed:
403 — …` line names the cause (API not enabled, referrer not allowed, key
restricted to the wrong API).

## Amazon Location setup

See the `VITE_AWS_LOCATION_*` / `AWS_LOCATION_*` block in `.env.example`. The
server-side geocode check (`AWS_LOCATION_API_KEY`) is separate from the
browser suggestions and keeps running whichever browser provider is set; with
no server key it is skipped (fail-open) — `checkAustralianAddress()` still
blocks non-Australian addresses from the typed fields.

## Tests

- `tests/frontend/googlePlaces.test.js` — Google parsing, request shape
  (key in a header, AU-only, session token reuse), error surfacing.
- `tests/frontend/amazonLocation.test.js` — Amazon parsing.
- `tests/backend/addressValidation.test.js` — the server-side gate.
