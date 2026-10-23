// Google Merchant Center product feed: shop products + Official CardPop Store
// cards only (utils/merchantFeed.js, docs/merchant-feed.md). Served at
// /merchant-feed.tsv; Merchant Center fetches it on a schedule.
import { createClient } from '@supabase/supabase-js';
import { shopFeedRow, cardFeedRow, toTsv, FEED_SHOP_STATUSES } from '../utils/merchantFeed.js';

const SUPABASE_URL = 'https://vrfsaazuqjxotnieqlkd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lHlLkeTfwzhWQ80Zz6pL6g_jc7Y8p33';

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;

// Same CDN-aware storage URL logic as api/prerender.js.
const IMAGE_CDN_ORIGIN = (() => {
  const host = process.env.IMAGE_CDN_HOST || process.env.VITE_IMAGE_CDN_HOST;
  if (!host) return null;
  const trimmed = host.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
})();
const STORAGE_RE = /^https?:\/\/[^/]+\.supabase\.(co|in)(\/storage\/v1\/(?:object|render\/image)\/public\/.+)$/;
const imageUrl = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  const url = /^https?:\/\//.test(pathOrUrl)
    ? pathOrUrl
    : `${SUPABASE_URL}/storage/v1/object/public/vault-images/${pathOrUrl}`;
  const match = IMAGE_CDN_ORIGIN && url.match(STORAGE_RE);
  return match ? `${IMAGE_CDN_ORIGIN}${match[2]}` : url;
};

// PostgREST caps one response at 1,000 rows; page with a unique tiebreaker.
async function fetchAll(build) {
  const data = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data: page, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    data.push(...(page || []));
    if (!page || page.length < PAGE_SIZE) break;
  }
  return data;
}

export default async function handler(req, res) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

    const [products, listings] = await Promise.all([
      fetchAll(() => supabase
        .from('shop_products')
        .select('id, title, slug, sku, brand, barcode, family_sku, colour, description, price_aud, stock_quantity, category, images, image_url, status, preorder_eta')
        .in('status', FEED_SHOP_STATUSES)
        .order('id')),
      // Official CardPop Store = listings whose seller is an admin. The inner
      // join + filter is the same rule the marketplace identity gate uses.
      fetchAll(() => supabase
        .from('listings')
        .select('id, slug, price_aud, grading_company, vault_item:vault_items!vault_item_id(card_name, collection, set_name, card_number, year, condition, grade, grading_company, card_image, card_images, vault_images(storage_path), franchise:categories!vault_items_franchise_id_fkey(name), category:categories!vault_items_category_id_fkey(name)), seller:profiles!seller_id!inner(is_admin)')
        .eq('status', 'active')
        .eq('listing_type', 'fixed')
        .eq('seller.is_admin', true)
        .order('id')),
    ]);

    const rows = [
      ...products.map(shopFeedRow),
      ...listings.map((l) => {
        const card = l.vault_item || {};
        const paths = [
          ...(card.vault_images || []).map((i) => i.storage_path),
          ...(Array.isArray(card.card_images) ? card.card_images : []),
          card.card_image,
        ].filter(Boolean);
        return cardFeedRow(l, { imageUrls: [...new Set(paths.map(imageUrl))] });
      }),
    ];

    res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).send(toTsv(rows));
  } catch (err) {
    console.error('[merchant-feed] failed:', err?.message);
    // 5xx keeps Merchant Center on the last good fetch instead of an empty feed.
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).send('Feed temporarily unavailable');
  }
}
