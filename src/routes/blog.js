import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { generateDraft } from '../utils/blogArticleGenerator.js';
import logger from '../utils/logger.js';

const router = Router();

// The scheduled generation entrypoint is NOT here — it lives in
// api/blog-generate.js, which gets its own 300s maxDuration because a single
// article takes minutes. This router is the admin surface for the queue that
// job draws from.
//
// Everything below is admin-only.
router.use(authMiddleware);
// requireAdmin = admin check + MFA step-up (requireAal2), the same gate as
// the /admin router — a bare isAdminUser() check let an AAL1 admin token in.
router.use(requireAdmin);

/**
 * GET /blog/topics
 * The generation queue, for the admin UI.
 */
router.get('/topics', async (req, res) => {
  const { data, error } = await supabase
    .from('blog_article_topics')
    .select('*')
    .order('status', { ascending: true })
    .order('priority', { ascending: true })
    .limit(200);

  if (error) {
    logger.error(`[BLOG_GEN] Failed to list topics: ${error.message}`);
    return res.status(502).json({ error: 'Failed to load topics.' });
  }
  res.json({ topics: data || [] });
});

/**
 * POST /blog/topics
 * Queue a topic for generation.
 */
router.post('/topics', async (req, res) => {
  const { slug, title_hint, brief, category } = req.body || {};
  if (!slug || !title_hint || !brief || !category) {
    return res.status(400).json({ error: 'slug, title_hint, brief and category are required.' });
  }

  const row = {
    slug: String(slug).trim(),
    title_hint: String(title_hint).trim(),
    brief: String(brief).trim(),
    category: String(category).trim(),
    keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
    marketplace_keywords: Array.isArray(req.body.marketplace_keywords)
      ? req.body.marketplace_keywords
      : [],
    tracked_card_slugs: Array.isArray(req.body.tracked_card_slugs)
      ? req.body.tracked_card_slugs
      : [],
    ...(req.body.author ? { author: String(req.body.author).trim() } : {}),
    ...(Number.isInteger(req.body.priority) ? { priority: req.body.priority } : {}),
    ...(Number.isInteger(req.body.min_snapshot_days)
      ? { min_snapshot_days: req.body.min_snapshot_days }
      : {}),
  };

  const { data, error } = await supabase.from('blog_article_topics').insert(row).select().single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That slug is already queued.' });
    logger.error(`[BLOG_GEN] Failed to queue topic: ${error.message}`);
    return res.status(502).json({ error: 'Failed to queue topic.' });
  }
  res.status(201).json({ topic: data });
});

/**
 * POST /blog/topics/:id/preview
 * Generate a draft for one topic and return it WITHOUT writing to
 * blog_articles — for checking a brief before committing it to the queue.
 */
router.post('/topics/:id/preview', async (req, res) => {
  const { data: topic, error } = await supabase
    .from('blog_article_topics')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(502).json({ error: 'Failed to load topic.' });
  if (!topic) return res.status(404).json({ error: 'Unknown topic.' });

  try {
    const { draft, attempts } = await generateDraft(topic);
    res.json({ draft, attempts });
  } catch (err) {
    logger.warn(`[BLOG_GEN] Preview failed for ${topic.slug}: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

/**
 * POST /blog/topics/:id/requeue
 * Put a failed or skipped topic back in the queue.
 */
router.post('/topics/:id/requeue', async (req, res) => {
  const { data, error } = await supabase
    .from('blog_article_topics')
    .update({ status: 'queued', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .maybeSingle();

  if (error) return res.status(502).json({ error: 'Failed to requeue topic.' });
  if (!data) return res.status(404).json({ error: 'Unknown topic.' });
  res.json({ topic: data });
});

export default router;
