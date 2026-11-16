// The admin's icon overrides for the header dropdown items, as the menus read
// them: a clean `{ key: override }` map out of the public platform settings
// (no request of its own), plus a lazy loader for the built-in icon library
// that only runs when an override actually names a library icon.
import { useEffect, useMemo, useState } from 'react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { NAV_MENU_ICONS_KEY, cleanNavMenuIcons } from '@/utils/navMenuIcons.js';

/** @returns {Record<string, { image: string, fit: string } | { icon: string }>} */
export function useNavMenuIcons() {
  const { settings } = usePlatformSettings();
  const raw = settings?.[NAV_MENU_ICONS_KEY];
  return useMemo(() => cleanNavMenuIcons(raw), [raw]);
}

let libraryByName = null;
let libraryLoading = null;

const loadLibrary = () => {
  if (!libraryLoading) {
    libraryLoading = import('@/lib/navIconLibrary.js')
      .then((mod) => { libraryByName = mod.NAV_ICON_BY_NAME; return libraryByName; })
      .catch(() => { libraryLoading = null; return null; });
  }
  return libraryLoading;
};

/**
 * The library component for `name`, or null while the library chunk is still
 * loading / when the name isn't in it — the caller keeps showing the item's
 * built-in icon in both cases. Passing no name never loads the chunk.
 */
export function useNavLibraryIcon(name) {
  const [, setLoaded] = useState(Boolean(libraryByName));

  useEffect(() => {
    if (!name || libraryByName) return undefined;
    let cancelled = false;
    loadLibrary().then((lib) => { if (lib && !cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [name]);

  return (name && libraryByName && libraryByName[name]) || null;
}
