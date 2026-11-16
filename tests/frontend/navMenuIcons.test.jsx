import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Admin → Menu Icons: the icon beside a header dropdown item can be replaced
// with an uploaded picture or another built-in icon. Covers the normaliser
// both the API and the browser use, the shared tile, and the admin page's
// one-item-at-a-time save.

const db = vi.hoisted(() => ({ row: null, writes: [], settings: {}, patched: [] }));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = () => {
    const ctx = { write: null };
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      order: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve({ data: db.row, error: null })),
      update: vi.fn((payload) => { ctx.write = { kind: 'update', payload }; return b; }),
      upsert: vi.fn((payload) => { ctx.write = { kind: 'upsert', payload }; return b; }),
      then: (resolve, reject) => {
        if (ctx.write) {
          db.writes.push(ctx.write);
          db.row = { value: ctx.write.payload.value };
          return Promise.resolve({ data: [{ key: 'nav_menu_icons' }], error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return b;
  };
  return {
    supabase: {
      from: vi.fn(() => builder()),
      storage: { from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://storage.test/${p}` } }) }) },
    },
  };
});
vi.mock('@/contexts/PlatformSettingsContext.jsx', () => ({
  usePlatformSettings: () => ({ settings: db.settings, patchSettings: (partial) => db.patched.push(partial) }),
}));
vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/utils/uploadNavIcon.js', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadNavIcon: vi.fn(() => Promise.resolve('https://storage.test/media/nav-icons/123-abc-collection-pokemon.webp')),
}));

import { toast } from 'sonner';
import { Star } from 'lucide-react';
import NavIconTile from '@/components/NavIconTile.jsx';
import MenuIconsAdminPage, { buildMenuIconSections } from '@/pages/admin/MenuIconsAdminPage.jsx';
import { SHOP_CATEGORY_GROUPS } from '@/utils/shopCategories.js';
import { NAV_ICON_LIBRARY, NAV_ICON_BY_NAME } from '@/lib/navIconLibrary.js';
import { uploadNavIcon, navIconFileError } from '@/utils/uploadNavIcon.js';
import {
  cleanNavMenuIcons, cleanNavIconOverride, navIconKey, navIconKind, safeNavIconImage, withNavIconOverride,
} from '@/utils/navMenuIcons.js';

beforeEach(() => {
  vi.clearAllMocks();
  db.row = null;
  db.writes = [];
  db.settings = {};
  db.patched = [];
});

describe('utils/navMenuIcons', () => {
  it('accepts only https picture URLs', () => {
    expect(safeNavIconImage('https://x.test/a.webp')).toBe('https://x.test/a.webp');
    for (const bad of ['http://x.test/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '/a.png', 'https://x.test/a b.png', 'https://x.test/"onerror=', '', null, 42]) {
      expect(safeNavIconImage(bad)).toBeNull();
    }
  });

  it('normalises one override to a picture, a library icon or nothing', () => {
    expect(cleanNavIconOverride({ image: 'https://x.test/a.webp' })).toEqual({ image: 'https://x.test/a.webp', fit: 'cover' });
    expect(cleanNavIconOverride({ image: 'https://x.test/a.webp', fit: 'contain', icon: 'Star' })).toEqual({ image: 'https://x.test/a.webp', fit: 'contain' });
    expect(cleanNavIconOverride({ icon: 'Star', extra: true })).toEqual({ icon: 'Star' });
    expect(cleanNavIconOverride({ icon: '<script>' })).toBeNull();
    expect(cleanNavIconOverride({ image: 'http://x.test/a.png' })).toBeNull();
    expect(cleanNavIconOverride(['Star'])).toBeNull();
    expect(cleanNavIconOverride('Star')).toBeNull();
  });

  it('cleans the stored map, whatever shape it arrives in', () => {
    const stored = {
      'collection:pokemon': { image: 'https://x.test/p.webp' },
      'link:/grading/estimator': { icon: 'Calculator' },
      'Bad Key!': { icon: 'Star' },
      'link:/about': { image: 'javascript:alert(1)' },
    };
    const clean = {
      'collection:pokemon': { image: 'https://x.test/p.webp', fit: 'cover' },
      'link:/grading/estimator': { icon: 'Calculator' },
    };
    expect(cleanNavMenuIcons(stored)).toEqual(clean);
    expect(cleanNavMenuIcons(JSON.stringify(stored))).toEqual(clean);
    for (const junk of [null, undefined, 'nope', 7, [], [stored]]) expect(cleanNavMenuIcons(junk)).toEqual({});
  });

  it('sets and removes one item without touching the others', () => {
    const start = { 'collection:nba': { icon: 'Trophy' } };
    const added = withNavIconOverride(start, 'collection:pokemon', { image: 'https://x.test/p.webp', fit: 'contain' });
    expect(added).toEqual({ 'collection:nba': { icon: 'Trophy' }, 'collection:pokemon': { image: 'https://x.test/p.webp', fit: 'contain' } });
    expect(start).toEqual({ 'collection:nba': { icon: 'Trophy' } });
    expect(withNavIconOverride(added, 'collection:nba', null)).toEqual({ 'collection:pokemon': { image: 'https://x.test/p.webp', fit: 'contain' } });
    // An unusable override is the same as removing it.
    expect(withNavIconOverride(added, 'collection:pokemon', { image: 'http://x.test/p.png' })).toEqual({ 'collection:nba': { icon: 'Trophy' } });
  });

  it('names what an item is showing', () => {
    expect(navIconKind({ image: 'https://x.test/a.webp' })).toBe('photo');
    expect(navIconKind({ icon: 'Star' })).toBe('icon');
    expect(navIconKind(undefined)).toBe('default');
  });
});

describe('lib/navIconLibrary', () => {
  it('offers uniquely named icons whose names pass the normaliser', () => {
    const names = NAV_ICON_LIBRARY.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of NAV_ICON_LIBRARY) {
      expect(cleanNavIconOverride({ icon: entry.name })).toEqual({ icon: entry.name });
      expect(entry.Icon).toBeTruthy();
      expect(entry.label).toBeTruthy();
    }
  });
});

