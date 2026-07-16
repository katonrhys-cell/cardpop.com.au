import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Store, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DIRECTORY_CITIES, STORE_CATEGORY_LABELS } from '@/lib/storeDirectory.js';

const StoreRow = ({ store, onAction }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{store.name}</h3>
          <Badge variant={store.status === 'approved' ? 'default' : store.status === 'pending' ? 'secondary' : 'destructive'}>
            {store.status}
          </Badge>
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

  const pending = stores.filter((s) => s.status === 'pending');
  const rest = stores.filter((s) => s.status !== 'pending');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="w-6 h-6" /> Store Directory
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Approve or reject public "/card-shops" listings. Approved stores appear immediately.
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Loading…</p>}

      {!loading && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Pending review ({pending.length})</h2>
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting — all clear.</p>}
            {pending.map((store) => <StoreRow key={store.id} store={store} onAction={onAction} />)}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">All listings ({rest.length})</h2>
            {rest.map((store) => <StoreRow key={store.id} store={store} onAction={onAction} />)}
          </section>
        </>
      )}
    </div>
  );
};

export default StoreDirectoryAdminPage;
