import 'dotenv/config';
import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /categories — list all root categories
router.get('/', async (req, res) => {
  const { page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const from = (pageNum - 1) * limitNum;

  const { data: categories, count: total, error } = await supabase
    .from('categories').select('*', { count: 'exact' }).is('parent_id', null)
    .order('name').range(from, from + limitNum - 1);
  if (error) throw error;

  res.json({
    categories: categories || [],
    total: total || 0,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil((total || 0) / limitNum),
  });
});

// GET /categories/:id — single category with its subcategories
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: category, error } = await supabase
    .from('categories').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Category not found' });
  if (error) throw error;

  const { data: subcategories } = await supabase
    .from('categories').select('*').eq('parent_id', id).order('name');

  res.json({ ...category, subcategories: subcategories || [] });
});

// POST /categories — create a new root category (admin only)
router.post('/', authMiddleware, async (req, res) => {
  if (!(await isAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
  const { name, slug, description, logo_url, website_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const { data: existing } = await supabase
    .from('categories').select('id').eq('name', name.trim()).is('parent_id', null).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Category with this name already exists' });

  const { data: category, error } = await supabase.from('categories').insert({
    name: name.trim(),
    slug: slug?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: description?.trim() || null,
    logo_url: logo_url?.trim() || null,
    website_url: website_url?.trim() || null,
    parent_id: null,
  }).select().single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'category_created',
    description: `Category created: ${name.trim()}`, metadata: { categoryId: category.id },
  }).then(() => {}, () => {});

  logger.info(`Category created: ${category.id} by user ${req.user.id}`);
  res.status(201).json(category);
});

// PATCH /categories/:id — update a category (admin only)
router.patch('/:id', authMiddleware, async (req, res) => {
  if (!(await isAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
  const { id } = req.params;
  const { name, slug, description, logo_url, website_url } = req.body;

  const { error: fetchErr } = await supabase.from('categories').select('id').eq('id', id).single();
  if (fetchErr?.code === 'PGRST116') return res.status(404).json({ error: 'Category not found' });
  if (fetchErr) throw fetchErr;

  const updateData = {};
  if (name?.trim()) updateData.name = name.trim();
  if (slug?.trim()) updateData.slug = slug.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (logo_url !== undefined) updateData.logo_url = logo_url?.trim() || null;
  if (website_url !== undefined) updateData.website_url = website_url?.trim() || null;

  const { data: updated, error } = await supabase
    .from('categories').update(updateData).eq('id', id).select().single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'category_updated',
    description: `Category updated: ${updated.name}`, metadata: { categoryId: id },
  }).then(() => {}, () => {});

  logger.info(`Category updated: ${id} by user ${req.user.id}`);
  res.json(updated);
});

// DELETE /categories/:id — delete a category and its subcategories (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  if (!(await isAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
  const { id } = req.params;

  const { data: category, error: fetchErr } = await supabase
    .from('categories').select('name').eq('id', id).single();
  if (fetchErr?.code === 'PGRST116') return res.status(404).json({ error: 'Category not found' });
  if (fetchErr) throw fetchErr;

  await supabase.from('categories').delete().eq('parent_id', id);
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'category_deleted',
    description: `Category deleted: ${category.name}`, metadata: { categoryId: id },
  }).then(() => {}, () => {});

  logger.info(`Category deleted: ${id} by user ${req.user.id}`);
  res.json({ success: true, message: 'Category deleted' });
});

export default router;
