# Oracle card catalogue

CardPop's marketplace data (listings, stock, checkout) lives entirely in Supabase.
This integration adds a **separate, read-only reference catalogue** — hosted on
an Oracle Autonomous Database — of canonical card data (name, set, card number,
rarity, edition, images). It does not replace or touch `shop_products` or any
other Supabase table. It plays the same role as the free Pokémon TCG / Scryfall
/ YGOPRODeck adapters in `src/routes/catalog.js`, just backed by our own data
instead of a public API — useful for cards those free APIs don't cover (sports
cards, for example) and anything catalogued in-house.

Two things use it:
- **Search/autocomplete** when a seller creates a listing (`GET /catalog/search`,
  `GET /catalog/autocomplete` — Oracle results are merged in alongside whichever
  free API matches the collection).
- **OCR match verification** (`POST /catalog/match`) — after `src/routes/card-ocr.js`
  extracts fields from a scanned card image, this endpoint looks up candidates in
  the catalogue so the scan result can be checked against a canonical record
  instead of trusted as-is.

The connection lives entirely in the backend (`src/utils/oracleClient.js`,
`src/routes/catalog.js`). The frontend never sees Oracle credentials — same
pattern as eBay/Stripe.

---

## Why Thin mode, and what that means for Vercel

`node-oracledb` (the npm package `oracledb`) has two modes:

- **Thick mode** — needs the native Oracle Instant Client binaries installed
  alongside Node. Not viable in a Vercel serverless function.
- **Thin mode** — pure JavaScript, no native binaries. This is the driver's
  **default** as of v6+, which is what makes this integration possible at all
  on Vercel. `src/utils/oracleClient.js` never calls `oracledb.initOracleClient()`,
  so it always runs Thin.

Thin mode can connect straight from the wallet files (`tnsnames.ora`,
`sqlnet.ora`, `cwallet.sso`) without any OS-level install — it just needs those
files on disk at request time, which is the whole reason the wallet has to be
shipped in as an env var and unpacked into `/tmp` on cold start (see below).

---

## 1. Create a scoped-down app user + the catalogue table

Don't use `ADMIN` for the app's day-to-day connection. Run this in the OCI
console's **Database Actions → SQL** (or SQLcl) **as ADMIN**, once:

```sql
-- Run as ADMIN. Replace the password — pick your own strong value, don't reuse
-- the ADMIN password, and don't paste the real password anywhere outside your
-- own password manager / the Vercel env var field.
CREATE USER cardpop_catalogue IDENTIFIED BY "REPLACE_WITH_A_STRONG_PASSWORD";
GRANT CREATE SESSION TO cardpop_catalogue;
GRANT CREATE TABLE TO cardpop_catalogue;
GRANT CREATE SEQUENCE TO cardpop_catalogue;
ALTER USER cardpop_catalogue QUOTA UNLIMITED ON DATA;
```

Then **reconnect as `cardpop_catalogue`** (not ADMIN) and create the schema it
owns:

```sql
CREATE TABLE card_catalogue (
  id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_name        VARCHAR2(255) NOT NULL,
  set_name         VARCHAR2(255),
  card_number      VARCHAR2(50),
  category         VARCHAR2(50),   -- pokemon | magic | yugioh | sports | other
  rarity           VARCHAR2(100),
  edition          VARCHAR2(50),   -- e.g. 1st Edition, Unlimited
  is_holo          NUMBER(1,0) DEFAULT 0,
  language         VARCHAR2(50),
  image_url_front  VARCHAR2(1000),
  image_url_back   VARCHAR2(1000),
  created_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE INDEX idx_card_catalogue_name     ON card_catalogue (card_name);
CREATE INDEX idx_card_catalogue_set_num  ON card_catalogue (set_name, card_number);
CREATE INDEX idx_card_catalogue_category ON card_catalogue (category);
```

The app code (`src/routes/catalog.js`) queries exactly these column names —
if you rename any of them, update the `SELECT`s there too.

`cardpop_catalogue` owns the table, so no extra `GRANT`s are needed for it to
read/write its own data. Load your card data into this table however you like
(SQL inserts, a CSV import via Database Actions, an external ETL — nothing in
this repo does that part yet).

---

## 2. Get the wallet ready for a serverless env var

Wallet-based mTLS means the driver needs a small folder of files
(`tnsnames.ora`, `sqlnet.ora`, `cwallet.sso`, …), not just a connection string.
Vercel env vars are just strings, so the whole wallet is zipped, base64-encoded
into one env var, and unpacked into `/tmp` the first time a serverless
container handles a request (`ensureWalletExtracted()` in `oracleClient.js`).

