import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import AdminLayout from '@/components/AdminLayout.jsx';

const renderAt = (path) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<p>dashboard page</p>} />
            <Route path="orders" element={<p>orders page</p>} />
            <Route path="promo-codes" element={<p>promo codes page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('admin menu on every admin page', () => {
  it('shows the menu button and where the page sits', () => {
    renderAt('/admin/orders');
    expect(screen.getByRole('button', { name: /admin menu/i })).toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Dashboard').getAttribute('href')).toBe('/admin');
    expect(within(crumbs).getByText('Orders & Money')).toBeTruthy();
    expect(within(crumbs).getByText('Orders').getAttribute('aria-current')).toBe('page');
  });

  it('leaves the bar off the dashboard, which is the directory itself', () => {
    renderAt('/admin');
    expect(screen.queryByRole('button', { name: /admin menu/i })).toBeNull();
  });

  it('opens the directory, marks the current page, and goes to the picked area', () => {
    renderAt('/admin/orders');
    fireEvent.click(screen.getByRole('button', { name: /admin menu/i }));
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByRole('link', { name: /^Orders/ }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(within(drawer).getByRole('link', { name: /Promo Codes/ }));
    expect(screen.getByText('promo codes page')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('searches inside the drawer and opens the first match on Enter', () => {
    renderAt('/admin/orders');
    fireEvent.click(screen.getByRole('button', { name: /admin menu/i }));
    const drawer = screen.getByRole('dialog');
    const box = within(drawer).getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'coupon' } });
    expect(within(drawer).getAllByRole('link')).toHaveLength(1);
    fireEvent.submit(box.closest('form'));
    expect(screen.getByText('promo codes page')).toBeTruthy();
  });
});
