import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { getPlatformSetting } from './stripeWebhookService.js';

// Pricing rules for the supplies dropshipping range. All settings live in
// platform_settings with these code-level defaults, so the feature works
// before any admin has saved a value.
export const SUPPLIES_SETTING_DEFAULTS = {
  supplies_default_markup_pct: 60,
  free_shipping_threshold_aud: 50,
  flat_shipping_fee_aud: 10,
  business_name: 'CardPop',
  business_abn: '',
};

export async function getSuppliesSettings() {
  const entries = await Promise.all(
    Object.entries(SUPPLIES_SETTING_DEFAULTS).map(async ([key, def]) => [key, await getPlatformSetting(key, def)]),
  );
  return Object.fromEntries(entries);
}

// platform_settings has one row per key; update first and only insert when the
// key has never been saved, so this works regardless of the table's constraints.
export async function setPlatformSetting(key, value) {
  const { data: updated, error: updateErr } = await supabase
    .from('platform_settings')
    .update({ value })
    .eq('key', key)
    .select('key');
  if (updateErr) throw updateErr;
  if (updated?.length) return;
  const { error: insertErr } = await supabase.from('platform_settings').insert({ key, value });
  if (insertErr) throw insertErr;
  logger.info(`[SUPPLIES] Created platform setting ${key}`);
}

// GST portion of a GST-inclusive amount (1/11th at the standard 10% rate).
export function gstPortionCents(totalCents, gstRatePct = 10) {
  const total = Number(totalCents);
  const rate = Number(gstRatePct);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((total * rate) / (100 + rate));
}

// Suggested GST-inclusive retail price from supplier cost + markup, rounded UP
// to the nearest 5 cents so rounding never eats the margin. Admins can always
// override the stored price.
export function suggestRetailPriceAud(costPriceAud, markupPct) {
  const cost = Number(costPriceAud);
  const markup = Number(markupPct);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const pct = Number.isFinite(markup) && markup >= 0 ? markup : SUPPLIES_SETTING_DEFAULTS.supplies_default_markup_pct;
  // Work in cents with an epsilon so float noise (3 * 1.6 = 4.800000000000001)
  // can't bump an exact result up a rounding step.
  const cents = (Math.round(cost * 100) * (100 + pct)) / 100;
  return (Math.ceil(cents / 5 - 1e-9) * 5) / 100;
}

// Flat fee below the free-shipping threshold, free at or above it. Only applies
// to platform-shipped shop goods; marketplace listings are shipped by sellers.
export function shippingFeeCents(shippableSubtotalCents, thresholdCents, feeCents) {
  if (!shippableSubtotalCents || shippableSubtotalCents <= 0) return 0;
  return shippableSubtotalCents >= thresholdCents ? 0 : Math.max(0, feeCents);
}
