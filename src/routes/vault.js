import 'dotenv/config';
import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, optionalAuthMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import logger from '../utils/logger.js';
import { queryString } from '../utils/queryString.js';
import vaultItemsRouter from './vault-items.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Card upload/update — POST /vault/items, PUT /vault/items/:id. Mounted before
// the GET /:id catch-all below so the sub-router owns the /items path.
router.use('/items', vaultItemsRouter);

// GET /vault/products — authenticated user's own vault items
router.get('/products', authMiddleware, async (req, res) => {
  const { page = '1', limit = '20' } = req.query;
  const sort = queryString(req.query.sort) || 'created_at';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const from = (pageNum - 1) * limitNum;

  logger.info(`[VAULT] Fetching vault items for user ${req.user.id}`);

  const isAdmin = await isAdminUser(req);
  let query = supabase.from('vault_items').select('*', { count: 'exact' });

  if (!isAdmin) query = query.eq('owner_id', req.user.id);

  // vault_items has no title / asking_price / description columns — the card's
  // name is card_name and its value is estimated_value_aud (see
  // src/utils/vaultItemInput.js). Sorting by a missing column 500'd.
  const sortMap = { name: 'card_name', '-name': 'card_name', price: 'estimated_value_aud', '-price': 'estimated_value_aud' };
  const sortCol = sortMap[sort] || 'created_at';
  const ascending = !sort.startsWith('-');
  query = query.order(sortCol, { ascending }).range(from, from + limitNum - 1);

  const { data: items, count, error } = await query;
  if (error) throw error;

  res.json({
    products: (items || []).map(p => ({
      id: p.id,
      name: p.card_name || '',
      description: p.notes || '',
      price: Number(p.estimated_value_aud) || 0,
      userId: p.owner_id,
      is_public: p.is_public || false,
      created: p.created_at,
      updated: p.updated_at,
    })),
    total: count || 0,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil((count || 0) / limitNum),
  });
});

// GET /vault/public — public vault items for marketplace
router.get('/public', async (req, res) => {
  const { page = '1', limit = '20' } = req.query;
  const sort = queryString(req.query.sort) || 'created_at';
  const userId = queryString(req.query.userId);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const from = (pageNum - 1) * limitNum;

  if (userId && !UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }

  let query = supabase
    .from('vault_items')
    .select('*, profiles!vault_items_owner_id_fkey(username, business_name)', { count: 'exact' })
    .eq('is_public', true);

  if (userId) query = query.eq('owner_id', userId);

  const sortCol = sort.replace('-', '') === 'price' ? 'estimated_value_aud' : 'created_at';
  query = query.order(sortCol, { ascending: !sort.startsWith('-') }).range(from, from + limitNum - 1);

  const { data: items, count, error } = await query;
  if (error) throw error;

  res.json({
    products: (items || []).map(p => ({
      id: p.id,
      name: p.card_name || '',
      // The owner's free-text notes are not published on the public feed.
      description: '',
      price: Number(p.estimated_value_aud) || 0,
      userId: p.owner_id,
      userName: p.profiles?.business_name || p.profiles?.username || 'Unknown',
      created: p.created_at,
      updated: p.updated_at,
    })),
    total: count || 0,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil((count || 0) / limitNum),
  });
});

// GET /vault/:id — single vault item (public items visible to all; private items require ownership)
router.get('/:id', optionalAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!id?.trim()) return res.status(400).json({ error: 'Product ID is required' });

  const { data: product, error } = await supabase
    .from('vault_items')
    .select('*, profiles!vault_items_owner_id_fkey(username, business_name)')
    .eq('id', id.trim())
    .single();

  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Product not found' });
  if (error) throw error;

  // Public items visible to all
  if (product.is_public) {
    return res.json({
      id: product.id,
      name: product.card_name || '',
      description: '',
      price: Number(product.estimated_value_aud) || 0,
      userId: product.owner_id,
      userName: product.profiles?.business_name || product.profiles?.username || 'Unknown',
      is_public: true,
      created: product.created_at,
      updated: product.updated_at,
    });
  }

  // Private items require authentication + ownership
  if (!req.user) return res.status(403).json({ error: 'Unauthorized' });

  const isOwner = product.owner_id === req.user.id;
  const isAdmin = await isAdminUser(req);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Unauthorized' });

  res.json({
    id: product.id,
    name: product.card_name || '',
    description: product.notes || '',
    price: Number(product.estimated_value_aud) || 0,
    userId: product.owner_id,
    userName: product.profiles?.business_name || product.profiles?.username || 'Unknown',
    is_public: product.is_public || false,
    created: product.created_at,
    updated: product.updated_at,
  });
});

// PATCH /vault/:id/base-value — admin-only: adjust a card's locked base value
router.patch('/:id/base-value', authMiddleware, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newValue, reason } = req.body;

  // Verify admin status against the DB (defence-in-depth: don't rely solely on JWT claim)
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', req.user.id).single();
  const isAdmin = profile?.is_admin === true;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Only administrators can adjust locked base values.' });
  }

  if (newValue === undefined || newValue === null || isNaN(Number(newValue)) || Number(newValue) < 0) {
    return res.status(400).json({ error: 'A valid newValue (number >= 0) is required.' });
  }

  // Use service-role client to bypass RLS on the protected column
  const { data, error } = await supabase
    .from('vault_items')
    .update({
      locked_base_value_aud: Number(newValue),
      base_value_source: 'admin',
      base_value_set_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, card_name, locked_base_value_aud')
    .single();

  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Card not found.' });
  if (error) throw error;

  logger.info(`[VAULT] Admin ${req.user.id} set locked base value for card ${id} to ${newValue}. Reason: ${reason || 'none'}`);

  res.json({ success: true, card: data, reason: reason || null });
});

export default router;
