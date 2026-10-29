// One upload path for every picture in the `events` storage bucket — the
// event cover/poster and gallery photos (EventFormModal) and the stall layout
// plan (EventInfoBoard). It compresses the file, uploads it under an immutable
// timestamped path and then writes the 480 px `.thumb.webp` companion next to
// it (thumbStoragePath), the same shape card uploads use, so small tiles —
// the Community hub's upcoming-event cards, the events grid — can load the
// thumb instead of the full poster. `getCardImage` infers a thumb from the
// bucket + upload timestamp (EVENT_THUMBNAILS_SINCE), so EVERY writer to this
// bucket must go through here: a timestamped upload with no thumb would make
// the tiles chase a 404 before falling back.
//
// The thumb is best-effort — a failure is logged and the full image is still
// saved, because renderers fall back to it on error.
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage, createThumbnail } from '@/utils/compressImage.js';
import { thumbStoragePath, EVENTS_BUCKET } from '@/utils/imageUrl.js';

const CACHE_CONTROL = '31536000';

/**
 * @param {File} file   The picked image.
 * @param {object} opts
 * @param {string} opts.folder  Bucket folder, e.g. `events` or `events/gallery`.
 * @param {string} opts.stem    Filename without extension — must contain the
 *                              `Date.now()` stamp (that is how a thumb is inferred).
 * @param {boolean} [opts.upsert]
 * @returns {Promise<string>} The full image's public (canonical Supabase) URL.
 */
export async function uploadEventImage(file, { folder, stem, upsert = false }) {
  const compressed = await compressImage(file);
  const ext = compressed.name.split('.').pop() || 'jpg';
  const path = `${folder}/${stem}.${ext}`;
  const bucket = supabase.storage.from(EVENTS_BUCKET);

  const { error: upErr } = await bucket.upload(path, compressed, { upsert, cacheControl: CACHE_CONTROL });
  if (upErr) throw upErr;

  try {
    const thumb = await createThumbnail(compressed);
    const { error: thumbErr } = await bucket.upload(thumbStoragePath(path), thumb, {
      upsert: true,
      contentType: thumb.type || 'image/webp',
      cacheControl: CACHE_CONTROL,
    });
    if (thumbErr) console.warn('Event thumbnail upload failed (tiles will use the full image):', thumbErr);
  } catch (err) {
    console.warn('Event thumbnail generation failed (tiles will use the full image):', err);
  }

  return bucket.getPublicUrl(path).data.publicUrl;
}

export default uploadEventImage;
