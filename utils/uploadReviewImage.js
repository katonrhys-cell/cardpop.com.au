import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { captureVideoPoster } from '@/utils/cardVideo.js';
import { reviewVideoFileError } from '@/utils/eventReview.js';

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

// Upload the review video (an MP4/MOV/WebM clip) to media/event-reviews/videos/,
// immutable path and year-long cache header like the photos, plus a JPEG
// poster frame grabbed in the browser so the player isn't a black box before
// play. Videos are never re-encoded — the 50 MB bucket cap bounds them, and a
// longer clip goes up as a YouTube/Vimeo link instead. Returns
// { url, poster_url } as canonical Supabase public URLs (poster_url may be null).
export const uploadReviewVideo = async (file) => {
  const problem = reviewVideoFileError(file);
  if (problem) throw new Error(problem);
  const ext = ((file.name || '').split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const base = (file.name || 'video')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'video';
  const stem = `event-reviews/videos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base}`;
  const contentType = file.type || (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  const { error } = await supabase.storage.from('media').upload(`${stem}.${ext}`, file, {
    cacheControl: '31536000',
    contentType,
  });
  if (error) throw error;
  const url = supabase.storage.from('media').getPublicUrl(`${stem}.${ext}`).data.publicUrl;

  // The poster is cosmetic: a failed capture or upload never fails the video.
  let poster_url = null;
  const poster = await captureVideoPoster(file);
  if (poster) {
    const { error: posterError } = await supabase.storage.from('media').upload(`${stem}.poster.jpg`, poster, {
      cacheControl: '31536000',
      contentType: 'image/jpeg',
    });
    if (!posterError) poster_url = supabase.storage.from('media').getPublicUrl(`${stem}.poster.jpg`).data.publicUrl;
  }
  return { url, poster_url };
};
