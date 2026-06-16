import 'dotenv/config';
import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /vault/products — authenticated user's own vault items
router.get('/products', authMiddleware, async (req, res) => {
  const { page = '1', limit = '20', sort = 'created_at' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const from = (pageNum - 1) * limitNum;

  logger.info(`[VAULT] Fetching vault items for user ${req.user.id}`);

  const isAdmin = req.user.app_metadata?.is_admin || false;
  let query = supabase.from('vault_items').select('*', { count: 'exact' });

  if (!isAdmin) query = query.eq('owner_id', req.user.id);

  const sortMap = { name: 'title', '-name': 'title', price: 'asking_price', '-price': 'asking_price' };
  const sortCol = sortMap[sort] || 'created_at';
  const ascending = !sort.startsWith('-');
  query = query.order(sortCol, { ascending }).range(from, from + limitNum - 1);

  const { data: items, count, error } = await query;
  if (error) throw error;

  res.json({
    products: (items || []).map(p => ({
      id: p.id,
      name: p.title,
      description: p.description || '',
      price: p.asking_price || 0,
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
  const { page = '1', limit = '20', sort = 'created_at', userId } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const from = (pageNum - 1) * limitNum;

  let query = supabase
    .from('vault_items')
    .select('*, profiles!owner_id(username, business_name)', { count: 'exact' })
    .eq('is_public', true);

  if (userId?.trim()) query = query.eq('owner_id', userId.trim());

  const sortCol = sort.replace('-', '') === 'price' ? 'asking_price' : 'created_at';
  query = query.order(sortCol, { ascending: !sort.startsWith('-') }).range(from, from + limitNum - 1);

  const { data: items, count, error } = await query;
  if (error) throw error;

  res.json({
    products: (items || []).map(p => ({
      id: p.id,
      name: p.title,
      description: p.description || '',
      price: p.asking_price || 0,
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
    .select('*, profiles!owner_id(username, business_name)')
    .eq('id', id.trim())
    .single();

  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Product not found' });
  if (error) throw error;

  // Public items visible to all
  if (product.is_public) {
    return res.json({
      id: product.id,
      name: product.title,
      description: product.description || '',
      price: product.asking_price || 0,
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
  const isAdmin = req.user.app_metadata?.is_admin || false;
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Unauthorized' });

  res.json({
    id: product.id,
    name: product.title,
    description: product.description || '',
    price: product.asking_price || 0,
    userId: product.owner_id,
    userName: product.profiles?.business_name || product.profiles?.username || 'Unknown',
    is_public: product.is_public || false,
    created: product.created_at,
    updated: product.updated_at,
  });
});

// PATCH /vault/:id/base-value — admin-only: adjust a card's locked base value
router.patch('/:id/base-value', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { newValue, reason } = req.body;

  const isAdmin = req.user.app_metadata?.is_admin === true;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Only administrators can adjust locked base values.' });
  }

  if (!newValue || isNaN(Number(newValue)) || Number(newValue) < 0) {
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
