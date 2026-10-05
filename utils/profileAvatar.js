import { publicImageUrl } from '@/utils/imageUrl.js';

/**
 * One place that answers "which picture belongs to this profile?".
 *
 * A profile photo has historically been stored in two columns depending on
 * which form saved it: `avatar_url` (Account → Public Profile, OAuth sign-up,
 * Vault profile) and `profile_photo_or_character` (Account → Public Profile
 * page, verification). Every reader used to pick one, so a photo set in one
 * place vanished in another. Readers must go through this helper, and writers
 * must go through `profilePhotoColumns()` so both columns always agree.
 *
 * Values may be a full URL or a `vault-images` bucket path — `publicImageUrl`
 * handles both and routes through the image CDN.
 */
export function profilePhotoUrl(profile) {
  if (!profile) return null;
  return publicImageUrl(profile.avatar_url || profile.profile_photo_or_character) || null;
}

/** The platform's own account (`is_admin`) — shown as the CardPop mark when it has no photo. */
export function isOfficialProfile(profile) {
  return profile?.is_admin === true;
}

/** Columns to write when a user sets (`value`) or removes (`null`) their photo. */
export function profilePhotoColumns(value) {
  return { avatar_url: value ?? null, profile_photo_or_character: value ?? null };
}
