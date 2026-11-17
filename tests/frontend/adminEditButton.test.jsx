import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ value: { isAdmin: true } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth.value }));

import AdminEditButton from '@/components/AdminEditButton.jsx';
import { setAdminEditTarget, useAdminEditTarget } from '@/lib/adminEditTarget.js';
import {
  adminShopProductPath, adminEventPath, adminListingPath, adminStorePath,
  adminArticlePath, adminEventReviewPath, adminPlayerPath,
  adminProductsPath, adminShopCategoriesPath,
  adminUserPath, adminGiveawayPath, ADMIN_LISTS,
} from '@/utils/adminEditLinks.js';

// A stand-in for a public page that registers what it shows.
const FakePage = ({ label, to, also }) => {
  useAdminEditTarget(label, to, also);
  return <p>page</p>;
};

const renderAt = (path, page) => render(
  <MemoryRouter initialEntries={[path]}>
    {page}
    <AdminEditButton />
  </MemoryRouter>,
);

afterEach(() => {
  cleanup();
  act(() => setAdminEditTarget(null));
  auth.value = { isAdmin: true };
});

describe('adminEditLinks', () => {
  it('builds the admin deep links the admin screens read', () => {
    expect(adminShopProductPath('abc')).toBe('/admin/products?edit=abc');
    expect(adminEventPath('e1')).toBe('/admin/events?edit=e1');
    expect(adminListingPath('l1')).toBe('/admin/all-listings?listing=l1');
    expect(adminStorePath('the shop')).toBe('/admin/store-directory?edit=the%20shop');
    expect(adminArticlePath('a1')).toBe('/admin/content?edit=a1');
    expect(adminEventReviewPath('r1')).toBe('/admin/event-reviews/r1');
    expect(adminPlayerPath('p1')).toBe('/admin/players?edit=p1');
    expect(adminProductsPath()).toBe('/admin/products');
    expect(adminProductsPath({ category: 'Top Loaders' })).toBe('/admin/products?category=Top+Loaders&view=list');
    expect(adminProductsPath({ section: 'Protection' })).toBe('/admin/products?section=Protection&view=list');
    expect(adminShopCategoriesPath()).toBe('/admin/products?categories=1');
    expect(adminUserPath('u1')).toBe('/admin/users/u1');
    expect(adminGiveawayPath('g1')).toBe('/admin/giveaways?edit=g1');
    expect(ADMIN_LISTS).toEqual({
      whatnotShows: '/admin/whatnot-shows',
      storeDirectory: '/admin/store-directory',
      partners: '/admin/partners',
      collections: '/admin/collections',
    });
  });

  it('returns null without an id so nothing is registered', () => {
    expect(adminShopProductPath(undefined)).toBeNull();
    expect(adminEventPath(null)).toBeNull();
    expect(adminListingPath('')).toBeNull();
    expect(adminArticlePath(undefined)).toBeNull();
    expect(adminEventReviewPath(null)).toBeNull();
    expect(adminPlayerPath('')).toBeNull();
    expect(adminUserPath(undefined)).toBeNull();
    expect(adminGiveawayPath(null)).toBeNull();
  });
});

describe('AdminEditButton', () => {
  it('links an admin to the editor of the item on the page', () => {
    renderAt('/events/some-show', <FakePage label="Edit event" to="/admin/events?edit=e1" />);
    const link = screen.getByRole('link', { name: 'Edit event' });
    expect(link).toHaveAttribute('href', '/admin/events?edit=e1');
  });

  it('is never shown to a non-admin', () => {
    auth.value = { isAdmin: false };
    renderAt('/events/some-show', <FakePage label="Edit event" to="/admin/events?edit=e1" />);
    expect(screen.queryByTestId('admin-edit-button')).toBeNull();
  });

  it('is absent when the page has nothing editable (still loading / not found)', () => {
    renderAt('/events/some-show', <FakePage label="Edit event" to={null} />);
    expect(screen.queryByTestId('admin-edit-button')).toBeNull();
  });

  it('goes away when the page unmounts', () => {
    const { rerender } = renderAt('/shop/binders/x', <FakePage label="Edit product" to="/admin/products?edit=p1" />);
    expect(screen.getByTestId('admin-edit-button')).toBeInTheDocument();
    rerender(
      <MemoryRouter initialEntries={['/shop/binders/x']}>
        <AdminEditButton />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('admin-edit-button')).toBeNull();
  });

  it('follows the item when the page switches to another one', () => {
    const { rerender } = renderAt('/shop/binders/x', <FakePage label="Edit product" to="/admin/products?edit=p1" />);
    rerender(
      <MemoryRouter initialEntries={['/shop/binders/x']}>
        <FakePage label="Edit product" to="/admin/products?edit=p2" />
        <AdminEditButton />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-edit-button')).toHaveAttribute('href', '/admin/products?edit=p2');
  });

  it('stacks extra links above the main one', () => {
    renderAt('/shop/category/top-loaders', (
      <FakePage
        label="Edit products"
        to="/admin/products?category=Top+Loaders&view=list"
        also={[{ label: 'Edit categories', to: '/admin/products?categories=1' }]}
      />
    ));
    expect(screen.getByTestId('admin-edit-button')).toHaveTextContent('Edit products');
    const extra = screen.getByRole('link', { name: 'Edit categories' });
    expect(extra).toHaveAttribute('href', '/admin/products?categories=1');
  });

  it('stays out of the admin panel itself', () => {
    renderAt('/admin/products', <FakePage label="Edit product" to="/admin/products?edit=p1" />);
    expect(screen.queryByTestId('admin-edit-button')).toBeNull();
  });
});
