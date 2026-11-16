import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCurrentAdminEditTarget } from '@/lib/adminEditTarget.js';
import { BOTTOM_BAR_INSET_VAR } from '@/lib/bottomBarInset.js';

/**
 * "Edit in admin" — a floating pill, bottom-right above the WhatsApp button,
 * shown only to admins on a page that registered something editable with
 * `useAdminEditTarget`. It links straight to that item's editor in the admin
 * panel. `isAdmin` is `profiles.is_admin`; the admin routes check it again, so
 * this only ever saves a click and grants nothing.
 */
const AdminEditButton = () => {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const target = useCurrentAdminEditTarget();
  if (!isAdmin || !target || pathname.startsWith('/admin')) return null;

  return (
    <Link
      to={target.to}
      data-testid="admin-edit-button"
      className="fixed right-4 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-brand-charcoal px-4 text-sm font-semibold text-white shadow-lg shadow-black/20 transition-[bottom,transform,background-color] duration-200 hover:scale-105 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:scale-100 sm:right-6 print:hidden"
      // Sits one WhatsApp button (3.5rem) plus a gap above the bottom corner.
      style={{ bottom: `calc(5.25rem + env(safe-area-inset-bottom, 0px) + var(${BOTTOM_BAR_INSET_VAR}, 0px))` }}
    >
      <Pencil className="h-4 w-4" aria-hidden="true" />
      {target.label}
    </Link>
  );
};

export default AdminEditButton;
