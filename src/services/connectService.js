import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { namesMatch } from './identityService.js';
import { buildSellerAccountParams, isPayoutReady, payoutAccountName } from '../utils/sellerAccountShape.js';

// ─────────────────────────────────────────────────────────────────────────────
// Seller payout accounts are Stripe Connect Express accounts (v1 Accounts API).
//
// Each seller is an Express account with only the `transfers` capability, so the
// platform can push their sale proceeds to them via
// `stripe.transfers.create({ destination })` — exactly the money flow
// payoutService.js uses. The account shape lives in
// ../utils/sellerAccountShape.js so this flow and the backfill script share it
// verbatim.
//
// (This service originally targeted the v2 Accounts API, which failed in
// production with "Accounts v2 is not enabled for your livemode merchant" —
// Express accounts are available on any platform with Connect activated.)
//
// The account id is stored in profiles.stripe_connect_account_id and used as a
// transfer destination; the onboarded flag is derived from payouts_enabled +
// the transfers capability on retrieve.
// ─────────────────────────────────────────────────────────────────────────────

// Create an Express seller account and persist its id onto the profile.
// Idempotent: if the profile already has an account id it is returned unchanged
// and no Stripe call is made. Single source of truth for seller-account shape —
// the on-demand onboarding flow and the bulk backfill
// (scripts/backfill-seller-connect-accounts.mjs) both go through here so they
// can't drift.
//
// @param existingAccountId  the profile's current stripe_connect_account_id (may be null)
// @param opts               { email, displayName } used to prefill the account
// @returns {Promise<{ accountId: string, created: boolean }>}
export async function ensureSellerConnectAccount(userId, existingAccountId = null, opts = {}) {
  if (existingAccountId) {
    return { accountId: existingAccountId, created: false };
  }

  const account = await stripe.accounts.create(buildSellerAccountParams(userId, opts));

  const { error } = await supabase
    .from('profiles')
    .update({ stripe_connect_account_id: account.id, stripe_connect_onboarded: false })
    .eq('id', userId);

  if (error) {
    // The account exists in Stripe but we failed to record it — surface loudly so
    // the caller doesn't create a second orphaned account on the next attempt.
    logger.error(`[STRIPE CONNECT] Created account ${account.id} but failed to persist for user ${userId}: ${error.message}`);
    throw new Error(`Could not save Stripe account id: ${error.message}`);
  }

  return { accountId: account.id, created: true };
}

export async function connectOnboard(req, res) {
  try {
    const userId = req.user.id;
    const { returnUrl, refreshUrl } = req.body;

    if (!returnUrl || !refreshUrl) {
      return res.status(400).json({ error: 'returnUrl and refreshUrl are required' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_onboarded, display_name')
      .eq('id', userId)
      .maybeSingle();

    const { accountId } = await ensureSellerConnectAccount(userId, profile?.stripe_connect_account_id, {
      email: req.user.email,
      displayName: profile?.display_name || undefined,
    });

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    logger.info(`[STRIPE CONNECT] Onboarding link created for user ${userId}`);
    res.json({ url: accountLink.url, accountId });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/onboard error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

export async function getConnectStatus(req, res) {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_onboarded, wallet_balance_aud, display_name, legal_name, business_name, payout_name_mismatch')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return res.json({ connected: false, onboarded: false, wallet_balance_aud: profile?.wallet_balance_aud || 0 });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
    const onboarded = isPayoutReady(account);

    // Cross-check the payout account's KYC'd legal name against the profile's
    // ID-verified legal_name (display_name before an ID check exists). A
    // difference means the person receiving the money isn't the person who
    // verified — flagged for the admin user management section. Informational:
    // it never blocks payouts, and it self-clears once the names agree.
    // A sole trader may legitimately onboard Connect under their registered
    // business name, so the payout name passes if it matches EITHER the
    // personal name or the profile's business name.
    const payoutName = payoutAccountName(account);
    const profileName = profile.legal_name || profile.display_name;
    const matchesPerson = profileName && namesMatch(profileName, payoutName);
    const matchesBusiness = profile.business_name && namesMatch(profile.business_name, payoutName);
    const mismatch = Boolean(onboarded && payoutName && (profileName || profile.business_name) && !matchesPerson && !matchesBusiness);

    if (onboarded !== profile.stripe_connect_onboarded || mismatch !== Boolean(profile.payout_name_mismatch)) {
      if (mismatch && !profile.payout_name_mismatch) {
        logger.warn(`[STRIPE CONNECT] Payout name mismatch for user ${userId} (account ${profile.stripe_connect_account_id})`);
      }
      await supabase
        .from('profiles')
        .update({ stripe_connect_onboarded: onboarded, payout_name_mismatch: mismatch })
        .eq('id', userId);
    }

    res.json({
      connected: true,
      onboarded,
      accountId: profile.stripe_connect_account_id,
      detailsSubmitted: Boolean(account.details_submitted),
      payoutsEnabled: Boolean(account.payouts_enabled),
      wallet_balance_aud: profile?.wallet_balance_aud || 0,
    });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/status error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

export async function getDashboardLink(req, res) {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_onboarded')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return res.status(400).json({ error: 'No Stripe account connected' });
    }

    // Express accounts get a single-use login link into their Express dashboard,
    // where they can see payouts and update their bank/KYC details themselves.
    const link = await stripe.accounts.createLoginLink(profile.stripe_connect_account_id);
    res.json({ url: link.url });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/dashboard-link error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}
