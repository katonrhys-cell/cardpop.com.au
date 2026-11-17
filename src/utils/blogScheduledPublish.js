// Publishes the blog drafts whose scheduled date has arrived.
//
// Called at the start of the daily blog run (api/blog-generate.js, 07:07
// AEST) — before, and independently of, article generation, so a missing
// ANTHROPIC_API_KEY or a full draft queue never holds back an article an admin
// has already approved and dated. Rules shared with the admin screen live in
// utils/blogSchedule.js.
import supabase from './supabaseClient.js';
import logger from './logger.js';
import { sydneyDateString } from '../../utils/blogSchedule.js';

// A year of scheduled drafts would be ~150; this is a guard, not a limit
// anyone should meet.
const MAX_PER_RUN = 20;

/**
 * Publish every unpublished article with `publish_on` on or before today
 * (Sydney). Returns { published: [{ id, slug, title, publish_on }], failed }.
 * Throws only when the due list itself can't be read.
 */
export async function publishDueArticles(now = new Date()) {
  const today = sydneyDateString(now);
  const { data: due, error } = await supabase
    .from('blog_articles')
    .select('id, slug, title, publish_on')
    .eq('is_published', false)
    .not('publish_on', 'is', null)
    .lte('publish_on', today)
    .order('publish_on', { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) throw new Error(`Could not read scheduled articles: ${error.message}`);

  const published = [];
  let failed = 0;
  for (const article of due || []) {
    // `.eq('is_published', false)` makes a second run on the same day (or an
    // admin publishing by hand in the same minute) a no-op, not a re-stamp.
    // published_at and the cleared publish_on are set by the table's triggers.
    const { data: rows, error: updateError } = await supabase
      .from('blog_articles')
      .update({ is_published: true })
      .eq('id', article.id)
      .eq('is_published', false)
      .select('id');
    if (updateError) {
      failed += 1;
      logger.error(`[BLOG_SCHEDULE] Could not publish "${article.slug}": ${updateError.message}`);
      continue;
    }
    if (rows?.length) {
      published.push(article);
      logger.info(`[BLOG_SCHEDULE] Published "${article.slug}" (scheduled for ${article.publish_on}).`);
    }
  }
  return { published, failed };
}
