import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import AdminDirectory from '@/components/admin/AdminDirectory.jsx';
import { findAdminLocation } from '@/components/admin/adminSections.js';

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

// The bar above every admin page except the dashboard (which shows the whole
// directory itself): a button that opens the same grouped, searchable list in
// a drawer, and where this page sits in it.
const AdminMenuBar = ({ pathname }) => {
  const [open, setOpen] = useState(false);
  const location = findAdminLocation(pathname);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="rounded-xl h-10 font-semibold">
            <Menu className="w-4 h-4 mr-2" /> Admin menu
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[92vw] sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="font-serif text-xl">Admin menu</SheetTitle>
            <SheetDescription>Search, or pick an area to go straight there.</SheetDescription>
          </SheetHeader>
          <AdminDirectory compact currentLink={location?.item.link} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link to="/admin" className="font-medium hover:text-primary">Dashboard</Link>
          </li>
          {location && (
            <>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              <li>
                <Link to={`/admin#admin-${location.section.id}`} className="hover:text-primary">{location.section.title}</Link>
              </li>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              <li>
                <Link to={location.item.link} aria-current="page" className="font-semibold text-foreground hover:text-primary">
                  {location.item.title}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>
    </div>
  );
};

const AdminLayout = () => {
  const { pathname } = useLocation();
  const onDashboard = pathname.replace(/\/+$/, '') === '/admin';
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
      {!onDashboard && <AdminMenuBar pathname={pathname} />}
      <Outlet />
    </div>
  );
};

export default AdminLayout;
