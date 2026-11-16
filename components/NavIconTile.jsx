// The small coloured icon tile beside a dropdown menu item — the one place
// that decides what an item shows: the admin's uploaded picture, the admin's
// pick from the built-in library, or the icon the item ships with (Admin →
// Menu Icons, docs/menu-icons.md).
//
//   className     size / radius / shadow of the tile (`w-7 h-7 rounded-lg shadow-sm`)
//   bgClassName   the tile's own background (its gradient) — dropped when a
//   + style       picture fills the tile
//   iconClassName the glyph's size and colour
//   override      admin preview only: show this override instead of the saved
//                 one (`null` = the built-in icon)
import React, { useState } from 'react';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { useNavMenuIcons, useNavLibraryIcon } from '@/hooks/useNavMenuIcons.js';

const TILE = 'inline-flex items-center justify-center shrink-0 overflow-hidden';

const NavIconTile = ({
  iconKey,
  Icon,
  className = 'w-7 h-7 rounded-lg shadow-sm',
  bgClassName = '',
  style,
  iconClassName = 'w-4 h-4 text-white',
  override: previewOverride,
}) => {
  const saved = useNavMenuIcons();
  const override = previewOverride !== undefined ? previewOverride : saved[iconKey];
  const LibraryIcon = useNavLibraryIcon(override?.icon);
  // A picture that fails to load (deleted from storage, offline) falls back to
  // the built-in icon rather than leaving a broken-image box in the menu.
  const [brokenSrc, setBrokenSrc] = useState(null);

  const src = override?.image ? publicImageUrl(override.image) : null;
  if (src && src !== brokenSrc) {
    const contain = override.fit === 'contain';
    return (
      <span className={`${TILE} ${className} ${contain ? 'bg-white p-0.5' : ''}`} data-nav-icon="photo">
        <img
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setBrokenSrc(src)}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
        />
      </span>
    );
  }

  const Glyph = LibraryIcon || Icon;
  return (
    <span className={`${TILE} ${className} ${bgClassName}`} style={style}>
      {/* Library glyphs draw in the text colour; the built-in ones a tile was
          designed around may carry their own colours, so only the former is
          forced white. */}
      {Glyph && <Glyph className={LibraryIcon ? `${iconClassName} text-white` : iconClassName} />}
    </span>
  );
};

export default NavIconTile;
