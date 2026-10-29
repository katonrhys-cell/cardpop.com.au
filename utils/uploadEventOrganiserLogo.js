// Upload an organiser logo into the `events` bucket and return its public URL.
//
// Path: logos/<uuid>.<ext>. Deliberately NOT a Date.now()-stamped name — the
// events bucket infers a 480 px `.thumb.webp` companion from a timestamped
// filename (utils/imageUrl.js), and a logo has none: it renders at ~300 px as
// is. A random UUID keeps the path immutable/unique (never overwrite a stored
// object; see docs/image-cdn.md) without looking like a thumbnailed upload.
//
// Still PNG/JPEG logos are compressed like any photo; GIF and WebP are
// uploaded untouched (re-encoding through a canvas would freeze an animated
// one on its first frame — compressImage already skips GIF, WebP is skipped
// here), and so are video loops.
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { logoFileError, isVideoLogoFile } from '@/utils/eventOrganiserLogo.js';

const BUCKET = 'events';
const KEEP_AS_IS = /^(image\/(gif|webp)|video\/)/i;

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadEventOrganiserLogo(file) {
  const problem = logoFileError(file);
  if (problem) throw new Error(problem);

  const upload = KEEP_AS_IS.test(file.type) ? file : await compressImage(file, { maxDimension: 1200 });
  const ext = (upload.name.split('.').pop() || (isVideoLogoFile(file) ? 'mp4' : 'png')).toLowerCase();
  const path = `logos/${randomId()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, upload, {
    cacheControl: '31536000',
    contentType: upload.type || file.type,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default uploadEventOrganiserLogo;
