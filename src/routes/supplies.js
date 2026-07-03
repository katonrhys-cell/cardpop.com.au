import express from 'express';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import {
  getSuppliesSettings,
  setPlatformSetting,
  suggestRetailPriceAud,
  SUPPLIES_SETTING_DEFAULTS,
} from '../services/suppliesPricingService.js';
import {
  buildSupplierOrder,
  transitionFulfilment,
} from '../services/supplyFulfilmentService.js';
import { sendSupplierOrder, sendOrderShipped } from '../utils/emailService.js';

const router = express.Router();

async function requireAdmin(req, res, next) {
  if (!(await isAdminUser(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ─── GET /settings/public ────────────────────────────────────────────────────
// Shipping rules for cart messaging ("Add $X more for free shipping").

router.get('/settings/public', async (_req, res) => {
  try {
    const s = await getSuppliesSettings();
    res.json({
      freeShippingThresholdAud: Number(s.free_shipping_threshold_aud),
      flatShippingFeeAud: Number(s.flat_shipping_fee_aud),
    });
  } catch (err) {
    logger.error(`[SUPPLIES] settings/public error: ${err.message}`);
    res.status(500).json({ error: 'Failed to load shipping settings' });
  }
});

// ─── Admin: pricing & business settings ──────────────────────────────────────

router.get('/admin/settings', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    res.json(await getSuppliesSettings());
  } catch (err) {
    logger.error(`[SUPPLIES] admin settings read error: ${err.message}`);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/admin/settings', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const updates = {};
    for (const key of Object.keys(SUPPLIES_SETTING_DEFAULTS)) {
      if (!(key in (req.body || {}))) continue;
      let value = req.body[key];
      if (typeof SUPPLIES_SETTING_DEFAULTS[key] === 'number') {
        value = Number(value);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ error: `${key} must be a non-negative number` });
        }
      } else {
        value = String(value ?? '').slice(0, 200);
      }
      updates[key] = value;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No recognised settings provided' });
    }
    for (const [key, value] of Object.entries(updates)) {
      await setPlatformSetting(key, value);
    }
    res.json(await getSuppliesSettings());
  } catch (err) {
    logger.error(`[SUPPLIES] admin settings update error: ${err.message}`);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── Admin: retail price suggestion ──────────────────────────────────────────

router.get('/admin/price-preview', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const cost = Number(req.query.cost);
    const settings = await getSuppliesSettings();
    const markup = req.query.markup !== undefined && req.query.markup !== ''
      ? Number(req.query.markup)
      : Number(settings.supplies_default_markup_pct);
    const price = suggestRetailPriceAud(cost, markup);
    if (price === null) return res.status(400).json({ error: 'cost must be a positive number' });
    res.json({ costPriceAud: cost, markupPct: markup, suggestedPriceAud: price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: suppliers CRUD ───────────────────────────────────────────────────

const SUPPLIER_FIELDS = ['name', 'contact_email', 'phone', 'website_url', 'portal_url', 'ordering_method', 'ordering_instructions', 'supports_blind_shipping', 'notes', 'status'];

function pickSupplierFields(body) {
  const out = {};
  for (const f of SUPPLIER_FIELDS) {
    if (f in (body || {})) out[f] = body[f];
  }
  return out;
}

router.get('/admin/suppliers', authMiddleware, requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ suppliers: data || [] });
});

router.post('/admin/suppliers', authMiddleware, requireAdmin, async (req, res) => {
  const fields = pickSupplierFields(req.body);
  if (!fields.name?.trim()) return res.status(400).json({ error: 'name is required' });
  const { data, error } = await supabase.from('suppliers').insert(fields).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ supplier: data });
});

router.put('/admin/suppliers/:id', authMiddleware, requireAdmin, async (req, res) => {
  const fields = pickSupplierFields(req.body);
  if ('name' in fields && !fields.name?.trim()) return res.status(400).json({ error: 'name cannot be empty' });
  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Supplier not found' });
  res.json({ supplier: data });
});