describe('NavIconTile', () => {
  const tile = (props = {}) => render(
    <NavIconTile iconKey="link:/about" Icon={Star} className="w-7 h-7 rounded-lg" bgClassName="bg-gradient-to-br from-a to-b" {...props} />,
  ).container.firstChild;

  it('shows the built-in icon on its gradient when nothing is overridden', () => {
    const el = tile();
    expect(el.className).toContain('from-a');
    expect(el.querySelector('svg')).toBeTruthy();
    expect(el.querySelector('img')).toBeNull();
  });

  it('fills the tile with the uploaded picture, without the gradient', () => {
    db.settings = { nav_menu_icons: { 'link:/about': { image: 'https://storage.test/media/nav-icons/a.webp', fit: 'cover' } } };
    const el = tile();
    const img = el.querySelector('img');
    expect(img.getAttribute('src')).toBe('https://storage.test/media/nav-icons/a.webp');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.className).toContain('object-cover');
    expect(el.className).not.toContain('from-a');
    expect(el.className).toContain('w-7');
  });

  it('shows the whole picture on a white tile when the fit is "contain"', () => {
    db.settings = { nav_menu_icons: { 'link:/about': { image: 'https://storage.test/a.webp', fit: 'contain' } } };
    const el = tile();
    expect(el.className).toContain('bg-white');
    expect(el.querySelector('img').className).toContain('object-contain');
  });

  it('falls back to the built-in icon when the picture fails to load', () => {
    db.settings = { nav_menu_icons: { 'link:/about': { image: 'https://storage.test/gone.webp' } } };
    const { container } = render(<NavIconTile iconKey="link:/about" Icon={Star} bgClassName="from-a" />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.firstChild.className).toContain('from-a');
  });

  it('swaps in a library icon once the library chunk has loaded', async () => {
    db.settings = { nav_menu_icons: { 'link:/about': { icon: 'Trophy' } } };
    const { container } = render(<NavIconTile iconKey="link:/about" Icon={Star} />);
    await waitFor(() => expect(container.querySelector('svg').getAttribute('class')).toContain('lucide-trophy'));
    // Still on the item's own tile, and forced white.
    expect(container.querySelector('svg').getAttribute('class')).toContain('text-white');
  });

  it('keeps the built-in icon for a library name that does not exist', async () => {
    db.settings = { nav_menu_icons: { 'link:/about': { icon: 'NoSuchIcon' } } };
    const { container } = render(<NavIconTile iconKey="link:/about" Icon={Star} />);
    await waitFor(() => expect(NAV_ICON_BY_NAME.Trophy).toBeTruthy());
    expect(container.querySelector('svg').getAttribute('class')).toContain('lucide-star');
  });

  it('lets the admin preview override the saved one (null = original)', () => {
    db.settings = { nav_menu_icons: { 'link:/about': { image: 'https://storage.test/a.webp' } } };
    expect(tile({ override: null }).querySelector('img')).toBeNull();
    expect(tile({ override: { image: 'https://storage.test/b.webp', fit: 'cover' } }).querySelector('img').getAttribute('src')).toBe('https://storage.test/b.webp');
  });
});

