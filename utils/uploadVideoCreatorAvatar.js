// Upload the picture of a video's creator (the YouTuber / influencer credited
// under an event video — `creator.avatar_url`, utils/eventVideos.js) and
// return its public URL.
//
// Path: logos/creator-<uuid>.<ext> in the `events` bucket — the same folder
// and naming rule as the organiser logo (utils/uploadEventOrganiserLogo.js):
// a random UUID, never a Date.now()-stamped name, because that bucket infers
// a `.thumb.webp` companion from a timestamped filename and an avatar has
// none. It renders at 44 px, so it is stored at 256 px.
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';

const BUCKET = 'events';
export const CREATOR_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const CREATOR_AVATAR_ACCEPT = CREATOR_AVATAR_TYPES.join(',');
export const CREATOR_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Why a picked file can't be the creator's picture, or null when it can. */
export function creatorAvatarFileError(file) {
  if (!file) return 'Choose a file.';
  if (!CREATOR_AVATAR_TYPES.includes(String(file.type || '').toLowerCase())) return 'Use a PNG, JPG or WebP image.';
  if (file.size > CREATOR_AVATAR_MAX_BYTES) return 'That image is too big — keep it under 5 MB.';
  return null;
}

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadVideoCreatorAvatar(file) {
  const problem = creatorAvatarFileError(file);
  if (problem) throw new Error(problem);

  const upload = await compressImage(file, { maxDimension: 256, skipUnderBytes: 30 * 1024 });
  const ext = (upload.name.split('.').pop() || 'png').toLowerCase();
  const path = `logos/creator-${randomId()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, upload, {
    cacheControl: '31536000',
    contentType: upload.type || file.type,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default uploadVideoCreatorAvatar;
