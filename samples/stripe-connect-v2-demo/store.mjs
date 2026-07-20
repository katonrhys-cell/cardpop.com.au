// Tiny JSON-file "database" for the sample only.
//
// The brief says: "If there is a DB already setup, store a mapping from the
// user object to the account ID." CardPop's real database is Supabase and the
// real mapping lives at profiles.stripe_connect_account_id — but this sample is
// deliberately isolated from production, so it keeps its own throwaway store in
// a git-ignored JSON file next to this script. Swap these helpers for real DB
// reads/writes if you graduate this sample into the app.
//
// Shape of the file:
// {
//   "users": {
//     "<demo user name>": {
//       "email": "...",
//       "accountId": "acct_...",          // Stripe v2 account id
//       "subscription": {                  // maintained by the billing webhook
//         "id": "sub_...",
//         "status": "active" | "canceled" | ...,
//         "priceId": "price_...",
//         "cancelAtPeriodEnd": false
//       }
//     }
//   }
// }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.demo-data.json');

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { users: {} };
  }
}

function writeAll(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Fetch a demo user record (or null).
export function getUser(name) {
  return readAll().users[name] || null;
}

// Create/merge a demo user record.
export function upsertUser(name, patch) {
  const data = readAll();
  data.users[name] = { ...(data.users[name] || {}), ...patch };
  writeAll(data);
  return data.users[name];
}

// Reverse lookup: which demo user owns this connected account id?
// (Webhook handlers only receive the account id.)
export function findUserByAccountId(accountId) {
  const data = readAll();
  const entry = Object.entries(data.users).find(([, u]) => u.accountId === accountId);
  return entry ? { name: entry[0], ...entry[1] } : null;
}