describe('uploadNavIcon file check', () => {
  it('accepts JPG, PNG and WebP and explains anything else', () => {
    expect(navIconFileError(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
    expect(navIconFileError(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBeNull();
    expect(navIconFileError(new File(['x'], 'a.heic', { type: 'image/heic' }))).toMatch(/JPG, PNG or WebP/);
    expect(navIconFileError(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toMatch(/JPG, PNG or WebP/);
    expect(navIconFileError(null)).toBeTruthy();
  });
});

describe('buildMenuIconSections', () => {
  it('lists every dropdown item once, under a key the menus also use', () => {
    const sections = buildMenuIconSections(SHOP_CATEGORY_GROUPS);
    const items = sections.flatMap((s) => s.items);
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(navIconKey.collection('pokemon'));
    expect(keys).toContain(navIconKey.collection('afl'));
    expect(keys).toContain(navIconKey.shopGroup(SHOP_CATEGORY_GROUPS[0].slug));
    expect(keys).toContain(navIconKey.shopCategory(SHOP_CATEGORY_GROUPS[0].items[0].slug));
    for (const href of ['/scan', '/community/forum', '/events/card-shows', '/blog', '/grading/estimator', '/card-shops']) {
      expect(keys).toContain(navIconKey.link(href));
    }
    // Every key survives the normaliser, or its override would be dropped on save.
    for (const key of keys) expect(withNavIconOverride({}, key, { icon: 'Star' })).toHaveProperty(key);
    for (const item of items) { expect(item.label).toBeTruthy(); expect(item.Icon).toBeTruthy(); }
    expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
  });
});

describe('MenuIconsAdminPage', () => {
  const renderPage = async () => {
    render(<MemoryRouter><MenuIconsAdminPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: /Trading Card Games/ });
  };
  const card = (label) => screen.getAllByText(label).map((el) => el.closest('li')).find(Boolean);

  it('uploads a picture for one item and saves it beside the existing overrides', async () => {
    db.row = { value: { 'collection:nba': { icon: 'Trophy' } } };
    await renderPage();
    const user = userEvent.setup();
    await user.click(within(card('Pokémon')).getByRole('button', { name: /Upload picture/ }));
    const file = new File(['img'], 'pikachu.png', { type: 'image/png' });
    await user.upload(screen.getByTestId('nav-icon-file-input'), file);

    await waitFor(() => expect(db.writes).toHaveLength(1));
    expect(uploadNavIcon).toHaveBeenCalledWith(file, 'collection:pokemon');
    const saved = {
      'collection:nba': { icon: 'Trophy' },
      'collection:pokemon': { image: 'https://storage.test/media/nav-icons/123-abc-collection-pokemon.webp', fit: 'cover' },
    };
    expect(db.writes[0]).toEqual({ kind: 'update', payload: { value: saved } });
    // The header in this tab updates without waiting for the settings cache.
    expect(db.patched).toEqual([{ nav_menu_icons: saved }]);
    await waitFor(() => expect(within(card('Pokémon')).getByText('Your picture')).toBeInTheDocument());
    expect(card('Pokémon').querySelector('img').getAttribute('src')).toContain('collection-pokemon.webp');
  });

  it('creates the settings row (with its label) on the very first change', async () => {
    await renderPage();
    const user = userEvent.setup();
    await user.click(within(card('Pokémon')).getByRole('button', { name: /Choose icon/ }));
    await user.click(await screen.findByRole('button', { name: 'Trophy' }));

    await waitFor(() => expect(db.writes).toHaveLength(1));
    expect(db.writes[0].kind).toBe('upsert');
    expect(db.writes[0].payload).toMatchObject({
      key: 'nav_menu_icons',
      label: 'Menu icons',
      value: { 'collection:pokemon': { icon: 'Trophy' } },
    });
    await waitFor(() => expect(within(card('Pokémon')).getByText('Changed icon')).toBeInTheDocument());
  });

  it('refuses a file that is not a picture without uploading or saving', async () => {
    await renderPage();
    const input = screen.getByTestId('nav-icon-file-input');
    fireEvent.click(within(card('Pokémon')).getByRole('button', { name: /Upload picture/ }));
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(uploadNavIcon).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
  });

  it('toggles how a picture fits and puts the original icon back', async () => {
    db.row = { value: { 'collection:pokemon': { image: 'https://storage.test/p.webp', fit: 'cover' } } };
    await renderPage();
    const user = userEvent.setup();
    await waitFor(() => expect(within(card('Pokémon')).getByText('Your picture')).toBeInTheDocument());

    await user.click(within(card('Pokémon')).getByRole('button', { name: /Show whole picture/ }));
    await waitFor(() => expect(db.writes).toHaveLength(1));
    expect(db.writes[0].payload.value['collection:pokemon']).toEqual({ image: 'https://storage.test/p.webp', fit: 'contain' });

    await user.click(await within(card('Pokémon')).findByRole('button', { name: /Use original/ }));
    await waitFor(() => expect(db.writes).toHaveLength(2));
    expect(db.writes[1].payload.value).toEqual({});
    await waitFor(() => expect(within(card('Pokémon')).getByText('Original')).toBeInTheDocument());
  });
});
