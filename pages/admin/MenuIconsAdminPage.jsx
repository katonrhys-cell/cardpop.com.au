// Admin → Menu Icons: change the icon beside any item in the header's
// dropdown menus (Buy Cards, Supplies, Prices, Community, Grading, More) —
// upload a picture, pick another built-in icon, or go back to the original.
//
// The overrides are one JSON object in platform_settings (`nav_menu_icons`,
// utils/navMenuIcons.js) which the public settings endpoint publishes, so the
// menus read them with no request of their own. Every change is its own save:
// the row is re-read immediately before each write and only that one item is
// changed, so two admins editing different items don't undo each other.
// See docs/menu-icons.md.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ImagePlus, Loader2, Maximize2, Minimize2, RotateCcw, Search, Shapes } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import NavIconTile from '@/components/NavIconTile.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';
import { TCG_CATEGORY_DATA, SPORTS_CATEGORY_DATA } from '@/components/CategoryIcons.jsx';
import { ANALYTICS_ITEMS, GRADING_ITEMS, MORE_ITEMS } from '@/components/HeaderMenus.jsx';
import { COMMUNITY_ITEMS, EVENT_ITEMS, READS_ITEM, badgeStyle } from '@/lib/communityNav.js';
import { NAV_ICON_LIBRARY } from '@/lib/navIconLibrary.js';
import {
  NAV_MENU_ICONS_KEY, cleanNavMenuIcons, navIconKey, navIconKind, withNavIconOverride,
} from '@/utils/navMenuIcons.js';
import { NAV_ICON_ACCEPT, navIconFileError, uploadNavIcon } from '@/utils/uploadNavIcon.js';
import { classifyUploadError } from '@/utils/storageUploadError.js';

const gradientBg = (gradient) => `bg-gradient-to-br ${gradient}`;

/**
 * Every dropdown item an admin can re-icon, grouped the way the menus show
 * them. Built from the same lists the menus render, so an item added to a
 * menu appears here without touching this page. Exported for tests.
 */
export function buildMenuIconSections(shopGroups = []) {
  const collection = (cat) => ({
    key: navIconKey.collection(cat.slug),
    label: cat.name,
    hint: `/collections/${cat.slug}`,
    Icon: cat.Icon,
    bgClassName: gradientBg(cat.gradient),
    // The game and sport icons carry their own colours.
    ownColours: true,
  });
  const link = (item) => {
    const badge = badgeStyle(item);
    return {
      key: navIconKey.link(item.href),
      label: item.label,
      hint: item.desc,
      Icon: item.Icon,
      bgClassName: badge.className,
      style: badge.style,
    };
  };
  return [
    { id: 'buy-tcg', menu: 'Buy Cards', title: 'Trading Card Games', items: TCG_CATEGORY_DATA.map(collection) },
    { id: 'buy-sports', menu: 'Buy Cards', title: 'Sporting Cards', items: SPORTS_CATEGORY_DATA.map(collection) },
    ...shopGroups.map((group) => ({
      id: `shop-${group.slug}`,
      menu: 'Supplies',
      title: group.label,
      items: [
        {
          key: navIconKey.shopGroup(group.slug),
          label: group.label,
          hint: 'The category itself, in the left-hand list',
          Icon: group.Icon,
          bgClassName: gradientBg(group.gradient),
        },
        ...group.items.map((item) => ({
          key: navIconKey.shopCategory(item.slug),
          label: item.name,
          hint: item.desc,
          Icon: item.Icon,
          bgClassName: gradientBg(group.gradient),
        })),
      ],
    })),
    { id: 'prices', menu: 'Prices', title: 'Prices', items: ANALYTICS_ITEMS.map(link) },
    { id: 'community', menu: 'Community', title: 'Community', items: COMMUNITY_ITEMS.map(link) },
    { id: 'events', menu: 'Community', title: 'Events', items: EVENT_ITEMS.map(link) },
    { id: 'reads', menu: 'Community', title: 'Reads', items: [link(READS_ITEM)] },
    { id: 'grading', menu: 'Grading', title: 'Grading', items: GRADING_ITEMS.map(link) },
    { id: 'more', menu: 'More', title: 'More', items: MORE_ITEMS.map(link) },
  ];
}

const KIND_LABEL = { photo: 'Your picture', icon: 'Changed icon', default: 'Original' };

const uploadFailureMessage = (err) => {
  switch (classifyUploadError(err)) {
    case 'too-large': return 'That picture is too large to store. Try a smaller one.';
    case 'bad-type': return 'That file type isn’t accepted. Use a JPG, PNG or WebP picture.';
    case 'not-allowed': return 'Storage refused the upload — your admin session may have expired. Sign in again and retry.';
    case 'offline': return 'The upload didn’t get through. Check your connection and try again.';
    default: return err?.message || 'The picture could not be uploaded.';
  }
};

