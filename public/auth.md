# Authenticating with CardPop for AI Agents

CardPop is an Australian trading card marketplace. This document tells software
agents how authentication works against the CardPop API so they can call
protected endpoints on a real user's behalf.

- **Machine-readable metadata:** [`/.well-known/oauth-protected-resource`](https://cardpop.com.au/.well-known/oauth-protected-resource) (RFC 9728)
- **API description:** [`/openapi.json`](https://cardpop.com.au/openapi.json)
- **Agent guidance:** [`/llms.txt`](https://cardpop.com.au/llms.txt)
- **MCP server card:** [`/.well-known/mcp/server-card.json`](https://cardpop.com.au/.well-known/mcp/server-card.json)

## What needs authentication

Most of CardPop is browsable without any credentials. These surfaces are
**public** and need no token:

- `GET https://cardpop.com.au/api/health` — service health.
- The read-only MCP server at `https://cardpop.com.au/api/mcp` — search buyable
  listings and look up live AUD card prices. No auth required.
- Public marketplace, shop, price and collection pages (see `/llms.txt`).

These surfaces are **protected** and require a bearer token belonging to a
signed-in CardPop user: account and profile data, the personal Vault, cart and
checkout, trades, and admin operations.

## How authentication works

CardPop delegates identity to **Supabase Auth** (GoTrue). It is **not** a
standalone OAuth 2.0 authorization server, so there is no client-credentials
grant and no dynamic client registration (RFC 7591). An agent authenticates as
a **real CardPop user account** and then presents that user's short-lived access
token to the CardPop API.

- **Authorization server (token issuer):** `https://odoglvswwymyjuwlonkf.supabase.co/auth/v1`
- **Token type:** JSON Web Token (JWT), sent as `Authorization: Bearer <access_token>`.
- **Apikey requirement:** Supabase's own auth endpoints (token, user, JWKS,
  discovery) are gated behind Supabase's public, publishable anon key, which
  must be sent as an `apikey` header. This key is not a secret — it is shipped in
  CardPop's browser client:

  ```
  apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I
  ```

### 1. Obtain an access token from Supabase

Sign in as an existing CardPop user (email/password, or one of the enabled OAuth
providers — Google, GitHub, Facebook). Example password grant:

```http
POST https://odoglvswwymyjuwlonkf.supabase.co/auth/v1/token?grant_type=password
apikey: <public anon key above>
Content-Type: application/json

{ "email": "user@example.com", "password": "..." }
```

The response contains an `access_token` (the JWT) and a `refresh_token`. Refresh
via `POST /auth/v1/token?grant_type=refresh_token` when it expires (~1 hour).
Token signing keys are published at
`https://odoglvswwymyjuwlonkf.supabase.co/auth/v1/.well-known/jwks.json`
(also requires the `apikey` header).

### 2. Call the CardPop API with the token

```http
GET https://cardpop.com.au/api/<protected-path>
Authorization: Bearer <access_token>
```

CardPop validates the token server-side on every protected request. An invalid,
expired, or missing token returns `401` with a `WWW-Authenticate` header that
points back to `/.well-known/oauth-protected-resource`.

## Registration

There is no agent- or machine-specific registration endpoint. Agents act as an
existing human user account. To operate on CardPop, create a normal account at
[https://cardpop.com.au/signup](https://cardpop.com.au/signup) and authenticate
as above.

## Contact

Questions about programmatic access: `developers@cardpop.com.au`.
