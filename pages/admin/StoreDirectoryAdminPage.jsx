import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Check, ExternalLink, Pencil, Plus, Store, Video, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DIRECTORY_CITIES, STORE_CATEGORY_LABELS } from '@/lib/storeDirectory.js';
import StoreEditorDialog from '@/components/admin/StoreEditorDialog.jsx';
import StoreOwnerRequests from '@/components/admin/StoreOwnerRequests.jsx';
import { cleanStorePhotos, cleanStoreVideos, storePath } from '@/utils/storePage.js';

const StoreRow = ({ store, onAction, onEdit, onRemoveOwner }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{store.name}</h3>
          <Badge variant={store.status === 'approved' ? 'default' : store.status === 'pending' ? 'secondary' : 'destructive'}>
            {store.status}
          </Badge>
          {store.owner_id && (
            <>
              <Badge variant="outline">Owner-managed</Badge>
              {store.membership_featured && <Badge>Featured (Ultimate)</Badge>}
              <Link to={`/admin/users/${store.owner_id}`} className="text-xs text-primary hover:underline">Owner</Link>
              <button type="button" onClick={() => onRemoveOwner(store)} className="text-xs text-muted-foreground hover:text-destructive hover:underline">
                Remove owner
              </button>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {[store.suburb, DIRECTORY_CITIES[store.city]?.label || store.city, store.state]
            .filter(Boolean).join(', ')}
        </p>
        {store.description && <p className="text-sm mt-2">{store.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
          {store.website && (
            <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
              {store.website} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {store.submitter_email && (
            <span className="text-muted-foreground">Contact: {store.submitter_email}</span>
          )}
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" /> {cleanStorePhotos(store.photos).length}
            <Video className="w-3.5 h-3.5 ml-1.5" /> {cleanStoreVideos(store.videos).length}
          </span>
          {storePath(store) && (
            <Link to={storePath(store)} className="text-primary hover:underline">View page</Link>
          )}
        </div>
        {store.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {store.categories.map((cat) => (
              <span key={cat} className="text-xs px-2 py-0.5 rounded-full bg-background border border-border">
                {STORE_CATEGORY_LABELS[cat] || cat}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button size="sm" variant="outline" onClick={() => onEdit(store)}>
          <Pencil className="w-4 h-4 mr-1" /> Edit
        </Button>
        {store.status !== 'approved' && (
          <Button size="sm" onClick={() => onAction(store, 'approved')}>
            <Check className="w-4 h-4 mr-1" /> Approve
          </Button>
        )}
        {store.status !== 'rejected' && (
          <Button size="sm" variant="outline" onClick={() => onAction(store, 'rejected')}>
            <X className="w-4 h-4 mr-1" /> Reject
          </Button>
        )}
      </div>
    </div>
  </div>
);

const StoreDirectoryAdminPage = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // submitter_email is hidden from the anon client by column-level grants, so the
  // full list (with the submitter's contact) is read via the service-role admin
  // endpoint rather than a direct Supabase query.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/stores/admin');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { stores: data } = await res.json();
      setStores(data || []);
    } catch (error) {
      toast.error(`Failed to load stores: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The editor: `false` closed, `null` adding a store, a row when editing.
  const [editing, setEditing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const editSlug = searchParams.get('edit');

  // "Edit this page" on a shop's public page lands here as ?edit=<slug>.
  useEffect(() => {
    if (!editSlug || loading) return;
    const match = stores.find((s) => s.slug === editSlug);
    if (match) setEditing(match);
    setSearchParams({}, { replace: true });
  }, [editSlug, loading, stores, setSearchParams]);

  const onAction = async (store, status) => {
    const { error } = await supabase
      .from('local_game_stores')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', store.id);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
      return;
    }
    toast.success(`"${store.name}" ${status}`);
    setStores((prev) => prev.map((s) => (s.id === store.id ? { ...s, status } : s)));
  };

  const onRemoveOwner = async (store) => {
    if (!window.confirm(`Remove the owner of "${store.name}"? The page and its photos stay; they just can't edit it any more.`)) return;
    try {
      const res = await apiServerClient.fetch(`/store-owner-requests/admin/owner/${store.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      toast.success(`"${store.name}" no longer has an owner`);
      setStores((prev) => prev.map((s) => (s.id === store.id ? { ...s, owner_id: null } : s)));
    } catch (error) {
      toast.error(`Could not remove the owner: ${error.message}`);
    }
  };

  const pending = stores.filter((s) => s.status === 'pending');
  const rest = stores.filter((s) => s.status !== 'pending');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6" /> Store Directory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approve or reject public "/card-shops" listings, and edit each shop&apos;s own page —
            address, hours, photos and videos — and confirm members who apply to own a shop. Approved stores appear immediately.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus className="w-4 h-4 mr-1" /> Add store
        </Button>
      </div>

      <StoreEditorDialog
        open={editing !== false}
        store={editing || null}
        takenSlugs={stores.map((s) => s.slug)}
        onClose={() => setEditing(false)}
        onSaved={load}
      />

      <StoreOwnerRequests onChanged={load} />

      {loading && <p className="text-muted-foreground">Loading…</p>}

      {!loading && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Pending review ({pending.length})</h2>
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting — all clear.</p>}
            {pending.map((store) => <StoreRow key={store.id} store={store} onAction={onAction} onEdit={setEditing} onRemoveOwner={onRemoveOwner} />)}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">All listings ({rest.length})</h2>
            {rest.map((store) => <StoreRow key={store.id} store={store} onAction={onAction} onEdit={setEditing} onRemoveOwner={onRemoveOwner} />)}
          </section>
        </>
      )}
    </div>
  );
};

export default StoreDirectoryAdminPage;
