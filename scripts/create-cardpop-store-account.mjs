// Create (or repair) CardPop's own storefront account: admin@cardpop.com.au.
//
// This is the account the platform sells from — an admin login that also owns a
// dealer store on the marketplace. Two halves:
//
//   1. The auth user. A migration CANNOT do this properly — GoTrue owns
//      auth.users/auth.identities and its password hashing, so the account is
//      created through the Auth Admin API here, with email_confirm so no
//      confirmation mail is needed (the mailbox may not exist yet).
//   2. The entitlements. Identical to
//      supabase/migrations/20260806064711_provision_cardpop_store_account.sql —
//      deliberately duplicated so this script works end-to-end on a fresh
//      environment, and the migration self-heals if the account is ever created
//      by hand in the dashboard instead. Both are idempotent, and running one
//      after the other is a no-op.
//
// Why service role: every column set below is pinned against self-writes by the
// profiles_update_access policy (20260802060200) — is_admin, is_verified,
// verification_status, has_saved_card, subscription_tier, subscription_status.
// The account cannot grant these to itself from the browser, by design.
//
// NOT done here, because it cannot be automated: Stripe Connect payout
// onboarding. Sale proceeds sit in the seller wallet until a human completes KYC
// from Account → Payouts (docs/stripe-connect.md).
//
// Usage:
//   SUPABASE_URL=https://vrfsaazuqjxotnieqlkd.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   STORE_ACCOUNT_PASSWORD='<password>' \
//   node scripts/create-cardpop-store-account.mjs [--dry-run] [--email x@y] [--slug cardpop]
//
// Omit STORE_ACCOUNT_PASSWORD and a strong random one is generated and printed
// once. If the user already exists its password is left alone unless you pass
// --reset-password (then STORE_ACCOUNT_PASSWORD, or a generated one, is applied).
//
// Re-running is safe.

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DRY_RUN = process.argv.includes('--dry-run');
const RESET_PASSWORD = process.argv.includes('--reset-password');
const EMAIL = arg('--email', 'admin@cardpop.com.au').toLowerCase();
const SLUG = arg('--slug', 'cardpop');
const USERNAME = arg('--username', 'cardpop');
const BUSINESS_NAME = arg('--business-name', 'CardPop');

// 24 bytes of base64url — ~144 bits, well past anything worth brute forcing.
const generatePassword = () => randomBytes(24).toString('base64url');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Page through the admin user list to find an existing account by email.
// listUsers has no server-side email filter, so this walks pages until it hits
// a short one. Fine at CardPop's user count; revisit if that changes.
async function findUserByEmail(email) {
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = (data?.users || []).find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return hit;
    if (!data?.users?.length || data.users.length < perPage) return null;
  }
  return null;
}

async function main() {
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Provisioning store account ${EMAIL}`);

  let user = await findUserByEmail(EMAIL);
  let issuedPassword = null;

  if (user) {
    console.log(`  auth user: exists (${user.id})`);
    if (RESET_PASSWORD) {
      issuedPassword = process.env.STORE_ACCOUNT_PASSWORD || generatePassword();
      if (!DRY_RUN) {
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          password: issuedPassword,
          email_confirm: true,
        });
        if (error) throw error;
      }
      console.log('  auth user: password reset');
    }
  } else {
    issuedPassword = process.env.STORE_ACCOUNT_PASSWORD || generatePassword();
    if (DRY_RUN) {
      console.log('  auth user: would create (email pre-confirmed)');
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: EMAIL,
        password: issuedPassword,
        // The mailbox may not exist yet, and there is no one to click a link in
        // a shared account's inbox — confirm it outright.
        email_confirm: true,
        // handle_new_user() reads these when it creates the profiles row.
        user_metadata: { username: USERNAME, full_name: BUSINESS_NAME },
      });
      if (error) throw error;
      user = data.user;
      console.log(`  auth user: created (${user.id})`);
    }
  }

  if (DRY_RUN && !user) {
    console.log('\n[dry-run] Stopping — no user to apply entitlements to.');
    return;
  }

  // ── Entitlements ──────────────────────────────────────────────────────────
  // Mirrors 20260806064711_provision_cardpop_store_account.sql. See that file
  // for why each column matters and the two caveats on is_verified /
  // has_saved_card (both are manual grants, not earned checks).
  const fields = {
    is_admin: true,
    is_verified: true,
    verification_status: 'approved',
    identity_name_mismatch: false,
    has_saved_card: true,
    subscription_tier: 'premium',
    subscription_status: 'grandfathered',
    is_public: true,
    is_active: true,
    is_sole_trader: true,
    business_name: BUSINESS_NAME,
    display_name: BUSINESS_NAME,
    updated_at: new Date().toISOString(),
  };

  // store_slug is UNIQUE (partial index profiles_store_slug_key) — only claim it
  // if no other profile holds it, so a clash is a warning rather than a crash.
  const { data: slugOwner, error: slugErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('store_slug', SLUG)
    .maybeSingle();
  if (slugErr) throw slugErr;

  if (!slugOwner || slugOwner.id === user.id) {
    fields.store_slug = SLUG;
  } else {
    console.warn(`  store slug: "${SLUG}" already taken by ${slugOwner.id} — left unset`);
  }

  if (DRY_RUN) {
    console.log('  profile: would apply', fields);
  } else {
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id);
    if (error) throw error;
    console.log('  profile: admin + verified + Premium + dealer store applied');
  }

  if (issuedPassword && !process.env.STORE_ACCOUNT_PASSWORD) {
    console.log(`\n  Generated password (shown once, store it in a password manager):\n    ${issuedPassword}`);
  }

  console.log(`\nDone. Store page: https://cardpop.com.au/dealer/${fields.store_slug || '<slug>'}`);
  console.log('Remaining manual step: complete Stripe Connect payout onboarding');
  console.log('from Account → Payouts, or sale proceeds stay in the seller wallet.');
}

main().catch((err) => {
  console.error('\nFailed:', err.message || err);
  process.exit(1);
});
