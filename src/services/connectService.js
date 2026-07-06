import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

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

    let accountId = profile?.stripe_connect_account_id;

    if (!accountId) {
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
      accountId = account.id;

      await supabase
        .from('profiles')
        .update({ stripe_connect_account_id: accountId, stripe_connect_onboarded: false })
        .eq('id', userId);
    }

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
      .select('stripe_connect_account_id, stripe_connect_onboarded, is_verified, wallet_balance_aud')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return res.json({ connected: false, onboarded: false, wallet_balance_aud: profile?.wallet_balance_aud || 0 });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
    const onboarded = Boolean(account.details_submitted && account.payouts_enabled);

    // Stripe performs the identity (KYC) checks during Connect onboarding and
    // only enables payouts once identity is verified — so a payouts-enabled
    // account is our source of truth for "identity verified". Promote the
    // profile's badge fields from that signal; the platform never stores the
    // underlying ID documents. We only ever promote (never revoke) here, so a
    // transient payout hiccup can't strip a badge and users verified under the
    // old manual flow keep their status.
    const update = {};
    if (onboarded !== profile.stripe_connect_onboarded) update.stripe_connect_onboarded = onboarded;
    if (onboarded && !profile.is_verified) {
      update.is_verified = true;
      update.verification_status = 'approved';
    }
    if (Object.keys(update).length) {
      await supabase.from('profiles').update(update).eq('id', userId);
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

// Connect webhook handler for `account.updated`. When Stripe finishes (or
// changes) a connected account's KYC/verification, mirror the payout state onto
// the user's profile so the Verified badge tracks Stripe's decision without any
// manual review. The connected account carries `metadata.cardpop_user_id`
// (stamped at creation) so we can map the event back to a user. Promote-only:
// we set the badge when payouts turn on but never clear an existing badge here.
export async function handleConnectAccountUpdated(account) {
  const userId = account?.metadata?.cardpop_user_id;
  if (!userId) return; // Not a CardPop-managed connected account.

  const onboarded = Boolean(account.details_submitted && account.payouts_enabled);
  const update = { stripe_connect_onboarded: onboarded };
  if (onboarded) {
    update.is_verified = true;
    update.verification_status = 'approved';
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) {
    logger.error(`[STRIPE CONNECT] account.updated sync failed for ${userId}: ${error.message}`);
  } else {
    logger.info(`[STRIPE CONNECT] account.updated → user ${userId} onboarded=${onboarded}`);
  }
}
