import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// Fallback tab title for admin pages, derived from the URL section
// ("/admin/store-directory" → "Store Directory"). Pages that set their own
// <Helmet> title mount deeper in the tree, so theirs wins over this one.
const sectionLabel = (pathname) => {
  const section = pathname.split('/')[2] || '';
  if (!section) return 'Dashboard';
  return section
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const AdminLayout = () => {
  const { pathname } = useLocation();
  // Single shared width container for every admin page, matching the dashboard,
  // so pages render at a consistent "normal" page width instead of edge-to-edge.
  return (
    <div className="container mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-8">
      <Helmet>
        <title>{`${sectionLabel(pathname)} — Admin | CardPop`}</title>
        {/* Belt-and-braces: /admin is behind auth and disallowed in robots.txt,
            but a noindex keeps any stray render out of search results. */}
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Outlet />
    </div>
  );
};

export default AdminLayout;