1. OCI console → your Autonomous Database → **Database Connection** → **Download
   Wallet**. Choose **Instance Wallet** (not a regional wallet). Set a wallet
   password when prompted — you can leave `walletPassword` unset in the app
   config below if you keep using the auto-login `cwallet.sso`, which is the
   default and doesn't need a password at connect time. Only set
   `ORACLE_WALLET_PASSWORD` if you deliberately switch to the password-protected
   `ewallet.p12`.
2. Base64-encode the downloaded zip **without unzipping it** — the app extracts
   it itself:
   ```bash
   base64 -i Wallet_yourdbname.zip | tr -d '\n' > wallet.b64.txt
   ```
   (On Linux, `base64 -w0` does the same thing in one step.)
3. Open `tnsnames.ora` inside the zip (just to read it, don't need to extract
   permanently) and note one of the service aliases, e.g. `yourdbname_medium`,
   `yourdbname_high`, `yourdbname_low`. `_medium` is a reasonable default for
   catalogue lookups — `_high` reserves more parallelism than a lookup query
   needs, `_low` is fine too if you want to be conservative about consumer-group
   usage.

---

## 3. Set the environment variables

**In Vercel** (Dashboard → Settings → Environment Variables — production, and
Preview if you want PRs to be able to test this too):

| Variable | Value |
|---|---|
| `ORACLE_DB_USER` | `cardpop_catalogue` |
| `ORACLE_DB_PASSWORD` | the password you set in step 1 |
| `ORACLE_DB_CONNECT_STRING` | the TNS alias from step 2.3, e.g. `yourdbname_medium` |
| `ORACLE_WALLET_ZIP_B64` | the full contents of `wallet.b64.txt` from step 2.2 |
| `ORACLE_WALLET_PASSWORD` | *(optional)* only if you're using the password-protected `ewallet.p12` instead of the default auto-login wallet |

All five (four, if you skip the optional one) need to be set together — if any
of `ORACLE_DB_USER` / `ORACLE_DB_PASSWORD` / `ORACLE_DB_CONNECT_STRING` /
`ORACLE_WALLET_ZIP_B64` is missing, `isOracleConfigured()` returns `false` and
every Oracle-backed endpoint fails soft: `/catalog/search` and
`/catalog/autocomplete` just omit Oracle results (the free-API results still
work normally), and `/catalog/match` returns `503` with `candidates: []`.
Nothing crashes and nothing else in the app is affected — this was deliberately
built to degrade gracefully rather than require the Oracle DB to be up.

This repo's convention is documented per-variable in `.env.example` — see the
Oracle section there too.

**Local dev**: intentionally not wired up yet (per your call — production-only
for now). If you want it later, the same four/five vars go in `.env` and the
Express dev server (port 3001) picks them up the same way; the only difference
is `/tmp` is your actual local temp dir instead of a fresh Vercel container.

---

## 4. Testing it once deployed

After the env vars are set and a deploy has picked them up:

```bash
curl "https://cardpop.com.au/hcgi/api/catalog/search?q=charizard&collection=pokemon"
```

You should see `"source": "oracle-catalogue"` entries mixed in with
`"source": "pokemon-tcg"` ones (assuming `card_catalogue` has matching rows —
it starts out empty, so insert a test row first).

```bash
curl -X POST "https://cardpop.com.au/hcgi/api/catalog/match" \
  -H "Content-Type: application/json" \
  -d '{"name":"Charizard","set":"Base Set","cardNumber":"4"}'
```

If a call returns a 502/503 or missing Oracle results, check Vercel's runtime
logs for `[CATALOG_ORACLE]`, `[CATALOG_MATCH]`, or `[ORACLE]` — every failure
path in `oracleClient.js` and the catalog route logs the underlying error
(e.g. `ORA-12541: TNS:no listener` usually means the TNS alias in
`ORACLE_DB_CONNECT_STRING` doesn't match what's in the wallet's
`tnsnames.ora`; an mTLS/certificate error usually means the wallet zip wasn't
base64-encoded correctly, or `ORACLE_WALLET_PASSWORD` is set/unset opposite
to what your wallet actually needs).

---

## Extending this later

- **More fields / a different schema**: update the `CREATE TABLE` above and the
  `SELECT` column lists in `src/routes/catalog.js` (`searchOracle`, the
  `/match` handler) together.
- **Bulk import tooling**: nothing in this repo loads data into
  `card_catalogue` yet — that's a separate task once the connection itself is
  confirmed working.
- **Connection pooling**: `oracleClient.js` keeps a small pool (`poolMax: 2`)
  per warm container, which is appropriate for a serverless function serving
  one request at a time. No action needed unless you see pool-exhaustion errors
  under real traffic.
