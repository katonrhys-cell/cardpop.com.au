import React from 'react';
import CardPopLogo from '@/components/CardPopLogo.jsx';
import { profilePhotoUrl, isOfficialProfile } from '@/utils/profileAvatar.js';

/**
 * A profile's picture, resolved the same way everywhere:
 *   1. their uploaded photo (either storage column — see utils/profileAvatar.js)
 *   2. the CardPop logo for the platform's own account
 *   3. the first letter of their name
 *
 * Size and shape come from `className` (e.g. "w-8 h-8 rounded-full").
 */
const ProfileAvatar = ({ profile, className = 'w-8 h-8 rounded-full', textClassName = 'text-xs', logoClassName = 'w-1/2 h-1/2', fallbackName }) => {
  const src = profilePhotoUrl(profile);
  const name = profile?.display_name || profile?.name || profile?.username || fallbackName || 'U';

  return (
    <div className={`bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 overflow-hidden ${textClassName} ${className}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" decoding="async" />
      ) : isOfficialProfile(profile) ? (
        <CardPopLogo variant="icon" iconClassName={logoClassName} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
};

export default ProfileAvatar;
