import logger from '../utils/logger.js';
import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import createUserScopedClient from '../utils/userScopedSupabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody } from '../middleware/validateRequest.js';
import { createShopReviewSchema, moderateShopReviewSchema } from '../schemas/shopReviewSchemas.js';

// Reviews of shop (catalogue) products. Reading published reviews is public and
// goes straight to Supabase from the browser (RLS: status = 'published'); only
// writing and moderating come through here.
//
// The write uses a CALLER-SCOPED client so Row Level Security and the insert
// trigger in 20261003060100_shop_product_reviews.sql stay the enforcement
// point: the order must be the caller's, shipped, and contain the product, and
// the row is forced to `pending`. Nothing is re-implemented in JS here.
const router = Router();

const ADMIN_STATUSES = new Set(['pending', 'published', 'rejected']);

router.post('/', authMiddleware, validateRequestBody(createShopReviewSchema), async (req, res) => {
  try {
    const { order_id, product_id, rating, title, body } = req.body;
    const token = (req.headers.authorization || '').slice(7);
    const db = createUserScopedClient(token);

    const { data, error } = await db
      .from('shop_product_reviews')
      .insert({
        order_id,
        product_id,
        reviewer_id: req.user.id,
        rating,
        title: title || null,
        body: body || null,
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'You have already reviewed this product for this order' });
      }
      if (error.code === '42501') {
        return res.status(403).json({ error: 'You can only review products from your own orders' });
      }
      if (error.code === '22023') {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    logger.error('Error creating shop review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ─── Admin moderation ───────────────────────────────────────────────────────

router.get('/admin', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const status = ADMIN_STATUSES.has(req.query.status) ? req.query.status : 'pending';
    const { data, error } = await supabase
      .from('shop_product_reviews')
      .select('id, product_id, order_id, rating, title, body, status, reviewer_name, moderation_note, created_at, moderated_at, product:shop_products!product_id(title, slug, colour)')
      .eq('status', status)
      .order('created_at', { ascending: status === 'pending' })
      .limit(200);
    if (error) throw error;
    res.json({ reviews: data || [] });
  } catch (error) {
    logger.error('Error listing shop reviews for moderation:', error);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.patch('/admin/:id', authMiddleware, requireAdmin, validateRequestBody(moderateShopReviewSchema), async (req, res) => {
  try {
    const { status, note } = req.body;
    const { data, error } = await supabase
      .from('shop_product_reviews')
      .update({
        status,
        moderation_note: note || null,
        moderated_by: req.user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, status, moderated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Review not found' });

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'shop_review_moderated',
      description: `Set product review ${req.params.id} to ${status}`,
      status: 'success',
    }).then(() => {}, () => {});

    res.json(data);
  } catch (error) {
    logger.error('Error moderating shop review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

export default router;
