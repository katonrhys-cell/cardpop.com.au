import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EventFormModal from '@/components/EventFormModal.jsx';
import ShopProductForm from '@/components/ShopProductForm.jsx';

// The admin's editor, opened on the public page itself: the same event form
// and shop product form the admin screens use (Admin → Events / Products),
// loaded with the full row by id. Admin only — AdminEditButton renders it for
// admins, and the rows and writes are admin-only under RLS regardless.
//
// `edit` is `{ kind: 'event' | 'shopProduct', id }` (utils/adminEditLinks.js →
// inPlaceEditFor). After a save the page is reloaded: public pages build what
// they show from several sources (views, static catalogue data, the edge
// cache), and a reload is the one refresh that is right for all of them.

const TABLES = { event: 'events', shopProduct: 'shop_products' };
const NOUNS = { event: 'event', shopProduct: 'product' };

const reloadPage = () => { window.location.reload(); };

const AdminInPlaceEditor = ({ edit, onClose, onSaved = reloadPage }) => {
  const [row, setRow] = useState(null);
  // The event form reports a save while it is still open too (applying a
  // website scan), so the refresh waits until the form closes.
  const savedRef = useRef(false);
  const closeEvent = () => {
    onClose();
    if (savedRef.current) onSaved();
  };

  useEffect(() => {
    let cancelled = false;
    setRow(null);
    (async () => {
      const { data, error } = await supabase.from(TABLES[edit.kind]).select('*').eq('id', edit.id).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error(`Could not load that ${NOUNS[edit.kind]} to edit.`);
        onClose();
        return;
      }
      setRow(data);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per item
  }, [edit.kind, edit.id]);

  if (!row) return null;

  if (edit.kind === 'event') {
    return <EventFormModal isOpen onClose={closeEvent} event={row} onSaved={() => { savedRef.current = true; }} />;
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl border-border p-0">
        <div className="p-8">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-2xl font-bold font-serif text-foreground">Edit Shop Product</DialogTitle>
          </DialogHeader>
          <ShopProductForm product={row} onSuccess={() => { onClose(); onSaved(); }} onCancel={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminInPlaceEditor;
