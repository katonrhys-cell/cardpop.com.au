import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// Create a Stripe Connect (Express) account for a seller and persist its id onto
// their profile. Idempotent: if the profile already has an account id it is
// returned unchanged and no Stripe call is made. This is the single source of
// truth for how a CardPop seller account is shaped — the on-demand onboarding
// flow below and the bulk backfill script (scripts/backfill-seller-connect-accounts.mjs)
// both go through here so they can never drift apart.
//
// @param existingAccountId  the profile's current stripe_connect_account_id (may be null)
// @returns {Promise<{ accountId: string, created: boolean }>}
export async function ensureSellerConnectAccount(userId, existingAccountId = null) {
  if (existingAccountId) {
    return { accountId: existingAccountId, created: false };
  }

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'AU',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: { cardpop_user_id: userId },
  });

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
      .select('stripe_connect_account_id, stripe_connect_onboarded, display_name, full_name')
      .eq('id', userId)
      .maybeSingle();

    const { accountId } = await ensureSellerConnectAccount(userId, profile?.stripe_connect_account_id);

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
      .select('stripe_connect_account_id, stripe_connect_onboarded, wallet_balance_aud')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return res.json({ connected: false, onboarded: false, wallet_balance_aud: profile?.wallet_balance_aud || 0 });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
    const onboarded = account.details_submitted && account.payouts_enabled;

    if (onboarded !== profile.stripe_connect_onboarded) {
      await supabase
        .from('profiles')
        .update({ stripe_connect_onboarded: onboarded })
        .eq('id', userId);
    }

    res.json({
      connected: true,
      onboarded,
      accountId: profile.stripe_connect_account_id,
      detailsSubmitted: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
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

    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_account_id);
    res.json({ url: loginLink.url });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/dashboard-link error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}
