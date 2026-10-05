import React from 'react';
import CardPopLogo from '@/components/CardPopLogo.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { profilePhotoUrl, isOfficialProfile } from '@/utils/profileAvatar.js';

/**
 * The one avatar used across CardPop. Always a circle, always the same
 * placeholder, in one of a fixed set of sizes — never hand-roll avatar markup.
 *
 * Picture, in order:
 *   1. an uploaded photo (either storage column — see utils/profileAvatar.js);
 *      `preferBusinessLogo` puts a dealer's business logo ahead of it
 *   2. the CardPop logo, for the platform's own (admin) account
 *   3. the first letter of their name, on the brand tint
 *
 * Sizes:  xs 24px (comments, lists) · sm 32px (cards) · md 48px (seller boxes)
 *         lg 64px (dashboards) · xl 128–160px (profile headers)
 *
 * `src` overrides the resolved photo (e.g. an unsaved upload preview, or
 * `null` to force the placeholder while a photo is being removed).
 */
const SIZES = {
  xs: { box: 'w-6 h-6', text: 'text-[10px]' },
  sm: { box: 'w-8 h-8', text: 'text-xs' },
  md: { box: 'w-12 h-12', text: 'text-base' },
  lg: { box: 'w-16 h-16', text: 'text-2xl' },
  xl: { box: 'w-32 h-32 md:w-40 md:h-40', text: 'text-5xl' },
};

const LOCAL_PREVIEW = /^(data|blob):/;

const ProfileAvatar = ({
  profile,
  size = 'sm',
  src,
  preferBusinessLogo = false,
  name,
  className = '',
}) => {
  const dims = SIZES[size] || SIZES.sm;

  let url;
  if (src !== undefined) {
    url = src && !LOCAL_PREVIEW.test(src) ? publicImageUrl(src) : src || null;
  } else if (preferBusinessLogo && profile?.business_logo_url) {
    url = publicImageUrl(profile.business_logo_url);
  } else {
    url = profilePhotoUrl(profile);
  }

  const label = name || profile?.display_name || profile?.business_name || profile?.name || profile?.username || 'U';

  return (
    <div
      className={`${dims.box} ${dims.text} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 overflow-hidden ${className}`}
    >
      {url ? (
        <img src={url} alt={label} className="w-full h-full object-cover" decoding="async" loading="lazy" />
      ) : isOfficialProfile(profile) ? (
        <CardPopLogo variant="icon" iconClassName="w-1/2 h-1/2" />
      ) : (
        label.charAt(0).toUpperCase()
      )}
    </div>
  );
};

export default ProfileAvatar;
