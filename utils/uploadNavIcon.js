import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';

// Upload a picture to stand in for a dropdown menu item's icon (Admin → Menu
// Icons). The tile it fills is 24–44 px, so the picture is scaled to 256 px
// on its longest edge (sharp on a 3× screen, a few KB) and re-encoded as WebP,
// which keeps a logo's transparency. It goes to the admin-only `media` bucket
// under nav-icons/ on a timestamped, immutable path with a year-long cache
// header — the rules every other upload follows (docs/image-cdn.md). Returns
// the canonical Supabase public URL; the CDN rewrite happens at render time.

export const NAV_ICON_MAX_DIMENSION = 256;
export const NAV_ICON_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const ACCEPTED = /^image\/(jpeg|png|webp)$/i;

/** What an <input type="file"> for a menu icon should accept. */
export const NAV_ICON_ACCEPT = 'image/jpeg,image/png,image/webp';

/** A plain-English reason the file can't be used, or null when it can. */
export function navIconFileError(file) {
  if (!file) return 'No file selected.';
  if (!ACCEPTED.test(file.type || '')) {
    return 'Pictures must be JPG, PNG or WebP — on an iPhone, choose "Most Compatible" or share the photo as JPG.';
  }
  if (file.size > NAV_ICON_MAX_SOURCE_BYTES) return 'That picture is over 20 MB — choose a smaller one.';
  return null;
}

const safeSegment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';

export const uploadNavIcon = async (file, itemKey) => {
  const problem = navIconFileError(file);
  if (problem) throw new Error(problem);
  const compressed = await compressImage(file, {
    maxDimension: NAV_ICON_MAX_DIMENSION,
    quality: 0.9,
    skipUnderBytes: 40 * 1024,
  });
  const ext = ((compressed.name || file.name).split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
  const path = `nav-icons/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeSegment(itemKey)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, compressed, {
    cacheControl: '31536000',
    contentType: compressed.type || file.type,
  });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
};
