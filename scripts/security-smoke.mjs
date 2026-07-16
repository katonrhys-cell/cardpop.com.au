#!/usr/bin/env node
// Post-deploy security smoke test.
//
// Verifies that the RLS / column-grant hardening from the 2026-07 security audit
// is actually live on PRODUCTION, using ONLY the public anon key (the same key
// the browser ships). Read-only — it performs SELECTs and asserts which succeed
// and which are denied. Run after a deploy:  node scripts/security-smoke.mjs
//
// Exit code 0 = all checks passed, 1 = one or more failed.

const SUPABASE_URL = 'https://odoglvswwymyjuwlonkf.supabase.co';
// Public anon key — identical to lib/supabaseClient.js's baked-in fallback.
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

const rest = (query) =>
  fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });

const results = [];
const record = (name, pass, detail) => results.push({ name, pass, detail });

// A safe/public read must succeed (HTTP 200).
async function expectReadable(name, query) {
  try {
    const r = await rest(query);
    record(name, r.status === 200, `expected 200, got ${r.status}`);
  } catch (e) {
    record(name, false, `request error: ${e.message}`);
  }
}

// A sensitive read must be denied by column/row grants (PostgREST surfaces a
// permission error, typically 401/403/400 with SQLSTATE 42501).
async function expectDenied(name, query) {
  try {
    const r = await rest(query);
    const body = await r.text();
    const denied = r.status !== 200 && (/permission denied|42501/i.test(body) || [401, 403].includes(r.status));
    record(name, denied, `expected a permission denial, got ${r.status}: ${body.slice(0, 140)}`);
  } catch (e) {
    record(name, false, `request error: ${e.message}`);
  }
}

async function main() {
  // Connectivity precheck: read a public catalogue table untouched by any of the
  // hardening below. If even this fails, the environment can't reach Supabase
  // (e.g. an outbound proxy) — abort rather than misread blanket failures as
  // security results (every "denied" assertion would pass spuriously otherwise).
  try {
    const probe = await rest('grading_companies?select=id&limit=1');
    if (probe.status !== 200) {
      console.error(`SMOKE ABORTED: cannot reach Supabase REST (probe returned ${probe.status}). ` +
        'Run this from an environment with outbound access to the Supabase host. No security checks were evaluated.');
      process.exit(2);
    }
  } catch (e) {
    console.error(`SMOKE ABORTED: cannot reach Supabase REST (${e.message}). No security checks were evaluated.`);
    process.exit(2);
  }

  // #640 — profiles: public columns readable, financial/identity columns denied.
  await expectReadable('profiles: safe columns readable', 'profiles?select=id,username,display_name,is_verified&limit=1');
  await expectDenied('profiles: wallet_balance_aud denied', 'profiles?select=wallet_balance_aud&limit=1');
  await expectDenied('profiles: stripe_customer_id denied', 'profiles?select=stripe_customer_id&limit=1');
  await expectDenied('profiles: legal_name denied', 'profiles?select=legal_name&limit=1');

  // #656 — local_game_stores: public directory readable, submitter_email denied.
  await expectReadable('stores: public columns readable', 'local_game_stores?select=id,name,city&status=eq.approved&limit=1');
  await expectDenied('stores: submitter_email denied', 'local_game_stores?select=submitter_email&status=eq.approved&limit=1');

  // #657 — event_rsvps: raw rows denied to anon; the aggregate counts view stays public.
  await expectDenied('event_rsvps: raw rows denied', 'event_rsvps?select=user_id,event_id&limit=1');
  await expectReadable('event_rsvps: counts view readable', 'event_rsvp_counts?select=event_id,buyer_count&limit=1');

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  — ${r.detail}`}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

main();
