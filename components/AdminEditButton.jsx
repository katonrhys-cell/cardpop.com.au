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

  const pill = 'inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg shadow-black/20 transition-[transform,background-color] duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:scale-100';

  return (
    <div
      className="fixed right-4 z-40 flex flex-col items-end gap-2 sm:right-6 print:hidden"
      // Sits one WhatsApp button (3.5rem) plus a gap above the bottom corner.
      style={{ bottom: `calc(5.25rem + env(safe-area-inset-bottom, 0px) + var(${BOTTOM_BAR_INSET_VAR}, 0px))` }}
    >
      {(target.also || []).map((extra) => (
        <Link
          key={extra.to}
          to={extra.to}
          data-testid="admin-edit-extra"
          className={`${pill} border border-white/20 bg-brand-charcoal/90 text-white hover:bg-black`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {extra.label}
        </Link>
      ))}
      <Link
        to={target.to}
        data-testid="admin-edit-button"
        className={`${pill} bg-brand-charcoal text-white hover:bg-black`}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        {target.label}
      </Link>
    </div>
  );
};

export default AdminEditButton;
