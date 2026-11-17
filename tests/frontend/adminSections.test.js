import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { ADMIN_SECTIONS, filterAdminSections, findAdminLocation } from '@/components/admin/adminSections.js';

const appSource = readFileSync(resolve(process.cwd(), 'App.jsx'), 'utf8');
const adminBlock = appSource.slice(
  appSource.indexOf('<Route path="/admin"'),
  appSource.indexOf('CATCH-ALL 404 ROUTE'),
);
const routedPaths = [...adminBlock.matchAll(/<Route path="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => p !== '/admin');

// Routes that are a detail/editor page or an alias of a listed screen.
const NOT_LISTED = new Set(['events-calendar', 'analytics-reports', 'event-reviews/new']);

const items = ADMIN_SECTIONS.flatMap((s) => s.items);

describe('admin directory', () => {
  it('points every entry at a real admin route', () => {
    for (const item of items) {
      expect(routedPaths, item.title).toContain(item.link.replace('/admin/', ''));
    }
  });

  it('lists every admin screen that has a route', () => {
    const listed = new Set(items.map((i) => i.link.replace('/admin/', '')));
    const missing = routedPaths.filter((p) => !p.includes(':') && !NOT_LISTED.has(p) && !listed.has(p));
    expect(missing).toEqual([]);
  });

  it('lists each screen once, with a title, description and icon', () => {
    const links = items.map((i) => i.link);
    expect(new Set(links).size).toBe(links.length);
    for (const item of items) {
      expect(item.title && item.description && item.icon, item.link).toBeTruthy();
    }
  });

  it('finds a screen by name, by keyword and by group', () => {
    const links = (q) => filterAdminSections(q).flatMap((s) => s.items.map((i) => i.link));
    expect(links('coupon')).toEqual(['/admin/promo-codes']);
    expect(links('xero')).toEqual(['/admin/invoices']);
    expect(links('card shops')).toContain('/admin/store-directory');
    expect(links('events').length).toBeGreaterThanOrEqual(5);
    expect(links('zzzz')).toEqual([]);
    expect(filterAdminSections('  ')).toBe(ADMIN_SECTIONS);
  });

  it('places an admin URL in its group, including detail pages', () => {
    expect(findAdminLocation('/admin')).toBeNull();
    expect(findAdminLocation('/admin/orders').item.title).toBe('Orders');
    expect(findAdminLocation('/admin/orders').section.id).toBe('orders');
    expect(findAdminLocation('/admin/event-reviews/abc').item.link).toBe('/admin/event-reviews');
    expect(findAdminLocation('/admin/events/').item.link).toBe('/admin/events');
    expect(findAdminLocation('/admin/users/42').item.link).toBe('/admin/users');
  });
});
