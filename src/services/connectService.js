import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { namesMatch } from './identityService.js';
import { SELLER_CONFIGURATIONS, buildSellerAccountParams, isPayoutReady, payoutAccountName } from '../utils/sellerAccountShape.js';

// ─────────────────────────────────────────────────────────────────────────────
// Seller accounts run on the Stripe v2 Accounts API (`stripe.v2.core.accounts`).
//
// Each seller is a v2 unified Account with a `recipient` configuration whose
// `stripe_transfers` capability lets the platform push their sale proceeds to
// them via `stripe.transfers.create({ destination })` — exactly the money flow
// payoutService.js already uses. The platform is the losses/fees collector.
// The account shape lives in ../utils/sellerAccountShape.js so this flow and the
// backfill script share it verbatim.
//
// Only the *account object* is v2. Charges, transfers, refunds, coupons and
// subscriptions remain on the existing v1 APIs — Stripe designed v2 accounts to
// interoperate with them, so nothing else in the money path changes.
//
// The account id (still stored in profiles.stripe_connect_account_id) is used as
// a transfer destination, so payoutService needs no change. The onboarded flag
// is derived from the recipient config's stripe_transfers capability status.
//
// VERIFY IN STRIPE TEST MODE before going live: (1) v2 accounts are enabled on
// the platform account and the pinned API version supports them; (2) a v2
// recipient id is accepted as a `transfers.create` destination.
// ─────────────────────────────────────────────────────────────────────────────

// Create a v2 seller account and persist its id onto the profile. Idempotent: if
// the profile already has an account id it is returned unchanged and no Stripe
// call is made. Single source of truth for seller-account shape — the on-demand
// onboarding flow and the bulk backfill (scripts/backfill-seller-connect-accounts.mjs)
// both go through here so they can't drift.
//
// @param existingAccountId  the profile's current stripe_connect_account_id (may be null)
// @param opts               { email, displayName } used to prefill the account
// @returns {Promise<{ accountId: string, created: boolean }>}
export async function ensureSellerConnectAccount(userId, existingAccountId = null, opts = {}) {
  if (existingAccountId) {
    return { accountId: existingAccountId, created: false };
  }

  const account = await stripe.v2.core.accounts.create(buildSellerAccountParams(userId, opts));

  const { error } = await supabase
    .from('profiles')
    .update({ stripe_connect_account_id: account.id, stripe_connect_onboarded: false })
    .eq('id', userId);

  if (error) {
    // The account exists in Stripe but we failed to record it — surface loudly so
    // the caller doesn't create a second orphaned account on the next attempt.
    logger.error(`[STRIPE CONNECT] Created v2 account ${account.id} but failed to persist for user ${userId}: ${error.message}`);
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
      .select('stripe_connect_account_id, stripe_connect_onboarded, display_name, full_name')
      .eq('id', userId)
      .maybeSingle();

    const { accountId } = await ensureSellerConnectAccount(userId, profile?.stripe_connect_account_id, {
      email: req.user.email,
      displayName: profile?.display_name || profile?.full_name || undefined,
    });

    // v2 hosted onboarding link (replaces v1 accountLinks.create).
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: SELLER_CONFIGURATIONS,
          refresh_url: refreshUrl,
          return_url: returnUrl,
        },
      },
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

    const account = await stripe.v2.core.accounts.retrieve(profile.stripe_connect_account_id, {
      include: ['configuration.recipient', 'identity', 'requirements'],
    });
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
      // Recipient accounts have no separate "details submitted" vs "payouts
      // enabled" split like v1 Express did; payout-readiness is the single gate.
      detailsSubmitted: onboarded,
      payoutsEnabled: onboarded,
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

    // The account was created with `dashboard: 'express'`, so the seller reaches
    // their Express dashboard via a v2 account link (account_update use case).
    // This doubles as the "manage / update details" entry point. account_update
    // requires a refresh_url, so fall back to APP_URL if the caller sent none.
    const base = (process.env.APP_URL || '').replace(/\/$/, '');
    const returnUrl = req.body?.returnUrl || (base ? `${base}/account/wallet` : undefined);
    const refreshUrl = req.body?.refreshUrl || returnUrl;
    if (!refreshUrl) {
      return res.status(500).json({ error: 'Dashboard link requires a return URL (set APP_URL or send returnUrl)' });
    }

    const link = await stripe.v2.core.accountLinks.create({
      account: profile.stripe_connect_account_id,
      use_case: {
        type: 'account_update',
        account_update: {
          configurations: SELLER_CONFIGURATIONS,
          refresh_url: refreshUrl,
          ...(returnUrl ? { return_url: returnUrl } : {}),
        },
      },
    });
    res.json({ url: link.url });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/dashboard-link error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}
