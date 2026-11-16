# Menu icons (Admin → Menu Icons)

Every item in the header's dropdown menus — **Buy Cards** (games and sports),
**Supplies** (categories and subcategories), **Prices**, **Community** (plus
Events and Reads), **Grading** and **More** — has a small icon tile beside it.
Each ships with an icon in code. An admin can change any of them at
**Admin → Menu Icons** (`/admin/menu-icons`) without a deploy:

- **Upload picture** — a JPG, PNG or WebP. It fills the tile (cropped to fit);
  **Show whole picture** switches to the whole image on a white tile, which
  suits a wide logo.
- **Choose icon** — another icon from the built-in library.
- **Use original** — back to the icon the item shipped with.

Each change saves on its own. The admin's own header updates immediately;
visitors see it within a couple of minutes (the settings endpoint's 60 s
server cache plus Cloudflare's 60 s edge cache). The same tile is used by the
desktop dropdowns, the mobile menu and the Community Hub page's directory
tiles, so one change covers all three.

## How it works

| Piece | File |
|---|---|
| Normaliser + item keys (dependency-free, shared by API and browser) | `utils/navMenuIcons.js` |
| The tile every menu item renders | `components/NavIconTile.jsx` |
| Overrides hook + lazy library loader | `hooks/useNavMenuIcons.js` |
| Built-in icon library (lazy chunk) | `lib/navIconLibrary.js` |
| Upload (256 px WebP → `media/nav-icons/…`) | `utils/uploadNavIcon.js` |
| Admin page | `pages/admin/MenuIconsAdminPage.jsx` |

**Storage.** One JSON object in `platform_settings` under the key
`nav_menu_icons`:

```json
{
  "collection:pokemon":        { "image": "https://…/media/nav-icons/….webp", "fit": "cover" },
  "link:/grading/estimator":   { "icon": "Calculator" },
  "shop-category:top-loaders": { "image": "https://…", "fit": "contain" }
}
```

It is on the public settings whitelist (`PUBLIC_SETTINGS` in
`src/routes/settings.js`), so it rides the `/hcgi/api/public/settings` request
every page already makes — the menus make no request of their own, and the
copy cached in `localStorage` means a returning visitor's first frame already
has the right icons. No migration: the row is created on the first save.

**Keys** come only from `navIconKey` in `utils/navMenuIcons.js`:
`collection:<slug>`, `shop-group:<slug>`, `shop-category:<slug>` and
`link:<href>`. The menus and the admin page both build keys with it, and the
admin page builds its list from the same arrays the menus render
(`buildMenuIconSections()`), so a new menu item appears on the admin page by
itself — as long as its tile is rendered with `<NavIconTile iconKey={…}>`.

**Safety.** The stored value is cleaned by `cleanNavMenuIcons()` on the server
before it is published and again in the browser: keys must match a fixed
pattern, a picture must be an `https:` URL, an icon must be a plain name.
Anything else is dropped, so a malformed row can only mean "built-in icons".
A picture that fails to load falls back to the built-in icon. Writes are
admin-only through the existing `platform_settings` RLS policy; uploads go to
the admin-only `media` bucket.

**Saving.** The page re-reads the row immediately before each write and
changes only the one item, so two admins editing different items don't undo
each other. Admin → Settings deliberately skips this key
(`KEYS_OWNED_ELSEWHERE` in `AdminSettingsPage.jsx`) — that page writes back
every key it loaded, which would otherwise restore a stale copy.

**Bundle.** The built-in icon library is a separate chunk loaded only when an
override names a library icon (`useNavLibraryIcon`), and by the admin page.
Uploaded pictures are served through `publicImageUrl()` (image CDN + service
worker cache) like every other storage image.

## Rules

- Render a dropdown item's icon through `NavIconTile` with a `navIconKey` key —
  a hand-written `<span>` + icon can't be changed from the admin page.
- Never rename or remove a name in `lib/navIconLibrary.js`; stored overrides
  refer to it. Adding names is fine.
- Changing an item's `href` or slug changes its key, so its override no longer
  applies (the item goes back to its built-in icon). Re-apply it on the admin
  page, or rewrite the key in the stored JSON.
- Not covered: the section headings in the mobile menu, the admin links and the
  account menu — those are plain glyphs, not menu-item tiles.

Tests: `tests/frontend/navMenuIcons.test.jsx`, `tests/backend/settings.test.js`.
