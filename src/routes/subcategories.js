import 'dotenv/config';
import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /subcategories — list subcategories (all, or filtered by parentId)
router.get('/', async (req, res) => {
  const { page = '1', limit = '50', parentId } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const from = (pageNum - 1) * limitNum;

  let query = supabase.from('categories').select('*', { count: 'exact' }).not('parent_id', 'is', null);
  if (parentId) query = query.eq('parent_id', parentId);

  const { data: subcategories, count: total, error } = await query.order('name').range(from, from + limitNum - 1);
  if (error) throw error;

  res.json({
    subcategories: subcategories || [],
    total: total || 0,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil((total || 0) / limitNum),
  });
});

// GET /subcategories/:id — single subcategory
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: subcategory, error } = await supabase
    .from('categories').select('*').eq('id', id).not('parent_id', 'is', null).single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Subcategory not found' });
  if (error) throw error;

  res.json(subcategory);
});

// POST /subcategories — create under a parent (admin only)
router.post('/', authMiddleware, async (req, res) => {
  if (!(await isAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
  const { name, slug, description, parentId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!parentId) return res.status(400).json({ error: 'parentId is required' });

  const { data: parent, error: parentErr } = await supabase
    .from('categories').select('id, name').eq('id', parentId).single();
  if (parentErr || !parent) return res.status(404).json({ error: 'Parent category not found' });

  const { data: existing } = await supabase
    .from('categories').select('id').eq('name', name.trim()).eq('parent_id', parentId).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Subcategory with this name already exists under this parent' });

  const { data: subcategory, error } = await supabase.from('categories').insert({
    name: name.trim(),
    slug: slug?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: description?.trim() || null,
    parent_id: parentId,
  }).select().single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'subcategory_created',
    description: `Subcategory created: ${name.trim()} under ${parent.name}`,
    metadata: { subcategoryId: subcategory.id, parentId },
  }).catch(() => {});

  logger.info(`Subcategory created: ${subcategory.id} under ${parentId} by user ${req.user.id}`);
  res.status(201).json(subcategory);
});

// PATCH /subcategories/:id — update (admin only)
router.patch('/:id', authMiddleware, async (req, res) => {
  if (!(await isAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
  const { id } = req.params;
  const { name, slug, description, parentId } = req.body;

  const { error: fetchErr } = await supabase.from('categories').select('id').eq('id', id).single();
  if (fetchErr?.code === 'PGRST116') return res.status(404).json({ error: 'Subcategory not found' });
  if (fetchErr) throw fetchErr;

  const updateData = {};
  if (name?.trim()) updateData.name = name.trim();
  if (slug?.trim()) updateData.slug = slug.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (parentId) {
    if (parentId === id) return res.status(400).json({ error: 'A subcategory cannot be its own parent' });
    const { data: parent, error: parentErr } = await supabase
      .from('categories').select('id').eq('id', parentId).single();
    if (parentErr || !parent) return res.status(404).json({ error: 'Parent category not found' });
    updateData.parent_id = parentId;
  }

  const { data: updated, error } = await supabase
    .from('categories').update(updateData).eq('id', id).select().single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'subcategory_updated',
    description: `Subcategory updated: ${updated.name}`, metadata: { subcategoryId: id },
  }).catch(() => {});

  logger.info(`Subcategory updated: ${id} by user ${req.user.id}`);
  res.json(updated);
});

// DELETE /subcategories/:id — delete (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  if (!(await isAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
  const { id } = req.params;

  const { data: sub, error: fetchErr } = await supabase
    .from('categories').select('name').eq('id', id).not('parent_id', 'is', null).single();
  if (fetchErr?.code === 'PGRST116') return res.status(404).json({ error: 'Subcategory not found' });
  if (fetchErr) throw fetchErr;

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'subcategory_deleted',
    description: `Subcategory deleted: ${sub.name}`, metadata: { subcategoryId: id },
  }).catch(() => {});

  logger.info(`Subcategory deleted: ${id} by user ${req.user.id}`);
  res.json({ success: true, message: 'Subcategory deleted' });
});

export default router;