// `busy` marks the item being saved; `disabled` locks every card while any
// save is in flight, since each save re-reads and rewrites the one shared row.
const ItemCard = ({ item, override, busy, disabled, onUpload, onChooseIcon, onToggleFit, onReset }) => {
  const kind = navIconKind(override);
  const preview = override || null;
  const glyph = (size) => `${size} ${item.ownColours ? '' : 'text-white'}`.trim();
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <NavIconTile
          iconKey={item.key}
          Icon={item.Icon}
          override={preview}
          className="w-12 h-12 rounded-xl shadow-sm"
          bgClassName={item.bgClassName}
          style={item.style}
          iconClassName={glyph('w-6 h-6')}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{item.label}</p>
          {item.hint && <p className="truncate text-xs text-muted-foreground">{item.hint}</p>}
        </div>
        {/* The size it is in the menu itself */}
        <div className="flex shrink-0 flex-col items-center gap-1" title="How it looks in the menu">
          <NavIconTile
            iconKey={item.key}
            Icon={item.Icon}
            override={preview}
            className="w-7 h-7 rounded-lg shadow-sm"
            bgClassName={item.bgClassName}
            style={item.style}
            iconClassName={glyph('w-4 h-4')}
          />
          <span className="text-[10px] text-muted-foreground">In menu</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={kind === 'default' ? 'outline' : 'default'} className="rounded-full">{KIND_LABEL[kind]}</Badge>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving" />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onUpload(item)}>
          <ImagePlus className="mr-1.5 h-4 w-4" /> {kind === 'photo' ? 'Replace picture' : 'Upload picture'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChooseIcon(item)}>
          <Shapes className="mr-1.5 h-4 w-4" /> Choose icon
        </Button>
        {kind === 'photo' && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onToggleFit(item)}
            title={override.fit === 'contain'
              ? 'Crop the picture so it fills the whole tile'
              : 'Shrink the picture so all of it shows, on a white tile'}
          >
            {override.fit === 'contain'
              ? <><Maximize2 className="mr-1.5 h-4 w-4" /> Fill the tile</>
              : <><Minimize2 className="mr-1.5 h-4 w-4" /> Show whole picture</>}
          </Button>
        )}
        {kind !== 'default' && (
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onReset(item)}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Use original
          </Button>
        )}
      </div>
    </li>
  );
};

