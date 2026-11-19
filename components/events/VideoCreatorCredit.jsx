import React from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Facebook, Instagram, Music2, Youtube } from 'lucide-react';
import XIcon from '@/components/XIcon.jsx';
import { creatorLinks } from '@/utils/eventVideos.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { videoCreatorPath } from '@/utils/videoCreators.js';

const ICONS = { instagram: Instagram, youtube: Youtube, tiktok: Music2, facebook: Facebook, x: XIcon };

// Who made a video — the creator's picture, name and social handles, shown
// under the player (`creator` out of cleanVideoCreator, utils/eventVideos.js).
// Renders nothing without a credit.
//
// A saved creator (the credit carries `slug`) links to their page — every
// event video they have made (/creators/<slug>). `linkProfile={false}` leaves
// that out: the form's preview, and the creator's own page.
const VideoCreatorCredit = ({ creator, linkProfile = true }) => {
  const inRouter = useInRouterContext();
  if (!creator) return null;
  const links = creatorLinks(creator);
  const name = creator.name || '';
  const profilePath = linkProfile ? videoCreatorPath(creator) : null;
  const profileLink = (className, children) => (inRouter
    ? <Link to={profilePath} className={className}>{children}</Link>
    : <a href={profilePath} className={className}>{children}</a>);

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
      {creator.avatar_url ? (
        <img
          src={publicImageUrl(creator.avatar_url)}
          alt={name ? `${name} profile picture` : 'Video creator profile picture'}
          width="44"
          height="44"
          loading="lazy"
          className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
        />
      ) : name ? (
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red text-base font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight">
          <span className="text-xs text-muted-foreground">Video by </span>
          {name && (profilePath
            ? profileLink('font-semibold text-foreground underline-offset-2 hover:text-brand-red hover:underline', name)
            : <span className="font-semibold text-foreground">{name}</span>)}
        </p>
        {links.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {links.map(({ key, label, url, handle }) => {
              const Icon = ICONS[key];
              return (
                <li key={key}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${name || 'Creator'} on ${label}${handle ? ` (${handle})` : ''}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-brand-red hover:text-brand-red"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-w-[11rem] truncate">{handle || label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        {profilePath && (
          <p className="mt-1.5 text-xs">
            {profileLink('font-medium text-muted-foreground underline-offset-2 hover:text-brand-red hover:underline', `More event videos by ${name || 'this creator'}`)}
          </p>
        )}
      </div>
    </div>
  );
};

export default VideoCreatorCredit;
