import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { captureVideoPoster } from '@/utils/cardVideo.js';
import { reviewVideoFileError } from '@/utils/eventReview.js';

// Uploads for a card shop's page (Admin → Store Directory → Edit). Both go to
// the admin-only `media` bucket under stores/<slug>/, on a timestamped,
// immutable path with a year-long cache header — the rules every other upload
// follows (docs/image-cdn.md). They return canonical Supabase public URLs; the
// CDN rewrite happens at render time.

const safeSegment = (value, fallback) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback;

const stem = (slug, kind, file, fallback) =>
  `stores/${safeSegment(slug, 'store')}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeSegment((file.name || '').replace(/\.[^/.]+$/, ''), fallback)}`;

/** One photo, compressed in the browser first. Returns its public URL. */
export const uploadStorePhoto = async (file, slug, { kind = 'photos', maxDimension = 2000 } = {}) => {
  if (!file) throw new Error('No file selected');
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
    throw new Error('Photos must be JPG, PNG or WebP — on an iPhone, choose "Most Compatible" or share the photo as JPG.');
  }
  const compressed = await compressImage(file, { maxDimension, quality: 0.84 });
  const ext = ((compressed.name || file.name).split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
  const path = `${stem(slug, kind, file, 'photo')}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, compressed, {
    cacheControl: '31536000',
    contentType: compressed.type || file.type,
  });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
};

/** The shop's logo: a small image (WebP keeps a PNG's transparency). */
export const uploadStoreLogo = (file, slug) => uploadStorePhoto(file, slug, { kind: 'logo', maxDimension: 600 });

/**
 * One video clip (MP4 / MOV / WebM, 50 MB bucket cap — longer goes up as a
 * YouTube link), never re-encoded, plus a poster frame grabbed in the browser.
 * Returns { url, poster_url } (poster_url may be null).
 */
export const uploadStoreVideo = async (file, slug) => {
  const problem = reviewVideoFileError(file);
  if (problem) throw new Error(problem);
  const ext = ((file.name || '').split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const base = stem(slug, 'videos', file, 'video');
  const contentType = file.type || (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  const { error } = await supabase.storage.from('media').upload(`${base}.${ext}`, file, {
    cacheControl: '31536000',
    contentType,
  });
  if (error) throw error;
  const url = supabase.storage.from('media').getPublicUrl(`${base}.${ext}`).data.publicUrl;

  // The poster is cosmetic: a failed capture or upload never fails the video.
  let poster_url = null;
  try {
    const poster = await captureVideoPoster(file);
    if (poster) {
      const { error: posterError } = await supabase.storage.from('media').upload(`${base}.poster.jpg`, poster, {
        cacheControl: '31536000',
        contentType: 'image/jpeg',
      });
      if (!posterError) poster_url = supabase.storage.from('media').getPublicUrl(`${base}.poster.jpg`).data.publicUrl;
    }
  } catch { /* no poster */ }
  return { url, poster_url };
};
