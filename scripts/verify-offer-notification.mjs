#!/usr/bin/env node
/**
 * End-to-end check that an enquiry (offer) reaches the seller BOTH ways:
 * an email in their inbox and a notification on their account.
 *
 *   node scripts/verify-offer-notification.mjs                  # against production
 *   node scripts/verify-offer-notification.mjs --listing <uuid> # a specific listing
 *   node scripts/verify-offer-notification.mjs --api http://localhost:3001/api
 *   node scripts/verify-offer-notification.mjs --cleanup        # delete the test offer after
 *
 * It drives the real path a buyer takes — signs in as a test buyer, posts a
 * real offer through POST /offers with that buyer's token — then reports:
 *
 *   1. whether the offer row was written,
 *   2. whether the on_offer_created trigger wrote the seller's in-app
 *      notification (read back from the database),
 *   3. whether the seller email was accepted by Resend, and which address it
 *      went to.
 *
 * Nothing here is mocked, so a pass means a real seller would be reached. It
 * writes a real offer, so use --cleanup (or decline it in the UI) afterwards.
 *
 * Environment:
 *   SUPABASE_SERVICE_ROLE_KEY  required — reads notifications and profiles
 *   SUPABASE_URL               optional — defaults to the production project
 *   TEST_BUYER_EMAIL           required — a real CardPop account to offer FROM
 *   TEST_BUYER_PASSWORD        required
 *
 * The buyer account must not own the listing being offered on; the script
 * picks a listing owned by someone else automatically when --listing is
 * omitted.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfsaazuqjxotnieqlkd.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_lHlLkeTfwzhWQ80Zz6pL6g_jc7Y8p33';
const API_BASE = arg('api', 'https://cardpop.com.au/hcgi/api');
const AMOUNT = Number(arg('amount', '1'));

const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);
const step = (m) => console.log(`\n${m}`);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. See the header of this file for what it needs.`);
    process.exit(2);
  }
  return v;
}

async function main() {
  requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const buyerEmail = requireEnv('TEST_BUYER_EMAIL');
  const buyerPassword = requireEnv('TEST_BUYER_PASSWORD');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Sign in as the buyer ───────────────────────────────────────────────
  step('1. Signing in as the test buyer');
  const { data: auth, error: authErr } = await anon.auth.signInWithPassword({
    email: buyerEmail,
    password: buyerPassword,
  });
  if (authErr || !auth?.session) {
    bad(`could not sign in as ${buyerEmail}: ${authErr?.message ?? 'no session'}`);
    process.exit(1);
  }
  const buyerId = auth.user.id;
  ok(`signed in as ${buyerEmail} (${buyerId})`);

  // ── 2. Pick a listing ─────────────────────────────────────────────────────
  step('2. Choosing a listing to enquire on');
  let listing;
  const listingId = arg('listing');
  if (listingId) {
    const { data } = await admin
      .from('listings')
      .select('id, seller_id, listing_type, status, vault_item:vault_items(card_name)')
      .eq('id', listingId)
      .maybeSingle();
    listing = data;
    if (!listing) { bad(`listing ${listingId} not found`); process.exit(1); }
    if (listing.seller_id === buyerId) {
      bad('that listing belongs to the test buyer — offers on your own listing are rejected');
      process.exit(1);
    }
  } else {
    const { data } = await admin
      .from('listings')
      .select('id, seller_id, listing_type, status, vault_item:vault_items(card_name)')
      .eq('status', 'active')
      .neq('seller_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(1);
    listing = data?.[0];
    if (!listing) { bad('no active listing owned by anyone else — pass --listing <uuid>'); process.exit(1); }
  }
  ok(`listing ${listing.id} — "${listing.vault_item?.card_name ?? 'unnamed'}" (${listing.listing_type})`);

  const { data: sellerProfile } = await admin
    .from('profiles')
    .select('id, email, display_name, username')
    .eq('id', listing.seller_id)
    .maybeSingle();
  if (sellerProfile?.email) ok(`seller ${sellerProfile.display_name ?? sellerProfile.username ?? listing.seller_id} <${sellerProfile.email}>`);
  else bad(`seller ${listing.seller_id} has NO email on file — the email half cannot work for them`);

  const since = new Date().toISOString();

  // ── 3. Make the offer through the real endpoint ───────────────────────────
  step('3. Posting the offer through the API');
  const res = await fetch(`${API_BASE}/offers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.session.access_token}`,
    },
    body: JSON.stringify({
      listingId: listing.id,
      sellerId: listing.seller_id,
      amountAud: AMOUNT,
      message: 'Automated delivery check from verify-offer-notification.mjs — please ignore.',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    bad(`POST /offers returned ${res.status}: ${body.error ?? '(no body)'}`);
    process.exit(1);
  }
  ok(`offer ${body.offer.id} created for $${Number(body.offer.amount_aud).toFixed(2)}`);

  // ── 4. The in-app notification (written by the database trigger) ──────────
  step('4. Checking the seller’s in-app notification');
  let notification = null;
  for (let attempt = 0; attempt < 5 && !notification; attempt++) {
    const { data } = await admin
      .from('notifications')
      .select('id, type, title, body, link, related_id, created_at')
      .eq('user_id', listing.seller_id)
      .eq('type', 'offer_received')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    notification = data?.[0] ?? null;
    if (!notification) await new Promise(r => setTimeout(r, 600));
  }
  if (notification) {
    ok(`notification ${notification.id}: "${notification.title}" → ${notification.link}`);
    if (notification.related_id !== body.offer.id) {
      bad(`related_id ${notification.related_id} does not point at this offer`);
    }
  } else {
    bad('no offer_received notification appeared — check the on_offer_created trigger');
  }

  // ── 5. The email ──────────────────────────────────────────────────────────
  step('5. Checking the seller email');
  if (body.emailed) {
    ok(`Resend accepted the email to ${sellerProfile?.email}`);
    console.log('    Confirm delivery in the Resend dashboard → Emails, or in that inbox.');
  } else if (!sellerProfile?.email) {
    bad('skipped — the seller has no email address on file');
  } else {
    bad('the endpoint reported emailed=false — check RESEND_API_KEY on the server and the function logs');
  }

  // ── 6. Cleanup ────────────────────────────────────────────────────────────
  if (flag('cleanup')) {
    step('6. Cleaning up');
    await admin.from('offers').delete().eq('id', body.offer.id);
    if (notification) await admin.from('notifications').delete().eq('id', notification.id);
    ok('test offer and notification removed');
  } else {
    console.log('\nLeaving the test offer in place. Re-run with --cleanup to remove it,');
    console.log('or decline it from the seller’s /account/offers page.');
  }

  const passed = Boolean(notification) && Boolean(body.emailed);
  console.log(`\n${passed ? 'PASS' : 'INCOMPLETE'} — notification: ${notification ? 'yes' : 'no'}, email: ${body.emailed ? 'yes' : 'no'}`);
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error(`\nverify-offer-notification failed: ${err.message}`);
  process.exit(1);
});
