import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';

// Upload one review photo (cover, gallery or pickup) to the admin-only `media`
// bucket under event-reviews/<folder>/, compressed in the browser first and
// stored under a timestamped, immutable path with a year-long cache header —
// the same rules every other image upload follows (docs/image-cdn.md). Returns
// the canonical Supabase public URL; the CDN rewrite happens at render time.
export const uploadReviewImage = async (file, { folder = 'misc', maxDimension = 2000 } = {}) => {
  if (!file) throw new Error('No file selected');
  if (!/^image\//i.test(file.type)) throw new Error('Only image files can be uploaded');
  const compressed = await compressImage(file, { maxDimension, quality: 0.84 });
  const ext = ((compressed.name || file.name).split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
  const base = (file.name || 'photo')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'photo';
  const safeFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  const path = `event-reviews/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, compressed, {
    cacheControl: '31536000',
    contentType: compressed.type || file.type,
  });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
};
