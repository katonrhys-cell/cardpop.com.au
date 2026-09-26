import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendShopEnquiry } from '../utils/emailService.js';
import { verifyTurnstileToken } from '../utils/turnstile.js';
import { shopProductPath } from '../../utils/shopProductUrl.js';

const router = Router();

// Where sold-out enquiries land. The shop is platform-owned, so this is the
// admin inbox rather than a seller — overridable for staging.
export const SHOP_ENQUIRY_EMAIL = process.env.SHOP_ENQUIRY_EMAIL?.trim() || 'noreply@cardpop.com.au';

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const MAX = { name: 100, email: 254, message: 2000 };

/**
 * POST /shop-enquiry
 *
 * "Enquire" on a sold-out shop product. Looks the product up server-side (so
 * the email carries the real title, not whatever the browser sent) and
 * delivers it to the admin inbox via Resend with reply_to set to the shopper.
 * Public (no auth) — abuse is bounded by the apiLimiter mount, a hidden
 * honeypot field and Turnstile (enforced once TURNSTILE_SECRET_KEY is set).
 */
router.post('/', async (req, res) => {
  const productId = String(req.body?.productId || '').trim();
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();
  // Why they're enquiring: sold out (default) or a coming-soon product.
  const reason = req.body?.reason === 'coming_soon' ? 'coming_soon' : 'sold_out';
  // Hidden field real users never see; a filled value means a bot. Accept
  // silently so the bot doesn't learn it was caught.
  const honeypot = String(req.body?.company || '').trim();
  if (honeypot) return res.status(200).json({ ok: true });

  if (!isUuid(productId)) {
    return res.status(400).json({ error: 'Unknown product.' });
  }
  if (name.length < 2 || !isEmail(email)) {
    return res.status(400).json({ error: 'Please provide your name and a valid email address.' });
  }
  if (name.length > MAX.name || email.length > MAX.email || message.length > MAX.message) {
    return res.status(400).json({ error: 'One or more fields exceed the maximum allowed length.' });
  }

  const captcha = await verifyTurnstileToken(req.body?.turnstileToken, req.ip);
  if (!captcha.success) {
    return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
  }

  try {
    const { data: product, error: lookupError } = await supabase
      .from('shop_products')
      .select('id, title, sku, slug, category, colour, family_sku, stock_quantity, status')
      .eq('id', productId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!product || !['active', 'coming_soon'].includes(product.status)) {
      return res.status(404).json({ error: 'Unknown product.' });
    }

    const appUrl = (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/$/, '');
    const productUrl = `${appUrl}${shopProductPath(product)}`;

    const sent = await sendShopEnquiry({
      to: SHOP_ENQUIRY_EMAIL,
      productTitle: product.title,
      productSku: product.sku || null,
      productId: product.id,
      productUrl,
      reason,
      name,
      email,
      message,
    });
    if (!sent) {
      // RESEND_API_KEY unset or the provider rejected the send.
      return res.status(502).json({
        error: `We could not send your enquiry right now. Please email ${SHOP_ENQUIRY_EMAIL} directly.`,
      });
    }
    logger.info(`[SHOP-ENQUIRY] ${email} asked about ${product.id} (${reason}, stock ${product.stock_quantity}) → ${SHOP_ENQUIRY_EMAIL}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error(`[SHOP-ENQUIRY] send failed: ${err.message}`);
    return res.status(500).json({
      error: `Something went wrong sending your enquiry. Please try again or email ${SHOP_ENQUIRY_EMAIL}.`,
    });
  }
});

export default router;
