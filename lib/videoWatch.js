// Loads the parent row behind a video watch page (pages/videos/VideoWatchPage.jsx)
// and turns it into the shared "watch source" (utils/videoWatch.js). One loader
// per kind of page that carries videos; each reads a single row under the same
// public RLS the parent page uses. Resolves to the source, or null when the
// parent isn't there.
import { supabase } from '@/lib/supabaseClient.js';
import { DIRECTORY_CITIES, fetchStore } from '@/lib/storeDirectory.js';
import { formatEventDate, formatEventLocation } from '@/lib/eventSeo.js';
import { storeLocationLine } from '@/utils/storePage.js';
import {
  ORGANISER_PAGE_COLUMNS, ORGANISER_LINK_COLUMNS,
} from '@/utils/organiserPage.js';
import {
  eventWatchSource, organiserWatchSource, articleWatchSource, storeWatchSource,
} from '@/utils/videoWatch.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadEvent = async ({ slug }) => {
  const { data, error } = await supabase
    .from('events_public')
    .select('*')
    .eq(UUID_PATTERN.test(slug) ? 'id' : 'slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return eventWatchSource(data, { facts: [formatEventDate(data, true), formatEventLocation(data)] });
};

const loadOrganiser = async ({ slug }) => {
  const read = (columns) => supabase.from('event_organisers').select(columns).eq('slug', slug).maybeSingle();
  let { data, error } = await read(`${ORGANISER_PAGE_COLUMNS}, updated_at`);
  // `videos` ships in a migration; without it the page has no videos to watch.
  if (error) ({ data, error } = await read(ORGANISER_LINK_COLUMNS));
  if (error) throw error;
  return data ? organiserWatchSource(data) : null;
};

const loadArticle = async ({ slug }) => {
  const { data: article, error } = await supabase
    .from('blog_articles')
    .select('id, slug, title, excerpt, seo_description, featured_image_url, featured_video_url, category, published_at, created_at')
    .eq(UUID_PATTERN.test(slug) ? 'id' : 'slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!article) return null;
  // An event review keeps its videos in event_reviews (readable while the
  // article is published). Best-effort: a plain article has no row.
  const { data: review } = await supabase
    .from('event_reviews')
    .select('videos, video')
    .eq('article_id', article.id)
    .maybeSingle();
  return articleWatchSource(article, review || null);
};

const loadStore = async ({ city, slug }) => {
  const cityInfo = DIRECTORY_CITIES[city];
  if (!cityInfo) return null;
  const store = await fetchStore(slug);
  if (!store) return null;
  return storeWatchSource(store, { cityLabel: cityInfo.label, facts: [storeLocationLine(store)] });
};

const LOADERS = { event: loadEvent, organiser: loadOrganiser, article: loadArticle, store: loadStore };

/** The parent page's path from the route params alone (where "not found" sends people). */
export const watchParentPath = (kind, { slug, city }) => ({
  event: `/events/${slug}`,
  organiser: `/events/organisers/${slug}`,
  article: `/blog/${slug}`,
  store: `/card-shops/${city}/${slug}`,
}[kind] || '/');

/** The watch source for a route, or null (also for a kind this file doesn't know). */
export const loadWatchSource = async (kind, params) => (LOADERS[kind] ? LOADERS[kind](params) : null);
