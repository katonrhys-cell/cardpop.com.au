import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink, Loader2, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCurrentAdminEditTarget } from '@/lib/adminEditTarget.js';
import { BOTTOM_BAR_INSET_VAR } from '@/lib/bottomBarInset.js';
import { inPlaceEditFor } from '@/utils/adminEditLinks.js';

// The editor is the admin's event / product form — far too heavy for every
// visitor's bundle, so it loads only when an admin presses the button.
const AdminInPlaceEditor = lazy(() => import('@/components/admin/AdminInPlaceEditor.jsx'));

/**
 * The admin's edit pill — floating, bottom-right above the WhatsApp button,
 * shown only to admins on a page that registered something editable with
 * `useAdminEditTarget`.
 *
 * An event or a shop product is edited **in place**: the pill opens the same
 * form the admin panel uses, right on the page, and "Open in admin" stays as a
 * link to the admin screen. Anything else links straight to its editor in the
 * admin panel. `isAdmin` is `profiles.is_admin`; the admin routes and the
 * database policies check it again, so this only ever saves a click and grants
 * nothing.
 */
const AdminEditButton = () => {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const target = useCurrentAdminEditTarget();
  const [editing, setEditing] = useState(false);
  const edit = inPlaceEditFor(target?.to);
  const editKey = edit ? `${edit.kind}:${edit.id}` : '';

  // Moving to another item (or page) closes an editor left open for the last one.
  useEffect(() => { setEditing(false); }, [editKey, pathname]);

  if (!isAdmin || !target || pathname.startsWith('/admin')) return null;

  const pill = 'inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg shadow-black/20 transition-[transform,background-color] duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:scale-100';
  const secondary = `${pill} border border-white/20 bg-brand-charcoal/90 text-white hover:bg-black`;
  const primary = `${pill} bg-brand-charcoal text-white hover:bg-black`;

  return (
    <>
      <div
        className="fixed right-4 z-40 flex flex-col items-end gap-2 sm:right-6 print:hidden"
        // Sits one WhatsApp button (3.5rem) plus a gap above the bottom corner.
        style={{ bottom: `calc(5.25rem + env(safe-area-inset-bottom, 0px) + var(${BOTTOM_BAR_INSET_VAR}, 0px))` }}
      >
        {(target.also || []).map((extra) => (
          <Link key={extra.to} to={extra.to} data-testid="admin-edit-extra" className={secondary}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {extra.label}
          </Link>
        ))}
        {edit ? (
          <>
            <Link to={target.to} data-testid="admin-edit-open-admin" className={secondary}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in admin
            </Link>
            <button type="button" onClick={() => setEditing(true)} data-testid="admin-edit-button" className={primary}>
              {editing
                ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                : <Pencil className="h-4 w-4" aria-hidden="true" />}
              {target.label}
            </button>
          </>
        ) : (
          <Link to={target.to} data-testid="admin-edit-button" className={primary}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {target.label}
          </Link>
        )}
      </div>
      {edit && editing && (
        <Suspense fallback={null}>
          <AdminInPlaceEditor key={editKey} edit={edit} onClose={() => setEditing(false)} />
        </Suspense>
      )}
    </>
  );
};

export default AdminEditButton;