router.delete('/admin/suppliers/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('suppliers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// ─── Admin: fulfilment queue ─────────────────────────────────────────────────

router.get('/admin/fulfilments', authMiddleware, requireAdmin, async (req, res) => {
  let query = supabase
    .from('supply_fulfilments')
    .select('*, supplier:suppliers(id, name, contact_email, ordering_method, supports_blind_shipping)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ fulfilments: data || [] });
});

// Detail view includes the pre-filled supplier order (email body + CSV) that
// the admin approves with one click.
router.get('/admin/fulfilments/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('supply_fulfilments')
    .select('*, supplier:suppliers(*)')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Fulfilment not found' });
  res.json({ fulfilment: data, supplierOrder: buildSupplierOrder(data, data.supplier) });
});

// One-click approve: mark ordered_with_supplier and (optionally) email the
// pre-filled order straight to the supplier.
router.post('/admin/fulfilments/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data: current, error } = await supabase
      .from('supply_fulfilments')
      .select('*, supplier:suppliers(*)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!current) return res.status(404).json({ error: 'Fulfilment not found' });

    const order = buildSupplierOrder(current, current.supplier);
    const updated = await transitionFulfilment(req.params.id, 'ordered_with_supplier', {
      approved_by: req.user.id,
      approved_at: new Date().toISOString(),
      supplier_order_ref: req.body?.supplierOrderRef || order.reference,
    });
    if (!updated) return res.status(409).json({ error: `Cannot approve a fulfilment in status '${current.status}'` });

    const sendEmail = req.body?.sendEmail !== false;
    let emailSent = false;
    if (sendEmail && order.to) {
      await sendSupplierOrder({ to: order.to, subject: order.subject, text: order.text });
      emailSent = true;
    }

    logger.info(`[SUPPLIES] Fulfilment ${req.params.id} approved by ${req.user.id} (email ${emailSent ? 'sent' : 'not sent'})`);
    res.json({ fulfilment: updated, supplierOrder: order, emailSent });
  } catch (err) {
    logger.error(`[SUPPLIES] approve error: ${err.message}`);
    res.status(500).json({ error: 'Failed to approve fulfilment' });
  }
});

// Record tracking: moves to shipped and emails the customer.
router.post('/admin/fulfilments/:id/tracking', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const trackingNumber = String(req.body?.trackingNumber || '').trim();
    if (!trackingNumber) return res.status(400).json({ error: 'trackingNumber is required' });
    const trackingCarrier = String(req.body?.trackingCarrier || 'Australia Post').slice(0, 100);

    const updated = await transitionFulfilment(req.params.id, 'shipped', {
      tracking_number: trackingNumber.slice(0, 100),
      tracking_carrier: trackingCarrier,
      shipped_at: new Date().toISOString(),
    });
    if (!updated) return res.status(409).json({ error: 'Fulfilment cannot be marked shipped from its current status' });

    if (updated.buyer_id) {
      const { data: buyer } = await supabase
        .from('profiles').select('email, display_name').eq('id', updated.buyer_id).maybeSingle();
      if (buyer?.email) {
        await sendOrderShipped({
          buyerEmail: buyer.email,
          buyerName: buyer.display_name || 'Collector',
          trackingNumber,
          trackingCarrier,
          items: updated.items,
          orderId: updated.order_id,
        }).catch(e => logger.warn(`[SUPPLIES] shipped email failed: ${e.message}`));
      }
      await supabase.from('notifications').insert({
        user_id: updated.buyer_id,
        type: 'order_shipped',
        title: 'Your order has shipped!',
        body: `Tracking: ${trackingNumber} (${trackingCarrier})`,
      }).catch(() => {});
    }

    res.json({ fulfilment: updated });
  } catch (err) {
    logger.error(`[SUPPLIES] tracking error: ${err.message}`);
    res.status(500).json({ error: 'Failed to record tracking' });
  }
});

router.post('/admin/fulfilments/:id/complete', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const updated = await transitionFulfilment(req.params.id, 'complete', {});
    if (!updated) return res.status(409).json({ error: 'Fulfilment cannot be completed from its current status' });
    res.json({ fulfilment: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete fulfilment' });
  }
});

// Cancel a fulfilment. Money is returned through the existing admin refund
// flow (/stripe/refund) — this only stops the dropship pipeline.
router.post('/admin/fulfilments/:id/cancel', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const updated = await transitionFulfilment(req.params.id, 'cancelled', {
      cancelled_at: new Date().toISOString(),
      notes: req.body?.reason ? String(req.body.reason).slice(0, 500) : undefined,
    });
    if (!updated) return res.status(409).json({ error: 'Fulfilment cannot be cancelled from its current status' });
    res.json({ fulfilment: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel fulfilment' });
  }
});

export default router;
