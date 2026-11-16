// Admin-editable icons for the header's dropdown menu items (Admin → Menu
// Icons, docs/menu-icons.md).
//
// Every dropdown item ships with a built-in icon in code. An admin can replace
// one with an uploaded picture, or with another icon from the built-in library
// (lib/navIconLibrary.js). The overrides are one JSON object in
// platform_settings under `nav_menu_icons`:
//
//   { "collection:pokemon": { "image": "https://…/nav-icons/….webp", "fit": "cover" },
//     "link:/grading/estimator": { "icon": "Calculator" } }
//
// It rides the public settings read every page already makes, so the menus
// cost no extra request. This file is the ONE normaliser — the API cleans the
// stored value with it before publishing (src/routes/settings.js) and the
// browser cleans what it receives — and it is dependency-free so both can
// import it.

export const NAV_MENU_ICONS_KEY = 'nav_menu_icons';

/** How an uploaded picture sits in the tile: cropped to fill it, or shown whole. */
export const NAV_ICON_FITS = ['cover', 'contain'];

const KEY_RE = /^[a-z0-9][a-z0-9:/_-]{0,95}$/;
const ICON_NAME_RE = /^[A-Za-z][A-Za-z0-9]{0,47}$/;
const MAX_ENTRIES = 300;
const MAX_URL_LENGTH = 600;

// One key shape per kind of menu item, so the menus and the admin page can't
// drift apart on how an item is named.
export const navIconKey = {
  /** Buy Cards → a game or sport (`/collections/<slug>`). */
  collection: (slug) => `collection:${slug}`,
  /** Supplies → a parent category (Protection, Storage, …). */
  shopGroup: (slug) => `shop-group:${slug}`,
  /** Supplies → a subcategory (`/shop/category/<slug>`). */
  shopCategory: (slug) => `shop-category:${slug}`,
  /** Prices / Community / Events / Grading / More → keyed by the link itself. */
  link: (href) => `link:${href}`,
};

/** An https URL safe to put in an <img src>, or null. */
export function safeNavIconImage(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || /[\s"'<>\\]/.test(trimmed)) return null;
  try {
    return new URL(trimmed).protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

/** One override → `{ image, fit }`, `{ icon }` or null when it isn't usable. */
export function cleanNavIconOverride(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const image = safeNavIconImage(value.image);
  if (image) return { image, fit: value.fit === 'contain' ? 'contain' : 'cover' };
  if (typeof value.icon === 'string' && ICON_NAME_RE.test(value.icon)) return { icon: value.icon };
  return null;
}

/**
 * The stored setting → a clean `{ key: override }` map. Never throws: anything
 * malformed (a string that isn't JSON, an array, a bad key or URL) is dropped,
 * so a broken row can only ever mean "built-in icons".
 */
export function cleanNavMenuIcons(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  let count = 0;
  for (const [key, entry] of Object.entries(value)) {
    if (count >= MAX_ENTRIES) break;
    if (!KEY_RE.test(key)) continue;
    const override = cleanNavIconOverride(entry);
    if (!override) continue;
    out[key] = override;
    count += 1;
  }
  return out;
}

/**
 * A copy of `map` with one item's override set — or removed when `override`
 * is null/unusable (back to the built-in icon).
 */
export function withNavIconOverride(map, key, override) {
  const next = { ...cleanNavMenuIcons(map) };
  const clean = KEY_RE.test(String(key)) ? cleanNavIconOverride(override) : null;
  if (clean) next[key] = clean;
  else delete next[key];
  return next;
}

/** 'photo' | 'icon' | 'default' — what an item is currently showing. */
export function navIconKind(override) {
  if (override?.image) return 'photo';
  if (override?.icon) return 'icon';
  return 'default';
}