const IconPickerDialog = ({ item, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  useEffect(() => { setQuery(''); }, [item?.key]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q
      ? NAV_ICON_LIBRARY.filter((entry) => `${entry.label} ${entry.group}`.toLowerCase().includes(q))
      : NAV_ICON_LIBRARY;
    const byGroup = new Map();
    for (const entry of matching) {
      if (!byGroup.has(entry.group)) byGroup.set(entry.group, []);
      byGroup.get(entry.group).push(entry);
    }
    return [...byGroup.entries()];
  }, [query]);

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose an icon{item ? ` for ${item.label}` : ''}</DialogTitle>
          <DialogDescription>
            Pick one and it is saved straight away. To use your own picture instead, close this and choose Upload picture.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search icons…" className="pl-9" aria-label="Search icons" />
        </div>
        {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No icons match “{query}”.</p>}
        {groups.map(([groupName, entries]) => (
          <section key={groupName}>
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{groupName}</h3>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
              {entries.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => onPick(item, entry.name)}
                  title={entry.label}
                  aria-label={entry.label}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-xl p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-sm ${item?.bgClassName || 'bg-brand-charcoal'}`}
                    style={item?.style}
                  >
                    <entry.Icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground" aria-hidden="true">{entry.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
};

const MenuIconsAdminPage = () => {
  const { groups: shopGroups } = useShopCategoryGroups();
  const { patchSettings } = usePlatformSettings();
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [pickerItem, setPickerItem] = useState(null);
  const [query, setQuery] = useState('');
  const fileInput = useRef(null);
  const uploadTarget = useRef(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', NAV_MENU_ICONS_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadError(error.message || 'Could not load the menu icons.');
        else setOverrides(cleanNavMenuIcons(data?.value));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const sections = useMemo(() => buildMenuIconSections(shopGroups), [shopGroups]);
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const changedCount = allItems.filter((item) => overrides[item.key]).length;

  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: `${section.menu} ${section.title}`.toLowerCase().includes(q)
          ? section.items
          : section.items.filter((item) => `${item.label} ${item.hint || ''}`.toLowerCase().includes(q)),
      }))
      .filter((section) => section.items.length);
  }, [sections, query]);

  /** Save one item's override (null = back to the original icon). */
  const persist = async (item, override, successMessage) => {
    setBusyKey(item.key);
    try {
      // Re-read right before writing so only this item changes, whatever
      // another admin (or another tab) saved since this page loaded.
      const { data: existing, error: readError } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', NAV_MENU_ICONS_KEY)
        .maybeSingle();
      if (readError) throw readError;
      const next = withNavIconOverride(existing?.value, item.key, override);
      const write = existing
        ? supabase.from('platform_settings').update({ value: next }).eq('key', NAV_MENU_ICONS_KEY)
        // label is NOT NULL with no default, so the first save carries one.
        : supabase.from('platform_settings').upsert(
          { key: NAV_MENU_ICONS_KEY, value: next, label: 'Menu icons', group_name: 'navigation' },
          { onConflict: 'key' },
        );
      const { data: written, error: writeError } = await write.select('key');
      if (writeError) throw writeError;
      // RLS turns a refused write into "0 rows", not an error.
      if (!written?.length) throw new Error('The change was not saved — your admin session may have expired.');
      setOverrides(next);
      // Show it in this tab's header now; visitors get it once the settings cache turns over.
      patchSettings({ [NAV_MENU_ICONS_KEY]: next });
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(err?.message || 'The change could not be saved.');
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const startUpload = (item) => {
    uploadTarget.current = item;
    fileInput.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    const item = uploadTarget.current;
    // Clear the input so choosing the same file again still fires onChange.
    e.target.value = '';
    if (!file || !item) return;
    const problem = navIconFileError(file);
    if (problem) { toast.error(problem); return; }
    setBusyKey(item.key);
    let url;
    try {
      url = await uploadNavIcon(file, item.key);
    } catch (err) {
      setBusyKey(null);
      toast.error(uploadFailureMessage(err));
      return;
    }
    // Keep the fit the admin already chose for this item when replacing a picture.
    await persist(item, { image: url, fit: overrides[item.key]?.fit || 'cover' }, `${item.label} now shows your picture.`);
  };

  const pickIcon = async (item, iconName) => {
    setPickerItem(null);
    await persist(item, { icon: iconName }, `${item.label} icon changed.`);
  };

  const toggleFit = (item) => {
    const current = overrides[item.key];
    if (!current?.image) return;
    const fit = current.fit === 'contain' ? 'cover' : 'contain';
    persist(item, { image: current.image, fit }, fit === 'contain' ? 'Showing the whole picture.' : 'Picture now fills the tile.');
  };

  const reset = (item) => persist(item, null, `${item.label} is back to its original icon.`);

  return (
    <div className="space-y-6">
      <Helmet><title>Menu Icons · Admin · CardPop</title></Helmet>
      <AdminPageHeader
        icon={Shapes}
        title="Menu Icons"
        subtitle="The icon beside each item in the header’s dropdown menus — Buy Cards, Supplies, Prices, Community, Grading and More. Upload a picture, pick another icon, or go back to the original."
      />

      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>
          Each change saves on its own and shows in your header straight away; visitors see it within a couple of minutes.
          Pictures are shrunk to a small square-ish tile, so a simple, bold image — a logo or a close-up — reads best.
          JPG, PNG or WebP.
        </p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={NAV_ICON_ACCEPT}
        className="hidden"
        onChange={handleFile}
        data-testid="nav-icon-file-input"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search menu items…" className="pl-9" aria-label="Search menu items" />
        </div>
        <p className="text-sm text-muted-foreground">
          {allItems.length} items · {changedCount} changed
        </p>
      </div>

      {loadError && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load the saved icons ({loadError}). Reload the page before making changes.
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : !loadError && (
        <>
          {visibleSections.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No menu items match “{query}”.</p>
          )}
          {visibleSections.map((section) => (
            <section key={section.id} aria-labelledby={`menu-icons-${section.id}`}>
              <h2 id={`menu-icons-${section.id}`} className="mb-3 flex items-baseline gap-2 text-lg font-extrabold text-foreground">
                {section.title}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.menu} menu</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.items.map((item) => (
                  <ItemCard
                    key={item.key}
                    item={item}
                    override={overrides[item.key]}
                    busy={busyKey === item.key}
                    disabled={busyKey !== null}
                    onUpload={startUpload}
                    onChooseIcon={setPickerItem}
                    onToggleFit={toggleFit}
                    onReset={reset}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <IconPickerDialog item={pickerItem} onPick={pickIcon} onClose={() => setPickerItem(null)} />
    </div>
  );
};

export default MenuIconsAdminPage;
